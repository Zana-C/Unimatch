const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'dev_only_change_me';

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ error: "Access denied. No token provided." });

    jwt.verify(token, SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid or expired token." });
        
        // Real-Time Session Invalidation
        const { db } = require('./database');
        db.get(`SELECT is_active FROM Users WHERE id = ?`, [user.id], (err, row) => {
            if (err || !row || !row.is_active) {
                return res.status(403).json({ error: "Your account has been deactivated by an Admin." });
            }
            req.user = user;
            next();
        });
    });
}

function requireRole(role) {
    return (req, res, next) => {
        if (req.user.role !== role) {
            return res.status(403).json({ error: `Access denied. Requires ${role} role.` });
        }
        next();
    };
}

module.exports = { authenticateToken, requireRole, SECRET };
