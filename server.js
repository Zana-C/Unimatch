const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./database');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const studentRoutes = require('./routes/student');
const instructorRoutes = require('./routes/instructor');
const notificationRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Database
initDB();

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/instructor', instructorRoutes);
app.use('/api/notifications', notificationRoutes);

// Fallback for SPA (if needed) or just serving index.html
app.use((req, res) => {
    // Robust API 404 check using originalUrl
    const fullUrl = req.originalUrl || req.url;
    if (fullUrl.startsWith('/api')) {
        console.warn(`404 Not Found: ${req.method} ${fullUrl}`);
        return res.status(404).json({ error: `API Route not found: ${fullUrl}` });
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Internal Server Error: " + err.message });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
