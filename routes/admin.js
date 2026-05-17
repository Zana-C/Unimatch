const express = require('express');
const { db } = require('../database');
const { authenticateToken, requireRole } = require('../authMiddleware');
const { notifyAllUsers } = require('../services/notification');

const router = express.Router();
router.use(authenticateToken);
router.use(requireRole('admin'));

// Categories
router.get('/categories', (req, res) => {
    db.all(`SELECT * FROM ProjectCategories`, (err, rows) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(rows);
    });
});

router.post('/categories', (req, res) => {
    const { name, team_size_constraint, budget_constraint } = req.body;
    db.run(`INSERT INTO ProjectCategories (name, team_size_constraint, budget_constraint) VALUES (?, ?, ?)`, 
    [name, team_size_constraint, budget_constraint], function(err) {
        if (err) return res.status(500).json({ error: "Could not create category" });
        res.status(201).json({ id: this.lastID, message: "Category created" });
    });
});

router.put('/categories/:id', (req, res) => {
    const { name, team_size_constraint, budget_constraint } = req.body;
    const catId = parseInt(req.params.id);
    db.get(`SELECT name FROM ProjectCategories WHERE id = ?`, [catId], (err, oldCat) => {
        if (oldCat && oldCat.name !== name) {
            db.run(`UPDATE Projects SET type = ? WHERE type = ?`, [name, oldCat.name]);
        }
        db.run(`UPDATE ProjectCategories SET name = ?, team_size_constraint = ?, budget_constraint = ? WHERE id = ?`, 
        [name, team_size_constraint, budget_constraint, catId], function(err) {
            if (err) return res.status(500).json({ error: "Update failed" });
            res.json({ message: "Category updated" });
        });
    });
});

router.delete('/categories/:id', (req, res) => {
    const catId = parseInt(req.params.id);
    db.run(`DELETE FROM ProjectCategories WHERE id = ?`, [catId], function(err) {
        if (err) return res.status(500).json({ error: "Delete failed" });
        res.json({ message: "Category deleted" });
    });
});

// Announcements
router.get('/announcements', (req, res) => {
    db.all(`SELECT a.*, pc.name as category_name, u.name as created_by_name
            FROM Announcements a
            LEFT JOIN ProjectCategories pc ON a.category_id = pc.id
            LEFT JOIN Users u ON a.created_by = u.id
            ORDER BY a.created_at DESC`, (err, rows) => {
        if (err) return res.status(500).json({ error: "Failed to fetch announcements" });
        res.json(rows);
    });
});

router.post('/announcements', (req, res) => {
    const { title, description, category_id } = req.body;
    db.run(`INSERT INTO Announcements (title, description, category_id, created_by) VALUES (?, ?, ?, ?)`,
    [title, description, category_id, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: "Failed to create announcement" });
        notifyAllUsers(`New Announcement: ${title}`, 'Announcement');
        res.status(201).json({ message: "Announcement published" });
    });
});

router.put('/announcements/:id', (req, res) => {
    const annId = parseInt(req.params.id);
    const { title, description, category_id } = req.body;
    if (isNaN(annId)) return res.status(400).json({ error: "Invalid announcement id" });
    db.run(`UPDATE Announcements SET title = ?, description = ?, category_id = ? WHERE id = ?`,
    [title, description, category_id || null, annId], function(err) {
        if (err) return res.status(500).json({ error: "Failed to update announcement" });
        if (!this.changes) return res.status(404).json({ error: "Announcement not found" });
        res.json({ message: "Announcement updated" });
    });
});

router.delete('/announcements/:id', (req, res) => {
    const annId = parseInt(req.params.id);
    if (isNaN(annId)) return res.status(400).json({ error: "Invalid announcement id" });
    db.run(`DELETE FROM Announcements WHERE id = ?`, [annId], function(err) {
        if (err) return res.status(500).json({ error: "Failed to delete announcement" });
        if (!this.changes) return res.status(404).json({ error: "Announcement not found" });
        res.json({ message: "Announcement deleted" });
    });
});

// User Management
router.get('/users', (req, res) => {
    db.all(`SELECT id, name, email, role, is_active FROM Users`, (err, rows) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(rows);
    });
});

router.put('/users/:id/deactivate', (req, res) => {
    const targetId = parseInt(req.params.id);
    if (targetId === req.user.id) return res.status(400).json({ error: "You cannot deactivate yourself" });
    db.run(`UPDATE Users SET is_active = 0 WHERE id = ?`, [targetId], function(err) {
        if (err) return res.status(500).json({ error: "Update failed" });
        res.json({ message: "User deactivated" });
    });
});

