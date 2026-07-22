const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer  = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer for image uploads (5MB Limit)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'public', 'uploads');
    // Ensure the uploads directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  }
});

// Database Connection
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Could not connect to database', err);
  else console.log('Connected to SQLite database');
});

// API Endpoints

// 1. Get all problems
app.get('/api/problems', (req, res) => {
  db.all('SELECT * FROM problems ORDER BY timestamp DESC', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// 2. Report a new problem
// multer upload.single('photo') handles the file upload and 5MB limit
app.post('/api/problems', (req, res) => {
  upload.single('photo')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading (e.g. fileSize limit)
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size limit exceeded. Maximum allowed size is 5MB.' });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      // An unknown error occurred
      return res.status(400).json({ error: err.message });
    }

    // No error, proceed to insert into database
    const { description, latitude, longitude } = req.body;
    let photoUrl = null;

    if (req.file) {
      photoUrl = '/uploads/' + req.file.filename;
    }

    // Simple validation
    if (!description || !latitude || !longitude) {
       return res.status(400).json({ error: 'Description and location are required.' });
    }

    const stmt = db.prepare(`
      INSERT INTO problems (photo_url, description, latitude, longitude)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run([photoUrl, description, latitude, longitude], function(err) {
      if (err) {
         res.status(500).json({ error: err.message });
         return;
      }
      res.status(201).json({ id: this.lastID, success: true });
    });
    stmt.finalize();
  });
});

app.listen(port, () => {
  console.log(`Vaisperia Server running at http://localhost:${port}`);
});
