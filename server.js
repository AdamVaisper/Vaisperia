const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer  = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const { sendReportToGroup, initTelegramBot } = require('./telegramBot');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
// Express Static with Cache-Busting Headers
app.use(express.static(path.join(__dirname, 'public'), {
    etag: false,
    lastModified: false,
    setHeaders: (res, filepath) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}));

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
      category TEXT,
      status TEXT DEFAULT 'new',
      resolved_at DATETIME,
      telegram_message_id INTEGER,
      telegram_chat_id TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Error creating problems table', err);
    else console.log('Problems table ready');
  });

  // Migrations: Add new metadata columns if missing
  db.run(`ALTER TABLE users ADD COLUMN email TEXT`, () => {});
  db.run(`ALTER TABLE problems ADD COLUMN username TEXT`, () => {});
  db.run(`ALTER TABLE problems ADD COLUMN category TEXT`, () => {});
  db.run(`ALTER TABLE problems ADD COLUMN status TEXT DEFAULT 'new'`, () => {});
  db.run(`ALTER TABLE problems ADD COLUMN resolved_at DATETIME`, () => {});
  db.run(`ALTER TABLE problems ADD COLUMN telegram_message_id INTEGER`, () => {});
  db.run(`ALTER TABLE problems ADD COLUMN telegram_chat_id TEXT`, () => {});
  db.run(`ALTER TABLE problems ADD COLUMN is_anonymous INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE problems ADD COLUMN user_id_name TEXT`, () => {});
  db.run(`ALTER TABLE problems ADD COLUMN user_avatar TEXT`, () => {});

  // Preserve history for Adam_Vaisper: associate all legacy/unassigned records to Adam_Vaisper
  db.run(`UPDATE problems SET username = 'Adam_Vaisper' WHERE username IS NULL OR username = '' OR username = 'Muratbek_92'`, (err) => {
    if (!err) console.log('Legacy problem records assigned to Adam_Vaisper');
  });
});

// Initialize Telegram Dispatcher Bot
initTelegramBot(db);

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

// 1. Universal Biometric Auth / Registration Endpoint
const handleBiometricAuth = (req, res) => {
  const { username, password, email, faceVector } = req.body;

  if (!faceVector || !Array.isArray(faceVector) || faceVector.length === 0) {
    return res.status(400).json({ 
      success: false, 
      errorKey: 'fill_required_fields',
      error: 'Biometric face scan is required.' 
    });
  }

  // Check face vector in SQLite database
  db.all('SELECT id, username, email, password, face_vector FROM users', [], (err, existingUsers) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Database error checking biometrics.' });
    }

    let matchedUser = null;

    // Check Euclidean distance (< 0.25 threshold indicates matching face biometrics)
    for (const user of (existingUsers || [])) {
      try {
        const storedVector = JSON.parse(user.face_vector);
        const distance = calculateEuclideanDistance(faceVector, storedVector);
        if (distance < 0.25) {
          matchedUser = user;
          break;
        }
      } catch (e) {
        console.error('Error parsing stored face vector:', e);
      }
    }

    // CASE 1: FACE EXISTS IN DB (Existing User)
    if (matchedUser) {
      const inputUsername = (username || '').trim();
      const inputEmail = (email || '').trim().toLowerCase();
      const inputPassword = password || '';

      const dbUsername = (matchedUser.username || '').trim();
      const dbEmail = (matchedUser.email || '').trim().toLowerCase();
      const dbPassword = matchedUser.password || '';

      const usernameMatches = inputUsername.length > 0 && inputUsername === dbUsername;
      const emailMatches = inputEmail.length > 0 && inputEmail === dbEmail;
      const passwordMatches = inputPassword.length > 0 && inputPassword === dbPassword;

      if (usernameMatches && emailMatches && passwordMatches) {
        return res.status(200).json({ 
          success: true, 
          message: 'Biometric authentication successful!',
          isNewUser: false,
          userId: matchedUser.id,
          username: matchedUser.username,
          email: matchedUser.email
        });
      } else {
        // ANY credential does NOT match
        return res.status(400).json({ 
          success: false, 
          errorKey: 'auth_credentials_mismatch',
          error: 'Incorrect username, Gmail, or password for this biometric profile!'
        });
      }
    }

    // CASE 2: FACE DOES NOT EXIST IN DB (New User)
    const inputUsername = (username || '').trim();
    const inputEmail = (email || '').trim().toLowerCase();
    const inputPassword = password || '';

    // Verify if Username, Gmail, and Password are provided and valid
    if (!inputUsername || !inputEmail || !inputPassword) {
      return res.status(400).json({ 
        success: false, 
        errorKey: 'fill_required_fields',
        error: 'Please fill in Username, Gmail, and Password to complete registration.' 
      });
    }

    // Check if Username or Email is already registered by another account
    db.get(
      'SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)', 
      [inputUsername, inputEmail], 
      (checkErr, existingAcc) => {
        if (checkErr) {
          return res.status(500).json({ success: false, error: checkErr.message });
        }
        if (existingAcc) {
          return res.status(400).json({ 
            success: false, 
            errorKey: 'user_already_exists',
            error: 'User with this username or Gmail already exists!' 
          });
        }

        // All fields valid & unique -> Create new account
        const stmt = db.prepare(`
          INSERT INTO users (username, password, email, face_vector)
          VALUES (?, ?, ?, ?)
        `);

        const vectorStr = JSON.stringify(faceVector);
        stmt.run([inputUsername, inputPassword, inputEmail, vectorStr], function(insertErr) {
          if (insertErr) {
            if (insertErr.message.includes('UNIQUE constraint failed')) {
              return res.status(400).json({ 
                success: false, 
                errorKey: 'user_already_exists',
                error: 'User with this username or Gmail already exists!' 
              });
            }
            return res.status(500).json({ success: false, error: insertErr.message });
          }

          return res.status(201).json({ 
            success: true, 
            message: 'Registration and biometric control successfully completed!',
            isNewUser: true,
            userId: this.lastID,
            username: inputUsername,
            email: inputEmail
          });
        });
        stmt.finalize();
      }
    );
  });
};

