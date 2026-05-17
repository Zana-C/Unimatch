const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const { initDB } = require('./database');

const dbPath = path.resolve(__dirname, 'unimatch.db');
const db = new sqlite3.Database(dbPath);

const hash = bcrypt.hashSync('pass123', 10);

const DEPARTMENTS = [
    "Computer Engineering", "Software Engineering", "Electrical Engineering", 
    "Industrial Design", "Management Information Systems", "Mathematics", 
    "Physics", "Civil Engineering", "Mechanical Engineering", "Psychology",
    "Digital Game Design", "Visual Communication Design"
];

const SKILLS = [
    "React", "Node.js", "Python", "Java", "C++", "SQL", "UI/UX", "Figma", 
    "AWS", "Docker", "Machine Learning", "Data Science", "C#", "Unity", 
    "Angular", "Vue.js", "Swift", "Kotlin", "Go", "Rust", "TensorFlow", 
    "PyTorch", "Kubernetes", "Firebase", "MongoDB", "PostgreSQL", "Solidity"
];

function getRandom(arr, count) {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function seed() {
    console.log("Initializing database schema...");
    initDB(); // This is still callback based in database.js but serializes
    
    // Wait a bit for tables to be created
    await new Promise(r => setTimeout(r, 2000));

    console.log("Expanding database with production-ready dummy data...");
    
    try {
        // --- 1. Instructors (12 total) ---
        const instructorNames = [
            "Dr. Ahmet Yılmaz", "Dr. Elif Kaya", "Dr. Mehmet Demir", "Dr. Selin Aksoy",
            "Dr. Caner Bulut", "Dr. Merve Tan", "Dr. Burak Can", "Dr. Özlem Yıldız",
            "Dr. Deniz Kılıç", "Dr. Hakan Arslan", "Dr. Yasemin Koç", "Dr. Murat Aydın"
        ];

        for (let idx = 0; idx < instructorNames.length; idx++) {
            let name = instructorNames[idx];
            let cleanName = name.replace(/Dr\.\s*/i, '').trim().toLowerCase()
                .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ç/g, 'c').replace(/ş/g, 's').replace(/ğ/g, 'g');
            const email = cleanName.split(' ').join('.') + "@unimatch.edu";
            const dept = DEPARTMENTS[idx % DEPARTMENTS.length];
            const expertise = getRandom(SKILLS, 3).join(', ');
            
            const user = await run(`INSERT OR IGNORE INTO Users (name, email, password_hash, role) VALUES (?, ?, ?, 'instructor')`, [name, email, hash]);
            if (user.lastID) {
                await run(`INSERT INTO InstructorProfiles (user_id, department, academic_title, expertise, is_available) VALUES (?, ?, ?, ?, 1)`,
                [user.lastID, dept, "Associate Professor", expertise]);
            }
        }

        // --- 2. Students (25 total) ---
        const firstNames = ["Zeynep", "Caner", "Merve", "Burak", "Selin", "Emre", "Aslı", "Mert", "Gizem", "Onur", "Derya", "Arda", "Ece", "Kaan", "Buse", "Yiğit", "Nil", "Bora", "Irem", "Ege"];
        const lastNames = ["Arslan", "Yildiz", "Celik", "Aydin", "Bakir", "Ozturk", "Kilic", "Demir", "Aksoy", "Sahin", "Koc", "Bulut", "Kaya", "Ozkan", "Yilmaz"];

        for (let i = 0; i < 25; i++) {
            const fname = firstNames[i % firstNames.length];
            const lname = lastNames[i % lastNames.length];
            const name = fname + " " + lname;
            let cleanFname = fname.toLowerCase().replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ç/g, 'c').replace(/ş/g, 's').replace(/ğ/g, 'g');
            const email = cleanFname + (i+1) + "@unimatch.edu";
            const dept = DEPARTMENTS[i % DEPARTMENTS.length];
            const year = (i % 4) + 1;
            const skills = getRandom(SKILLS, 4).join(', ');
            
            const user = await run(`INSERT OR IGNORE INTO Users (name, email, password_hash, role) VALUES (?, ?, ?, 'student')`, [name, email, hash]);
            if (user.lastID) {
                await run(`INSERT INTO StudentProfiles (user_id, department, year, technical_skills, bio) VALUES (?, ?, ?, ?, ?)`,
                [user.lastID, dept, year.toString(), skills, `I am a student at ${dept} interested in ${skills}.`]);
            }
        }

        // --- 3. Projects (8 total) ---
        const projectData = [
            { title: "Smart Campus App", type: "TÜBİTAK Student Project", desc: "IoT based campus navigation and facility management.", members: 4 },
            { title: "AI Medical Diagnostician", type: "Teknofest Student Project", desc: "Deep learning model for early cancer detection.", members: 5 },
            { title: "Blockchain Voting System", type: "Course Project", desc: "Secure and transparent voting for university elections.", members: 3 },
            { title: "Eco-Friendly Logistics", type: "TÜBİTAK Student Project", desc: "Optimizing delivery routes for electric vehicles.", members: 3 },
            { title: "VR History Museum", type: "Teknofest Student Project", desc: "Immersive VR experience of ancient civilizations.", members: 4 },
            { title: "Autonomous Drone Swarm", type: "Teknofest Student Project", desc: "Coordinated search and rescue missions with drones.", members: 6 },
            { title: "Mental Health AI Chatbot", type: "Course Project", desc: "Sentiment analysis based supportive chatbot.", members: 2 },
            { title: "Smart Agriculture IoT", type: "TÜBİTAK Student Project", desc: "Automated irrigation and soil monitoring system.", members: 4 }
        ];

        const students = await all(`SELECT id FROM Users WHERE role = 'student' LIMIT 15`);
        for (let idx = 0; idx < projectData.length; idx++) {
            const p = projectData[idx];
            await run(`INSERT INTO Projects (title, type, description, needed_members, owner_id) VALUES (?, ?, ?, ?, ?)`,
            [p.title, p.type, p.desc, p.members, students[idx].id]);
        }

        // --- 4. Applications ---
        // Student 9 applies to Smart Campus App (Project 1)
        await run(`INSERT INTO ProjectApplications (project_id, student_id, status) VALUES (1, ?, 'Accepted')`, [students[8].id]);
        // Student 10 applies to AI Medical Diagnostician (Project 2)
        await run(`INSERT INTO ProjectApplications (project_id, student_id, status) VALUES (2, ?, 'Accepted')`, [students[9].id]);
        // Student 11 applies to Course Project (Project 3)
        await run(`INSERT INTO ProjectApplications (project_id, student_id, status) VALUES (3, ?, 'Pending')`, [students[10].id]);

        // --- 5. Announcements ---
        const annCats = [
            { title: "TÜBİTAK 2209-A 2026 Term Call", cat: "TÜBİTAK Student Project", desc: "The 2026 first term call for the 2209-A University Students Research Projects Support Program is now active. Maximum budget: 7500 TL. Deadline: May 30th." },
            { title: "Teknofest 2026 Applications Open", cat: "Teknofest Student Project", desc: "Register your teams for the upcoming Teknofest 2026 competitions." },
            { title: "Software Engineering Capstone Info", cat: "Course Project", desc: "Mandatory info session for CS401 Capstone project on Friday at 14:00." }
        ];

        for (const ac of annCats) {
            const cat = await get(`SELECT id FROM ProjectCategories WHERE name = ?`, [ac.cat]);
            if (cat) {
                await run(`INSERT INTO Announcements (title, description, category_id, created_by) VALUES (?, ?, ?, 1)`,
                [ac.title, ac.desc, cat.id]);
            }
        }

        console.log("Seeding process completed. The database is now ready for production-level testing.");
    } catch (err) {
        console.error("Seeding error:", err);
    } finally {
        db.close();
    }
}

seed();
