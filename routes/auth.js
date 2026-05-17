const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../database');
const { SECRET } = require('../authMiddleware');

const router = express.Router();

router.post('/register', (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ error: "All fields are required" });
    
    if (role === 'admin') {
        return res.status(403).json({ error: "Admin registration is not allowed" });
    }
    if (!['instructor', 'student'].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
    }

    const hash = bcrypt.hashSync(password, 10);
    
    db.run(`INSERT INTO Users (name, email, password_hash, role) VALUES (?, ?, ?, ?)`, [name, email, hash, role], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: "Email already exists" });
            }
            return res.status(500).json({ error: "Database error" });
        }
        
        const userId = this.lastID;
        
        // Initialize profile based on role
        if (role === 'instructor') {
            db.run(`INSERT INTO InstructorProfiles (user_id) VALUES (?)`, [userId]);
        } else if (role === 'student') {
            db.run(`INSERT INTO StudentProfiles (user_id) VALUES (?)`, [userId]);
        }
        
        res.status(201).json({ message: "User registered successfully" });
    });
});

router.post('/login', (req, res) => {
    const { email, password } = req.body;
    
    db.get(`SELECT * FROM Users WHERE email = ?`, [email], (err, user) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!user || !user.is_active) return res.status(401).json({ error: "Invalid email or account disabled" });
        
        if (!bcrypt.compareSync(password, user.password_hash)) {
            return res.status(401).json({ error: "Invalid password" });
        }
        
        const token = jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
    });
});

module.exports = router;
