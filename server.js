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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
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

// Ensure Users and Problems tables exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      face_vector TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Error creating users table', err);
    else console.log('Users table ready');
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS problems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      photo_url TEXT,
      description TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      username TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Error creating problems table', err);
    else console.log('Problems table ready');
  });

  // Migration: Add username column to problems if missing
  db.run(`ALTER TABLE problems ADD COLUMN username TEXT`, (err) => {
    // Column already exists or table freshly created
  });

  // Preserve history for Adam_Vaisper: associate all legacy/unassigned records to Adam_Vaisper
  db.run(`UPDATE problems SET username = 'Adam_Vaisper' WHERE username IS NULL OR username = '' OR username = 'Muratbek_92'`, (err) => {
    if (!err) console.log('Legacy problem records assigned to Adam_Vaisper');
  });
});

// Helper: Calculate Euclidean Distance between 2 vectors
function calculateEuclideanDistance(v1, v2) {
  if (!v1 || !v2 || v1.length !== v2.length || v1.length === 0) return 999;
  let sum = 0;
  for (let i = 0; i < v1.length; i++) {
    const diff = v1[i] - v2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

// API Endpoints

// 1. Biometric User Registration
app.post('/api/register', (req, res) => {
  const { username, password, faceVector } = req.body;

  if (!username || !password || !faceVector || !Array.isArray(faceVector)) {
    return res.status(400).json({ error: 'Пожалуйста, заполните все поля и пройдите биометрию.' });
  }

  // Check biometric uniqueness against existing vectors in SQLite
  db.all('SELECT id, username, face_vector FROM users', [], (err, existingUsers) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка проверки биометрии в базе данных.' });
    }

    // Check Euclidean distance threshold (< 0.25 indicates matching face biometrics)
    for (const user of existingUsers) {
      try {
        const storedVector = JSON.parse(user.face_vector);
        const distance = calculateEuclideanDistance(faceVector, storedVector);
        if (distance < 0.25) {
          return res.status(400).json({ 
            error: `Пользователь с такой биометрией уже зарегистрирован!`
          });
        }
      } catch (e) {
        console.error('Error parsing stored face vector:', e);
      }
    }

    // Insert unique user into DB
    const stmt = db.prepare(`
      INSERT INTO users (username, password, face_vector)
      VALUES (?, ?, ?)
    `);

    const vectorStr = JSON.stringify(faceVector);
    stmt.run([username.trim(), password, vectorStr], function(insertErr) {
      if (insertErr) {
        if (insertErr.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Пользователь с таким именем уже существует!' });
        }
        return res.status(500).json({ error: insertErr.message });
      }

      res.status(201).json({ 
        success: true, 
        message: 'Регистрация и биометрический контроль успешно пройдены!',
        userId: this.lastID,
        username: username.trim()
      });
    });
    stmt.finalize();
  });
});

// 2. Protected Admin Endpoint: User list & statistics
app.get('/api/admin/users', (req, res) => {
  const adminPass = req.headers['x-admin-password'] || req.query.password;
  if (adminPass !== 'admin123') {
    return res.status(403).json({ error: 'Доступ запрещен. Неверный пароль администратора.' });
  }

  db.all('SELECT id, username, created_at FROM users ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({
      success: true,
      totalUsers: rows.length,
      users: rows
    });
  });
});

// 3. Serve Admin Panel Page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 4. Get all problems
app.get('/api/problems', (req, res) => {
  db.all('SELECT * FROM problems ORDER BY timestamp DESC', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// 5. Report a new problem
app.post('/api/problems', (req, res) => {
  upload.single('photo')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size limit exceeded. Maximum allowed size is 5MB.' });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    const { description, latitude, longitude, username } = req.body;
    let photoUrl = null;

    if (req.file) {
      photoUrl = '/uploads/' + req.file.filename;
    }

    if (!description || !latitude || !longitude) {
       return res.status(400).json({ error: 'Description and location are required.' });
    }

    const submitter = (username && username.trim()) ? username.trim() : 'Adam_Vaisper';

    const stmt = db.prepare(`
      INSERT INTO problems (photo_url, description, latitude, longitude, username)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run([photoUrl, description, latitude, longitude, submitter], function(err) {
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
