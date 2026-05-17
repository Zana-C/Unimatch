const express = require('express');
const { db } = require('../database');
const { authenticateToken, requireRole } = require('../authMiddleware');
const { sendNotification } = require('../services/notification');

const router = express.Router();
router.use(authenticateToken);
router.use(requireRole('student'));

router.get('/profile', (req, res) => {
    db.get(`SELECT * FROM StudentProfiles WHERE user_id = ?`, [req.user.id], (err, profile) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(profile);
    });
});

router.put('/profile', (req, res) => {
    const { department, year, interests, technical_skills, github_url, linkedin_url, bio } = req.body;
    db.run(`UPDATE StudentProfiles SET department=?, year=?, interests=?, technical_skills=?, github_url=?, linkedin_url=?, bio=? WHERE user_id=?`,
    [department, year, interests, technical_skills, github_url, linkedin_url, bio, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: "Update failed" });
        res.json({ message: "Profile updated" });
    });
});

// Everyone can view announcements ideally, but we put it here for students
router.get('/announcements', (req, res) => {
    db.all(`SELECT a.*, pc.name as category_name FROM Announcements a LEFT JOIN ProjectCategories pc ON a.category_id = pc.id ORDER BY created_at DESC`, (err, rows) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(rows);
    });
});

router.get('/projects', (req, res) => {
    db.all(`
        SELECT p.*, u.name as owner_name, pa.status as my_application_status,
        (SELECT COUNT(*) FROM ProjectApplications WHERE project_id = p.id AND status = 'Accepted') as accepted_count
        FROM Projects p 
        JOIN Users u ON p.owner_id = u.id
        LEFT JOIN ProjectApplications pa ON pa.project_id = p.id AND pa.student_id = ?
    `, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(rows);
    });
});

router.get('/projects/:id/members', (req, res) => {
    const projectId = parseInt(req.params.id);
    
    // Security check: Only owner, advisor, or accepted members can see members
    db.get(`SELECT id FROM Projects WHERE id = ? AND (owner_id = ? OR advisor_id = ?)`, [projectId, req.user.id, req.user.id], (err, row) => {
        if (!row) {
            // Check if user is an accepted member
            db.get(`SELECT id FROM ProjectApplications WHERE project_id = ? AND student_id = ? AND status = 'Accepted'`, [projectId, req.user.id], (err, app) => {
                if (!app) return res.status(403).json({ error: "Access denied. You are not a member of this project." });
                fetchTeam();
            });
        } else {
            fetchTeam();
        }
    });

    function fetchTeam() {
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
    }
});

