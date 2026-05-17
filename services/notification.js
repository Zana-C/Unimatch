const { db } = require('../database');

function sendNotification(userId, message, type) {
    db.run(`INSERT INTO Notifications (user_id, message, type) VALUES (?, ?, ?)`, [userId, message, type], (err) => {
        if (err) console.error("Error inserting notification:", err);
    });
}

function notifyAllUsers(message, type) {
    db.all(`SELECT id FROM Users WHERE is_active = 1`, (err, rows) => {
        if (err) return console.error(err);
        const stmt = db.prepare(`INSERT INTO Notifications (user_id, message, type) VALUES (?, ?, ?)`);
        rows.forEach(row => stmt.run([row.id, message, type]));
        stmt.finalize();
    });
}

module.exports = { sendNotification, notifyAllUsers };