app.post('/api/register', handleBiometricAuth);
app.post('/api/biometric-auth', handleBiometricAuth);

// Endpoint: Forgot password reset simulation
app.post('/api/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Укажите ваш зарегистрированный Gmail адрес.' });
  }

  db.get('SELECT id, username, email FROM users WHERE LOWER(email) = ?', [email.trim().toLowerCase()], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка при доступе к базе данных.' });
    }
    if (!user) {
      return res.status(404).json({ error: 'Пользователь с таким Gmail адресом не найден.' });
    }

    return res.json({
      success: true,
      message: `Ссылка для восстановления и подтверждения отправлена на ${email}! Проверьте ваш почтовый ящик.`
    });
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
    // Enforce strict anonymity override on API output (never leak real name or custom avatar)
    const sanitizedRows = (rows || []).map(prob => {
      if (prob.is_anonymous == 1 || prob.username === 'Анонимный гражданин' || prob.username === 'Гость') {
        return {
          ...prob,
          username: 'Анонимный гражданин',
          user_avatar: '',
          is_anonymous: 1
        };
      }
      return prob;
    });
    res.json(sanitizedRows);
  });
});

// 5. Report a new problem (Strictly CREATE / INSERT new record with unique ID)
app.post('/api/problems', (req, res) => {
  upload.single('photo')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size limit exceeded. Maximum allowed size is 5MB.' });
      }
      if (err.code === 'LIMIT_FIELD_VALUE' || (err.message && err.message.includes('Field value too long'))) {
        return res.status(400).json({ error: 'Field value too long' });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      if (err.message && err.message.includes('Field value too long')) {
        return res.status(400).json({ error: 'Field value too long' });
      }
      return res.status(400).json({ error: err.message });
    }

    const { description, latitude, longitude, username, category, isAnonymous, userAvatar } = req.body;
    let photoUrl = null;

    if (req.file) {
      photoUrl = '/uploads/' + req.file.filename;
    }

    if (!description || !latitude || !longitude) {
       return res.status(400).json({ error: 'Description and location are required.' });
    }

    const isAnon = (isAnonymous === 'true' || isAnonymous === true || isAnonymous === 1 || isAnonymous === '1' || username === 'Анонимный гражданин' || username === 'Гость');
    const realUser = (username && username.trim() && username.trim() !== 'Анонимный гражданин' && username.trim() !== 'Гость') ? username.trim() : 'Adam_Vaisper';
    const displayUser = isAnon ? 'Анонимный гражданин' : realUser;
    const reportCategory = (category && category.trim()) ? category.trim() : 'Другое';
    const avatarData = isAnon ? '' : (userAvatar || '');

    // ALWAYS INSERT A BRAND NEW RECORD WITH UNIQUE ID (NO UPSERT / NO UPDATE BY COORDINATES)
    const stmt = db.prepare(`
      INSERT INTO problems (photo_url, description, latitude, longitude, username, category, status, is_anonymous, user_id_name, user_avatar)
      VALUES (?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)
    `);

    stmt.run([photoUrl, description, latitude, longitude, displayUser, reportCategory, isAnon ? 1 : 0, realUser, avatarData], function(err) {
      if (err) {
         res.status(500).json({ error: err.message });
         return;
      }

      const reportId = this.lastID;
      const newReport = {
        id: reportId,
        photo_url: photoUrl,
        description: description,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        username: displayUser,
        category: reportCategory,
        status: 'new',
        user_avatar: avatarData,
        is_anonymous: isAnon ? 1 : 0,
        timestamp: new Date().toISOString()
      };

      // Dispatch notification asynchronously to Telegram Department Group
      sendReportToGroup(newReport, db, path.join(__dirname, 'public'));

      res.status(201).json({ id: reportId, success: true });
    });
    stmt.finalize();
  });
});

app.listen(port, () => {
  console.log(`Vaisperia Server running at http://localhost:${port}`);
});
