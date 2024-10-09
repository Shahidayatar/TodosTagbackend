const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create or open the database
const db = new sqlite3.Database(path.join(__dirname, 'todos.db'), (err) => {
    if (err) {
        console.error('Error opening database ' + err.message);
    } else {
        console.log('Connected to the SQLite database.');

        // Create tables if they do not exist
        db.serialize(() => {
          db.run(`
              CREATE TABLE IF NOT EXISTS tags (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  title TEXT NOT NULL,
                  url TEXT
              )
          `);

          db.run(`
              CREATE TABLE IF NOT EXISTS todos (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  title TEXT NOT NULL,
                  task_order INTEGER DEFAULT 0,
                  completed BOOLEAN NOT NULL DEFAULT 0
              )
          `);

          db.run(`
            CREATE TABLE IF NOT EXISTS todo_tags (
              todo_id INTEGER,
              tag_id INTEGER,
              PRIMARY KEY (todo_id, tag_id),
              FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
              FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            )
          `);
      });
    }
});

// Export the database instance for use in routes
module.exports = db;
