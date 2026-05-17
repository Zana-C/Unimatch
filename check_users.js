const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.resolve(__dirname, 'unimatch.db'));

db.all("SELECT email, role FROM Users", (err, rows) => {
    if (err) console.error(err);
    console.log(JSON.stringify(rows, null, 2));
    db.close();
});