router.put('/users/:id/reactivate', (req, res) => {
    const targetId = parseInt(req.params.id);
    if (isNaN(targetId)) return res.status(400).json({ error: "Invalid user id" });
    db.run(`UPDATE Users SET is_active = 1 WHERE id = ?`, [targetId], function(err) {
        if (err) return res.status(500).json({ error: "Update failed" });
        if (!this.changes) return res.status(404).json({ error: "User not found" });
        res.json({ message: "User reactivated" });
    });
});

router.put('/users/:id/role', (req, res) => {
    const { role } = req.body;
    const targetId = parseInt(req.params.id);
    if (!['admin', 'instructor', 'student'].includes(role)) return res.status(400).json({ error: "Invalid role" });
    db.run(`UPDATE Users SET role = ? WHERE id = ?`, [role, targetId], function(err) {
        if (err) return res.status(500).json({ error: "Update failed" });
        res.json({ message: "User role updated" });
    });
});

router.delete('/users/:id', (req, res) => {
    const targetId = parseInt(req.params.id);
    if (isNaN(targetId)) return res.status(400).json({ error: "Invalid user id" });
    if (targetId === req.user.id) return res.status(400).json({ error: "You cannot delete yourself" });

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.all(`SELECT id FROM Projects WHERE owner_id = ?`, [targetId], (err, projects) => {
            if (err) return rollback(err);
            const projectIds = projects.map(p => p.id);
            const placeholders = projectIds.map(() => '?').join(',');

            const continueDelete = () => {
                db.run(`UPDATE Projects SET advisor_id = NULL WHERE advisor_id = ?`, [targetId], (err) => {
                    if (err) return rollback(err);
                    db.run(`DELETE FROM ProjectApplications WHERE student_id = ?`, [targetId], (err) => {
                        if (err) return rollback(err);
                        db.run(`DELETE FROM AdvisorRequests WHERE instructor_id = ?`, [targetId], (err) => {
                            if (err) return rollback(err);
                            db.run(`DELETE FROM Notifications WHERE user_id = ?`, [targetId], (err) => {
                                if (err) return rollback(err);
                                db.run(`DELETE FROM ProjectTasks WHERE assigned_to = ?`, [targetId], (err) => {
                                    if (err) return rollback(err);
                                    db.run(`DELETE FROM StudentProfiles WHERE user_id = ?`, [targetId], (err) => {
                                        if (err) return rollback(err);
                                        db.run(`DELETE FROM InstructorProfiles WHERE user_id = ?`, [targetId], (err) => {
                                            if (err) return rollback(err);
                                            db.run(`DELETE FROM Users WHERE id = ?`, [targetId], function(err) {
                                                if (err) return rollback(err);
                                                if (!this.changes) return rollback(new Error("User not found"));
                                                db.run('COMMIT', (err) => {
                                                    if (err) return rollback(err);
                                                    res.json({ message: "User deleted permanently" });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            };

            if (!projectIds.length) return continueDelete();

            db.run(`DELETE FROM ProjectTasks WHERE project_id IN (${placeholders})`, projectIds, (err) => {
                if (err) return rollback(err);
                db.run(`DELETE FROM ProjectApplications WHERE project_id IN (${placeholders})`, projectIds, (err) => {
                    if (err) return rollback(err);
                    db.run(`DELETE FROM AdvisorRequests WHERE project_id IN (${placeholders})`, projectIds, (err) => {
                        if (err) return rollback(err);
                        db.run(`DELETE FROM Projects WHERE id IN (${placeholders})`, projectIds, (err) => {
                            if (err) return rollback(err);
                            continueDelete();
                        });
                    });
                });
            });
        });

        function rollback(err) {
            db.run('ROLLBACK', () => {
                res.status(500).json({ error: err.message || "User delete failed" });
            });
        }
    });
});

router.get('/metrics', async (req, res) => {
    const queries = [
        { key: 'total_users', sql: "SELECT COUNT(*) as count FROM Users" },
        { key: 'total_projects', sql: "SELECT COUNT(*) as count FROM Projects" },
        { key: 'total_categories', sql: "SELECT COUNT(*) as count FROM ProjectCategories" },
        { key: 'total_applications', sql: "SELECT COUNT(*) as count FROM ProjectApplications WHERE status = 'Accepted'" }
    ];
    
    try {
        const results = await Promise.all(queries.map(q => {
            return new Promise((resolve, reject) => {
                db.get(q.sql, (err, row) => {
                    if (err) reject(err);
                    else resolve({ [q.key]: (row && row.count !== undefined) ? row.count : 0 });
                });
            });
        }));
        
        const metrics = Object.assign({}, ...results);
        res.json(metrics);
    } catch (err) {
        res.status(500).json({ error: "Metrics retrieval failed" });
    }
});

module.exports = router;
