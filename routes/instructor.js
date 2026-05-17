const express = require('express');
const { db } = require('../database');
const { authenticateToken, requireRole } = require('../authMiddleware');
const { sendNotification } = require('../services/notification');

const router = express.Router();
router.use(authenticateToken);
router.use(requireRole('instructor'));

router.get('/profile', (req, res) => {
    db.get(`SELECT * FROM InstructorProfiles WHERE user_id = ?`, [req.user.id], (err, profile) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(profile);
    });
});

router.put('/profile', (req, res) => {
    const { department, academic_title, expertise, research_interests, previous_project_types, is_available } = req.body;
    db.run(`UPDATE InstructorProfiles SET department=?, academic_title=?, expertise=?, research_interests=?, previous_project_types=?, is_available=? WHERE user_id=?`,
    [department, academic_title, expertise, research_interests, previous_project_types, is_available, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: "Update failed" });
        res.json({ message: "Profile updated" });
    });
});

router.get('/announcements', (req, res) => {
    db.all(`SELECT a.*, pc.name as category_name FROM Announcements a LEFT JOIN ProjectCategories pc ON a.category_id = pc.id ORDER BY a.created_at DESC`, (err, rows) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(rows);
    });
});

router.get('/supervised-projects/:id/members', (req, res) => {
    const projectId = parseInt(req.params.id);
    // Security: only the assigned advisor can view members
    db.get(`SELECT id FROM Projects WHERE id = ? AND advisor_id = ?`, [projectId, req.user.id], (err, row) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!row) return res.status(403).json({ error: "Access denied. You are not the advisor of this project." });

        db.get(`SELECT p.owner_id, p.advisor_id, uo.name as owner_name, ua.name as advisor_name, spo.department as owner_dept, ipa.department as advisor_dept
                FROM Projects p
                JOIN Users uo ON p.owner_id = uo.id
                LEFT JOIN Users ua ON p.advisor_id = ua.id
                LEFT JOIN StudentProfiles spo ON uo.id = spo.user_id
                LEFT JOIN InstructorProfiles ipa ON ua.id = ipa.user_id
                WHERE p.id = ?`, [projectId], (err, proj) => {
            if (err) return res.status(500).json({ error: "Database error" });

            db.all(`SELECT u.id as id, u.name, sp.department, 'Member' as role
                    FROM ProjectApplications pa
                    JOIN Users u ON pa.student_id = u.id
                    LEFT JOIN StudentProfiles sp ON u.id = sp.user_id
                    WHERE pa.project_id = ? AND pa.status = 'Accepted'`, [projectId], (err, members) => {
                if (err) return res.status(500).json({ error: "Database error" });

                const allMembers = [];
                if (proj) {
                    allMembers.push({ id: proj.owner_id, name: proj.owner_name + " (Owner)", department: proj.owner_dept, role: 'Owner' });
                    if (proj.advisor_id) {
                        allMembers.push({ id: proj.advisor_id, name: proj.advisor_name + " (Advisor)", department: proj.advisor_dept, role: 'Advisor' });
                    }
                }
                res.json([...allMembers, ...members]);
            });
        });
    });
});

router.get('/supervised-projects', (req, res) => {
    db.all(`SELECT p.*, u.name as owner_name, u.email as owner_email 
            FROM Projects p 
            JOIN Users u ON p.owner_id = u.id 
            WHERE p.advisor_id = ?`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(rows);
    });
});

router.get('/requests', (req, res) => {
    db.all(`SELECT ar.*, p.title as project_title, u.name as student_name 
            FROM AdvisorRequests ar
            JOIN Projects p ON ar.project_id = p.id
            JOIN Users u ON p.owner_id = u.id
            WHERE ar.instructor_id = ?`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(rows);
    });
});

router.put('/requests/:id/respond', (req, res) => {
    const { status } = req.body;
    const reqId = parseInt(req.params.id);
    if (!['Accepted', 'Rejected'].includes(status)) return res.status(400).json({ error: "Invalid status" });

    db.get(`SELECT p.advisor_id, p.id as project_id FROM AdvisorRequests ar JOIN Projects p ON ar.project_id = p.id WHERE ar.id = ? AND ar.instructor_id = ?`, [reqId, req.user.id], (err, row) => {
        if (!row) return res.status(404).json({ error: "Request not found" });
        if (status === 'Accepted' && row.advisor_id !== null) {
            return res.status(400).json({ error: "Project already has an advisor" });
        }

        db.run(`UPDATE AdvisorRequests SET status = ? WHERE id = ?`, [status, reqId], function(err) {
            if (err) return res.status(500).json({ error: "Update failed" });
            
            db.get(`SELECT p.owner_id, p.title, p.id FROM AdvisorRequests ar JOIN Projects p ON ar.project_id = p.id WHERE ar.id = ?`, [reqId], (err, reqRow) => {
                if (reqRow) {
                    sendNotification(reqRow.owner_id, `Advisor Request for '${reqRow.title}' was ${status}`, 'Response');
                    if (status === 'Accepted') {
                        db.run(`UPDATE Projects SET advisor_id = ? WHERE id = ?`, [req.user.id, reqRow.id]);
                        db.run(`UPDATE AdvisorRequests SET status = 'Rejected' WHERE project_id = ? AND id != ? AND status = 'Pending'`, [reqRow.id, reqId]);
                    }
                }
            });
            res.json({ message: `Request ${status}` });
        });
    });
});

router.delete('/requests/:id', (req, res) => {
    const reqId = parseInt(req.params.id);
    if (isNaN(reqId)) return res.status(400).json({ error: "Invalid request id" });
    db.run(`DELETE FROM AdvisorRequests WHERE id = ? AND instructor_id = ?`, [reqId, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: "Delete failed" });
        if (!this.changes) return res.status(404).json({ error: "Request not found" });
        res.json({ message: "Request deleted" });
    });
});

module.exports = router;