router.post('/projects', (req, res) => {
    const { title, type, description, required_skills, needed_members, needed_roles } = req.body;
    
    const isHighProfile = type.includes('TÜBİTAK') || type.includes('Teknofest');
    
    const checkConstraints = (callback) => {
        if (isHighProfile) {
            // Check if user owns or is member of another high-profile project
            db.get(`
                SELECT COUNT(*) as count FROM (
                    SELECT id FROM Projects WHERE owner_id = ? AND (type LIKE '%TÜBİTAK%' OR type LIKE '%Teknofest%')
                    UNION ALL
                    SELECT project_id FROM ProjectApplications WHERE student_id = ? AND status = 'Accepted' AND project_id IN (SELECT id FROM Projects WHERE type LIKE '%TÜBİTAK%' OR type LIKE '%Teknofest%')
                )
            `, [req.user.id, req.user.id], (err, row) => {
                if (row && row.count > 0) return res.status(400).json({ error: "You can only participate in one TÜBİTAK or Teknofest project at a time." });
                callback();
            });
        } else {
            callback();
        }
    };

    checkConstraints(() => {
        db.get(`SELECT team_size_constraint FROM ProjectCategories WHERE name = ?`, [type], (err, cat) => {
            if (cat && cat.team_size_constraint && parseInt(needed_members) > cat.team_size_constraint) {
                return res.status(400).json({ error: `Needed members cannot exceed category limit of ${cat.team_size_constraint}` });
            }
            db.run(`INSERT INTO Projects (title, type, description, required_skills, needed_members, needed_roles, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [title, type, description, required_skills, needed_members, needed_roles, req.user.id], function(err) {
                if (err) return res.status(500).json({ error: "Failed to create project" });
                res.status(201).json({ id: this.lastID, message: "Project created" });
            });
        });
    });
});

router.post('/projects/:id/apply', (req, res) => {
    const projectId = req.params.id;
    const studentId = req.user.id;

    db.get(`SELECT type, owner_id, title FROM Projects WHERE id = ?`, [projectId], (err, project) => {
        if (!project) return res.status(404).json({ error: "Project not found" });
        if (project.owner_id === studentId) return res.status(400).json({ error: "You cannot apply to your own project" });

        const isHighProfile = project.type.includes('TÜBİTAK') || project.type.includes('Teknofest');

        const checkConstraints = (callback) => {
            if (isHighProfile) {
                db.get(`
                    SELECT COUNT(*) as count FROM (
                        SELECT id FROM Projects WHERE owner_id = ? AND (type LIKE '%TÜBİTAK%' OR type LIKE '%Teknofest%')
                        UNION ALL
                        SELECT project_id FROM ProjectApplications WHERE student_id = ? AND status = 'Accepted' AND project_id IN (SELECT id FROM Projects WHERE type LIKE '%TÜBİTAK%' OR type LIKE '%Teknofest%')
                    )
                `, [studentId, studentId], (err, row) => {
                    if (row && row.count > 0) return res.status(400).json({ error: "You are already a participant in another TÜBİTAK or Teknofest project." });
                    callback();
                });
            } else {
                callback();
            }
        };

        checkConstraints(() => {
            db.get(`SELECT id FROM ProjectApplications WHERE project_id = ? AND student_id = ?`, [projectId, studentId], (err, row) => {
                if (row) return res.status(400).json({ error: "You have already applied to this project" });
                db.run(`INSERT INTO ProjectApplications (project_id, student_id) VALUES (?, ?)`, [projectId, studentId], function(err) {
                    if (err) return res.status(500).json({ error: "Application failed" });
                    sendNotification(project.owner_id, `A new student has applied to your project "${project.title}".`, 'info');
                    res.json({ message: "Applied successfully" });
                });
            });
        });
    });
});

// For Project Owners
router.get('/my-projects', (req, res) => {
    db.all(`SELECT * FROM Projects WHERE owner_id = ?`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(rows);
    });
});

router.get('/my-projects/incoming-applications', (req, res) => {
    db.all(`SELECT pa.*, u.name, p.title as project_title, sp.department
            FROM ProjectApplications pa
            JOIN Projects p ON pa.project_id = p.id
            JOIN Users u ON pa.student_id = u.id
            JOIN StudentProfiles sp ON u.id = sp.user_id
            WHERE p.owner_id = ? AND pa.status = 'Pending' AND pa.is_invitation = 0`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(rows);
    });
});

router.get('/my-applications', (req, res) => {
    db.all(`SELECT pa.*, p.title, p.type FROM ProjectApplications pa JOIN Projects p ON pa.project_id = p.id WHERE pa.student_id = ?`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(rows);
    });
});

router.delete('/my-applications/:app_id', (req, res) => {
    const appId = parseInt(req.params.app_id);
    if (isNaN(appId)) return res.status(400).json({ error: "Invalid application id" });
    db.run(`DELETE FROM ProjectApplications WHERE id = ? AND student_id = ?`, [appId, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: "Delete failed" });
        if (!this.changes) return res.status(404).json({ error: "Application not found" });
        res.json({ message: "Application removed" });
    });
});

router.put('/my-applications/:app_id/respond', (req, res) => {
    const { status } = req.body;
    const studentId = req.user.id;
    
    db.get(`SELECT pa.*, p.type, p.owner_id, p.title FROM ProjectApplications pa JOIN Projects p ON pa.project_id = p.id WHERE pa.id = ? AND pa.student_id = ?`, 
    [req.params.app_id, studentId], (err, app) => {
        if (!app) return res.status(404).json({ error: "Application not found" });
        if (!app.is_invitation) return res.status(403).json({ error: "Only invitations can be responded to by the student" });
        
        if (status === 'Accepted') {
            const isHighProfile = app.type.includes('TÜBİTAK') || app.type.includes('Teknofest');
            const check = (callback) => {
                if (isHighProfile) {
                    db.get(`
                        SELECT COUNT(*) as count FROM (
                            SELECT id FROM Projects WHERE owner_id = ? AND (type LIKE '%TÜBİTAK%' OR type LIKE '%Teknofest%')
                            UNION ALL
                            SELECT project_id FROM ProjectApplications WHERE student_id = ? AND status = 'Accepted' AND project_id IN (SELECT id FROM Projects WHERE type LIKE '%TÜBİTAK%' OR type LIKE '%Teknofest%')
                        )
                    `, [studentId, studentId], (err, row) => {
                        if (row && row.count > 0) return res.status(400).json({ error: "You are already in another high-profile project." });
                        callback();
                    });
                } else callback();
            };
            
            check(() => {
                db.run(`UPDATE ProjectApplications SET status = 'Accepted' WHERE id = ?`, [req.params.app_id], (err) => {
                    if (err) return res.status(500).json({ error: "Update failed" });
                    sendNotification(app.owner_id, `Student ${req.user.name} accepted your invitation to "${app.title}".`, 'success');
                    res.json({ message: "Invitation accepted" });
                });
            });
        } else {
            db.run(`DELETE FROM ProjectApplications WHERE id = ?`, [req.params.app_id], (err) => {
                res.json({ message: "Invitation declined" });
            });
        }
    });
});

router.get('/my-projects/:id/applications', (req, res) => {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) return res.status(400).json({ error: "Invalid project id" });
    db.get(`SELECT owner_id FROM Projects WHERE id = ?`, [projectId], (err, proj) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!proj || proj.owner_id !== req.user.id) return res.status(403).json({ error: "Not authorized" });
        db.all(`SELECT pa.*, u.name, sp.department, sp.technical_skills 
                FROM ProjectApplications pa 
                JOIN Users u ON pa.student_id = u.id 
                JOIN StudentProfiles sp ON u.id = sp.user_id
                WHERE pa.project_id = ?`, [projectId], (err, rows) => {
            if (err) return res.status(500).json({ error: "Database error" });
            res.json(rows);
        });
    });
});

router.put('/projects/:id/applications/:app_id/respond', (req, res) => {
    const { status } = req.body;
    const projectId = parseInt(req.params.id);
    const appId = parseInt(req.params.app_id);
    if (isNaN(projectId) || isNaN(appId)) return res.status(400).json({ error: "Invalid id" });
    if (!['Accepted', 'Rejected'].includes(status)) return res.status(400).json({ error: "Invalid status" });
    // Verify ownership
    db.get(`SELECT owner_id, needed_members FROM Projects WHERE id = ?`, [projectId], (err, proj) => {
        if (!proj || proj.owner_id !== req.user.id) return res.status(403).json({ error: "Not authorized" });
        
        if (status === 'Accepted') {
            db.get(`SELECT COUNT(*) as count FROM ProjectApplications WHERE project_id = ? AND status = 'Accepted'`, [projectId], (err, row) => {
                if (row && row.count >= proj.needed_members) {
                    return res.status(400).json({ error: "Team is already full based on needed members count" });
                }
                updateApplicationStatus(req, res, status, projectId, appId);
            });
        } else {
            updateApplicationStatus(req, res, status, projectId, appId);
        }
    });
});

router.delete('/projects/:id/applications/:app_id', (req, res) => {
    const projectId = parseInt(req.params.id);
    const appId = parseInt(req.params.app_id);
    if (isNaN(projectId) || isNaN(appId)) return res.status(400).json({ error: "Invalid id" });
    db.get(`SELECT owner_id FROM Projects WHERE id = ?`, [projectId], (err, proj) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!proj || proj.owner_id !== req.user.id) return res.status(403).json({ error: "Not authorized" });
        db.run(`DELETE FROM ProjectApplications WHERE id = ? AND project_id = ?`, [appId, projectId], function(err) {
            if (err) return res.status(500).json({ error: "Delete failed" });
            if (!this.changes) return res.status(404).json({ error: "Application not found" });
            res.json({ message: "Application deleted" });
        });
    });
});

function updateApplicationStatus(req, res, status, projectId, appId) {
    db.run(`UPDATE ProjectApplications SET status = ? WHERE id = ? AND project_id = ?`, [status, appId, projectId], function(err) {
        if (err) return res.status(500).json({ error: "Update failed" });
        if (!this.changes) return res.status(404).json({ error: "Application not found in this project" });
        
        db.get(`SELECT student_id, (SELECT title FROM Projects WHERE id = ?) as title FROM ProjectApplications WHERE id = ?`, [projectId, appId], (err, appRow) => {
            if (appRow) {
                sendNotification(appRow.student_id, `Your application to '${appRow.title}' was ${status}`, 'Response');
            }
        });
        res.json({ message: `Application ${status}` });
    });
}

// Advisor Search & Request
router.get('/instructors', (req, res) => {
    const { expertise } = req.query;
    let query = `SELECT ip.*, u.name, u.email FROM InstructorProfiles ip JOIN Users u ON ip.user_id = u.id WHERE ip.is_available = 1`;
    const params = [];
    
    if (expertise) {
        query += ` AND LOWER(ip.expertise) LIKE LOWER(?)`;
        params.push(`%${expertise}%`);
    }
    
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(rows);
    });
});

router.post('/projects/:id/advisor-request', (req, res) => {
    const { instructor_id } = req.body;
    db.get(`SELECT type, owner_id, title FROM Projects WHERE id = ?`, [req.params.id], (err, proj) => {
        if (!proj || proj.owner_id !== req.user.id) return res.status(403).json({ error: "Not authorized" });
        const advisorEligible = proj.type.includes('TÜBİTAK') || proj.type.includes('Teknofest');
        if (!advisorEligible) return res.status(400).json({ error: "Advisor requests are only available for TÜBİTAK and Teknofest projects" });
        
        db.get(`SELECT id FROM AdvisorRequests WHERE project_id = ? AND instructor_id = ?`, [req.params.id, instructor_id], (err, existing) => {
            if (existing) return res.status(400).json({ error: "You have already sent a request to this advisor" });
            
            db.run(`INSERT INTO AdvisorRequests (project_id, instructor_id) VALUES (?, ?)`, [req.params.id, instructor_id], function(err) {
                if (err) return res.status(500).json({ error: "Request failed" });
                sendNotification(instructor_id, `You have a new Advisor Request for '${proj.title || 'Project'}'`, 'Request');
                res.json({ message: "Advisor requested" });
            });
        });
    });
});

// Get My Advisor Requests status
router.get('/my-advisor-requests', (req, res) => {
    db.all(`SELECT ar.*, p.title, u.name as instructor_name 
            FROM AdvisorRequests ar
            JOIN Projects p ON ar.project_id = p.id
            JOIN Users u ON ar.instructor_id = u.id
            WHERE p.owner_id = ?`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(rows);
    });
});

router.delete('/my-advisor-requests/:id', (req, res) => {
    const reqId = parseInt(req.params.id);
    if (isNaN(reqId)) return res.status(400).json({ error: "Invalid request id" });
    db.run(`DELETE FROM AdvisorRequests WHERE id = ? AND project_id IN (SELECT id FROM Projects WHERE owner_id = ?)`, [reqId, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: "Delete failed" });
        if (!this.changes) return res.status(404).json({ error: "Request not found" });
        res.json({ message: "Advisor request removed" });
    });
});

// --- NEW ENTERPRISE FEATURES ---

// Search Students
router.get('/students', (req, res) => {
    const { department, skill } = req.query;
    let query = `SELECT u.id, u.name, sp.department, sp.technical_skills, sp.interests 
                 FROM Users u 
                 JOIN StudentProfiles sp ON u.id = sp.user_id 
                 WHERE u.role = 'student' AND u.id != ?`;
    const params = [req.user.id];
    
    if (department) {
        query += ` AND LOWER(sp.department) LIKE LOWER(?)`;
        params.push(`%${department}%`);
    }
    if (skill) {
        query += ` AND LOWER(sp.technical_skills) LIKE LOWER(?)`;
        params.push(`%${skill}%`);
    }
    
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(rows);
    });
});

// Invite Student to Project
router.post('/projects/:id/invite', (req, res) => {
    const { student_id } = req.body;
    const projectId = req.params.id;
    
    db.get(`SELECT owner_id, title FROM Projects WHERE id = ?`, [projectId], (err, proj) => {
        if (!proj || proj.owner_id !== req.user.id) return res.status(403).json({ error: "Not authorized" });
        
        // Check if already applied or member
        db.get(`SELECT id FROM ProjectApplications WHERE project_id = ? AND student_id = ?`, [projectId, student_id], (err, existing) => {
            if (existing) return res.status(400).json({ error: "Student is already a member or has a pending application" });
            
            db.run(`INSERT INTO ProjectApplications (project_id, student_id, status, is_invitation) VALUES (?, ?, 'Pending', 1)`, [projectId, student_id], function(err) {
                if (err) return res.status(500).json({ error: "Invitation failed" });
                sendNotification(student_id, `You have been invited to join the project: ${proj.title}`, 'Invitation');
                res.json({ message: "Invitation sent" });
            });
        });
    });
});

// Remove Member (Student or Advisor) from Project
router.delete('/projects/:id/members/:userId', (req, res) => {
    const projectId = parseInt(req.params.id);
    const userId = parseInt(req.params.userId);
    
    // Check ownership
    db.get(`SELECT owner_id, advisor_id FROM Projects WHERE id = ?`, [projectId], (err, proj) => {
        if (!proj) return res.status(404).json({ error: "Project not found" });
        if (proj.owner_id !== req.user.id) return res.status(403).json({ error: "Not authorized" });
        
        if (proj.advisor_id === userId) {
            // Removing the advisor
            db.run(`UPDATE Projects SET advisor_id = NULL WHERE id = ?`, [projectId], function(err) {
                if (err) return res.status(500).json({ error: "Failed to remove advisor from project" });
                
                // Also clear the accepted request in AdvisorRequests table so it doesn't show as 'Accepted' in search
                db.run(`DELETE FROM AdvisorRequests WHERE project_id = ? AND instructor_id = ?`, [projectId, userId], (err) => {
                    sendNotification(userId, `Senin danışmanlığın bu projeden kaldırıldı.`, 'System');
                    res.json({ message: "Advisor removed from team" });
                });
            });
        } else {
            // Removing a student member
            db.run(`DELETE FROM ProjectApplications WHERE project_id = ? AND student_id = ? AND status = 'Accepted'`, 
            [projectId, userId], function(err) {
                if (err) return res.status(500).json({ error: "Failed to remove member" });
                sendNotification(userId, `Proje ekibinden çıkarıldın.`, 'System');
                res.json({ message: "Member removed from team" });
            });
        }
    });
});

// Tasks
router.post('/projects/:id/tasks', (req, res) => {
    const { assigned_to, title, description } = req.body;
    const projectId = parseInt(req.params.id);
    const assignedToId = parseInt(assigned_to);
    
    if (isNaN(projectId) || isNaN(assignedToId)) return res.status(400).json({ error: "Invalid Project or Student ID" });

    db.get(`SELECT owner_id FROM Projects WHERE id = ?`, [projectId], (err, proj) => {
        if (!proj || proj.owner_id !== req.user.id) return res.status(403).json({ error: "Not authorized" });

        db.get(`SELECT id FROM Projects WHERE id = ? AND advisor_id = ?`, [projectId, assignedToId], (err, advisorRow) => {
            if (err) return res.status(500).json({ error: "Database error" });
            if (advisorRow) {
                return db.run(`INSERT INTO ProjectTasks (project_id, assigned_to, title, description) VALUES (?, ?, ?, ?)`,
                [projectId, assignedToId, title, description], function(err) {
                    if (err) return res.status(500).json({ error: "Database error: " + err.message });
                    sendNotification(assignedToId, `New task assigned: ${title}`, 'Task');
                    res.status(201).json({ message: "Task assigned" });
                });
            }

            db.get(`SELECT id FROM ProjectApplications WHERE project_id = ? AND student_id = ? AND status = 'Accepted'`, [projectId, assignedToId], (err, memberRow) => {
                if (err) return res.status(500).json({ error: "Database error" });
                if (!memberRow) return res.status(400).json({ error: "Assignee must be an accepted team member or project advisor" });
                db.run(`INSERT INTO ProjectTasks (project_id, assigned_to, title, description) VALUES (?, ?, ?, ?)`,
                [projectId, assignedToId, title, description], function(err) {
                    if (err) return res.status(500).json({ error: "Database error: " + err.message });
                    sendNotification(assignedToId, `New task assigned: ${title}`, 'Task');
                    res.status(201).json({ message: "Task assigned" });
                });
            });
        });
    });
});

router.get('/my-tasks', (req, res) => {
    db.all(`SELECT t.*, p.title as project_title 
            FROM ProjectTasks t 
            JOIN Projects p ON t.project_id = p.id 
            WHERE t.assigned_to = ? AND t.status != 'Done' AND t.status != 'Completed'`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(rows);
    });
});

router.get('/projects/:id/tasks', (req, res) => {
    const projectId = parseInt(req.params.id);
    
    // Security check
    db.get(`SELECT id FROM Projects WHERE id = ? AND (owner_id = ? OR advisor_id = ?)`, [projectId, req.user.id, req.user.id], (err, row) => {
        if (!row) {
            db.get(`SELECT id FROM ProjectApplications WHERE project_id = ? AND student_id = ? AND status = 'Accepted'`, [projectId, req.user.id], (err, app) => {
                if (!app) return res.status(403).json({ error: "Access denied" });
                fetchTasks();
            });
        } else {
            fetchTasks();
        }
    });

    function fetchTasks() {
        db.all(`SELECT t.*, u.name as assignee_name 
                FROM ProjectTasks t 
                JOIN Users u ON t.assigned_to = u.id 
                WHERE t.project_id = ?`, [projectId], (err, rows) => {
            if (err) return res.status(500).json({ error: "Database error" });
            res.json(rows);
        });
    }
});

router.put('/projects/:id/tasks/:taskId', (req, res) => {
    const { status } = req.body;
    const taskId = parseInt(req.params.taskId);
    db.run(`UPDATE ProjectTasks SET status = ? WHERE id = ? AND (assigned_to = ? OR project_id IN (SELECT id FROM Projects WHERE owner_id = ?))`,
    [status, taskId, req.user.id, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: "Update failed" });
        
        // Notify owner if task is done
        if (status === 'Done' || status === 'Completed') {
            db.get(`SELECT p.owner_id, p.title as proj_title, t.title as task_title 
                    FROM ProjectTasks t 
                    JOIN Projects p ON t.project_id = p.id 
                    WHERE t.id = ?`, [taskId], (err, row) => {
                if (row) sendNotification(row.owner_id, `Task "${row.task_title}" in project "${row.proj_title}" was marked as Done.`, 'success');
            });
        }
        res.json({ message: "Task status updated" });
    });
});

module.exports = router;
