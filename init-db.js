const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err);
    return;
  }
  
  // Create tables
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS problems (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        photo_url TEXT,
        description TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
        if (err) {
            console.error('Error creating table', err);
        } else {
            console.log('Problems table created or already exists.');
        }
    });
  });

  db.close((err) => {
      if (err) {
          console.error(err);
      } else {
          console.log('Database initialization complete.');
      }
  });
});
