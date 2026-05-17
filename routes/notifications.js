const express = require('express');
const { db } = require('../database');
const { authenticateToken } = require('../authMiddleware');

const router = express.Router();
router.use(authenticateToken);

// Get unread notifications
router.get('/', (req, res) => {
    db.all(`SELECT * FROM Notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(rows);
    });
});

// Mark all as read
router.put('/read-all', (req, res) => {
    db.run(`UPDATE Notifications SET is_read = 1 WHERE user_id = ?`, [req.user.id], function(err) {
        if (err) return res.status(500).json({ error: "Update failed" });
        res.json({ success: true, count: this.changes });
    });
});

// Mark as read
router.put('/:id/read', (req, res) => {
    const noteId = parseInt(req.params.id);
    db.run(`UPDATE Notifications SET is_read = 1 WHERE id = ? AND user_id = ?`, [noteId, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: "Update failed" });
        res.json({ success: true });
    });
});

module.exports = router;
