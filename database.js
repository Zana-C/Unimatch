const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'unimatch.db');
const db = new sqlite3.Database(dbPath);

function initDB() {
    db.run("PRAGMA foreign_keys = ON");
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS Users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL, /* admin, instructor, student */
            is_active BOOLEAN DEFAULT 1
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS InstructorProfiles (
            user_id INTEGER PRIMARY KEY,
            department TEXT,
            academic_title TEXT,
            expertise TEXT,
            research_interests TEXT,
            previous_project_types TEXT,
            is_available BOOLEAN DEFAULT 1,
            FOREIGN KEY(user_id) REFERENCES Users(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS StudentProfiles (
            user_id INTEGER PRIMARY KEY,
            department TEXT,
            year TEXT,
            interests TEXT,
            technical_skills TEXT,
            github_url TEXT,
            linkedin_url TEXT,
            bio TEXT,
            FOREIGN KEY(user_id) REFERENCES Users(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS ProjectCategories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            team_size_constraint INTEGER,
            budget_constraint TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS Announcements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            category_id INTEGER,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(category_id) REFERENCES ProjectCategories(id) ON DELETE SET NULL,
            FOREIGN KEY(created_by) REFERENCES Users(id) ON DELETE SET NULL
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS Projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            type TEXT NOT NULL,
            description TEXT,
            required_skills TEXT,
            needed_members INTEGER,
            needed_roles TEXT,
            owner_id INTEGER NOT NULL,
            advisor_id INTEGER,
            status TEXT DEFAULT 'Open',
            FOREIGN KEY(owner_id) REFERENCES Users(id),
            FOREIGN KEY(advisor_id) REFERENCES Users(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS ProjectApplications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            student_id INTEGER NOT NULL,
            status TEXT DEFAULT 'Pending',
            is_invitation BOOLEAN DEFAULT 0,
            FOREIGN KEY(project_id) REFERENCES Projects(id),
            FOREIGN KEY(student_id) REFERENCES Users(id),
            UNIQUE(project_id, student_id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS AdvisorRequests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            instructor_id INTEGER NOT NULL,
            status TEXT DEFAULT 'Pending',
            FOREIGN KEY(project_id) REFERENCES Projects(id),
            FOREIGN KEY(instructor_id) REFERENCES Users(id),
            UNIQUE(project_id, instructor_id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS Notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            message TEXT NOT NULL,
            type TEXT NOT NULL,
            is_read BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES Users(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS ProjectTasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            assigned_to INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'Todo', /* Todo, In Progress, Done */
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(project_id) REFERENCES Projects(id) ON DELETE CASCADE,
            FOREIGN KEY(assigned_to) REFERENCES Users(id) ON DELETE CASCADE
        )`);

        // Default Categories
        db.get(`SELECT COUNT(*) as count FROM ProjectCategories`, (err, row) => {
            if (row && row.count === 0) {
                const stmt = db.prepare(`INSERT INTO ProjectCategories (name) VALUES (?)`);
                stmt.run('Course Project');
                stmt.run('TÜBİTAK Student Project');
                stmt.run('Teknofest Student Project');
                stmt.finalize();
            }
        });
        
        // Default Admin
        db.get(`SELECT COUNT(*) as count FROM Users WHERE role = 'admin'`, (err, row) => {
            if (row && row.count === 0) {
                const defaultAdminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
                const hash = bcrypt.hashSync(defaultAdminPassword, 10);
                db.run(`INSERT INTO Users (name, email, password_hash, role) VALUES ('Admin User', 'admin@unimatch.edu', ?, 'admin')`, [hash]);
            }
        });
    });
}

module.exports = { db, initDB };
