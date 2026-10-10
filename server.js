const express = require('express');
const { Pool } = require('pg');
const multer  = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const { sendReportToGroup, initTelegramBot } = require('./telegramBot');

const app = express();
const PORT = process.env.PORT || 10000;

// Load .env if present
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...vals] = trimmed.split('=');
      if (key && vals.length > 0) {
        process.env[key.trim()] = vals.join('=').trim();
      }
    }
  });
}

// PostgreSQL Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.gfbukhbuuemxsensrsvm:Nuraysfan09@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

// Middleware
// CORS Configuration
const allowedOrigins = [
  'https://vaisperia.uz',
  'https://www.vaisperia.uz'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
      /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) ||
      origin.includes('vaisperia.onrender.com')
    ) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true
}));

// Subdomain Redirect (vaisperia.onrender.com -> vaisperia.uz)
app.use((req, res, next) => {
  const host = (req.headers.host || '').toLowerCase();
  if (host.includes('vaisperia.onrender.com')) {
    // Ensure API endpoints (e.g. /api/*) or webhooks are not broken during this redirect
    if (req.path.startsWith('/api') || req.path.startsWith('/webhook')) {
      return next();
    }
    return res.redirect(301, `https://vaisperia.uz${req.originalUrl}`);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
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
// Explicitly serve /uploads so photo_url links always resolve correctly
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads'), {
    etag: false,
    lastModified: false,
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}));


// Configure Multer for image uploads (5MB Limit)
const storage = multer.memoryStorage();

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

// Ensure tables exist on startup
async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        face_vector TEXT NOT NULL,
        email TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Users table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS problems (
        id SERIAL PRIMARY KEY,
        photo_url TEXT,
        description TEXT NOT NULL,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        username TEXT,
        category TEXT,
        status TEXT DEFAULT 'new',
        resolved_at TIMESTAMPTZ,
        telegram_message_id BIGINT,
        telegram_chat_id TEXT,
        is_anonymous INTEGER DEFAULT 0,
        user_id_name TEXT,
        user_avatar TEXT,
        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Problems table ready');

    // Add columns if missing (idempotent)
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;`);
    await pool.query(`ALTER TABLE problems ADD COLUMN IF NOT EXISTS username TEXT;`);
    await pool.query(`ALTER TABLE problems ADD COLUMN IF NOT EXISTS category TEXT;`);
    await pool.query(`ALTER TABLE problems ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new';`);
    await pool.query(`ALTER TABLE problems ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;`);
    await pool.query(`ALTER TABLE problems ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT;`);
    await pool.query(`ALTER TABLE problems ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;`);
    await pool.query(`ALTER TABLE problems ADD COLUMN IF NOT EXISTS is_anonymous INTEGER DEFAULT 0;`);
    await pool.query(`ALTER TABLE problems ADD COLUMN IF NOT EXISTS user_id_name TEXT;`);
    await pool.query(`ALTER TABLE problems ADD COLUMN IF NOT EXISTS user_avatar TEXT;`);

    // Preserve history: assign legacy/unassigned records to Adam_Vaisper
    await pool.query(`
      UPDATE problems SET username = 'Adam_Vaisper'
      WHERE username IS NULL OR username = '' OR username = 'Muratbek_92'
    `);
    console.log('Legacy problem records assigned to Adam_Vaisper');
    console.log('Connected to PostgreSQL (Supabase)');
  } catch (err) {
    console.error('DB init error:', err.message);
  }
}

// Initialize Telegram Dispatcher Bot (pass pool so telegramBot can run pg queries)
initDb().then(() => {
  initTelegramBot(pool);
});

// Helper: Robust Date Parsing to Epoch Milliseconds
function parseDateMs(dateVal) {
  if (!dateVal) return null;
  if (typeof dateVal === 'number') return dateVal;
  if (dateVal instanceof Date) return dateVal.getTime();
  let str = String(dateVal).trim();
  if (!str.includes('T') && !str.includes('Z') && str.includes(' ')) {
    str = str.replace(' ', 'T') + 'Z';
  } else if (!str.endsWith('Z') && !str.includes('+') && str.includes('T')) {
    str = str + 'Z';
  }
  const ms = Date.parse(str);
  return isNaN(ms) ? null : ms;
}

// Backend Report Lifecycle Worker
// Rules:
// 1. Red (new): After 24 hours from creation timestamp -> automatically transition to Yellow (in_progress). Never deleted.
// 2. Yellow (in_progress): Indefinite. Never archived by cleanup tasks.
// 3. Green (resolved): After 24h from resolution -> status set to 'archived' (hidden from map, preserved in DB for history).
async function updateReportLifecycle() {
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  try {
    // 🔴 new -> 🟡 in_progress after 24h from creation
    const updateResult = await pool.query(`
      UPDATE problems
      SET status = 'in_progress'
      WHERE status = 'new'
        AND timestamp IS NOT NULL
        AND (EXTRACT(EPOCH FROM (NOW() - timestamp)) * 1000) >= $1
      RETURNING id
    `, [TWENTY_FOUR_HOURS_MS]);
    if (updateResult.rowCount > 0) {
      console.log(`[Lifecycle] Auto-updated ${updateResult.rowCount} report(s) from 'new' to 'in_progress' (>=24h old)`);
    }

    // 🟢 resolved -> 🗄 archived after 24h from resolved_at (record stays in DB, hidden from map)
    const archiveResult = await pool.query(`
      UPDATE problems
      SET status = 'archived'
      WHERE status = 'resolved'
        AND resolved_at IS NOT NULL
        AND (EXTRACT(EPOCH FROM (NOW() - resolved_at)) * 1000) >= $1
      RETURNING id
    `, [TWENTY_FOUR_HOURS_MS]);
    if (archiveResult.rowCount > 0) {
      console.log(`[Lifecycle] Auto-archived ${archiveResult.rowCount} resolved report(s) (resolved >=24h ago) — records preserved in DB`);
    }
  } catch (err) {
    console.error('Error in updateReportLifecycle:', err.message);
  }
}

// Start periodic background lifecycle worker (every 60 seconds)
setInterval(() => {
  updateReportLifecycle();
}, 60 * 1000);

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

// Admin Authentication Helper
function verifyAdminAuth(req) {
  const pass = req.headers['x-admin-password'] || req.query.password || (req.body && (req.body.adminPassword || req.body.password));
  const expected = process.env.ADMIN_PASSWORD || 'Nuraysfan09';
  return pass === expected;
}

// API Endpoints

// 1. Universal Biometric Auth / Registration / Login Endpoint
const handleBiometricAuth = async (req, res) => {
  const { username, password, email, faceVector } = req.body;
  const isLoginModeRequest = req.path === '/api/login';

  if (!faceVector || !Array.isArray(faceVector) || faceVector.length === 0) {
    return res.status(400).json({ 
      success: false, 
      errorKey: 'fill_required_fields',
      error: 'Biometric face scan is required.' 
    });
  }

  try {
    // Check face vector in PostgreSQL database
    const { rows: existingUsers } = await pool.query(
      'SELECT id, username, email, password, face_vector FROM users'
    );

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

    // CASE 1: FACE MATCHES AN EXISTING USER IN DB
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

      if ((usernameMatches || emailMatches) && passwordMatches) {
        // Track login activity
        try {
          await pool.query(
            'UPDATE users SET login_count = COALESCE(login_count, 0) + 1, last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
            [matchedUser.id]
          );
        } catch (uErr) {
          console.error('Error updating login activity stats:', uErr);
        }

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

    // CASE 2: FACE DID NOT MATCH BY DISTANCE (< 0.25)
    const inputUsername = (username || '').trim();
    const inputEmail = (email || '').trim().toLowerCase();
    const inputPassword = password || '';

    // If request was sent to /api/login (LOGIN MODE)
    if (isLoginModeRequest) {
      if (!inputUsername && !inputEmail) {
        return res.status(400).json({
          success: false,
          errorKey: 'fill_required_fields',
          error: 'Please fill in Username or Gmail and Password.'
        });
      }

      // Find user by username or email
      const { rows: matchedByCreds } = await pool.query(
        'SELECT id, username, email, password FROM users WHERE (LOWER(username) = LOWER($1) AND $1 != \'\') OR (LOWER(email) = LOWER($2) AND $2 != \'\')',
        [inputUsername, inputEmail]
      );

      if (matchedByCreds.length > 0) {
        const u = matchedByCreds[0];
        if (inputPassword && inputPassword === u.password) {
          // Password matches -> update face vector to new capture & update login activity
          const vectorStr = JSON.stringify(faceVector);
          try {
            await pool.query(
              'UPDATE users SET face_vector = $1, login_count = COALESCE(login_count, 0) + 1, last_login_at = CURRENT_TIMESTAMP WHERE id = $2',
              [vectorStr, u.id]
            );
          } catch (uErr) {
            console.error('Error updating face vector on login:', uErr);
          }

          return res.status(200).json({
            success: true,
            message: 'Biometric authentication successful!',
            isNewUser: false,
            userId: u.id,
            username: u.username,
            email: u.email
          });
        } else {
          return res.status(400).json({
            success: false,
            errorKey: 'auth_credentials_mismatch',
            error: 'Incorrect username, Gmail, or password!'
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          errorKey: 'user_not_found',
          error: 'User with this username or Gmail not found!'
        });
      }
    }

    // Otherwise: REGISTER MODE (/api/register or /api/biometric-auth)

    // Verify if Username, Gmail, and Password are provided and valid
    if (!inputUsername || !inputEmail || !inputPassword) {
      return res.status(400).json({ 
        success: false, 
        errorKey: 'fill_required_fields',
        error: 'Please fill in Username, Gmail, and Password to complete registration.' 
      });
    }

    // Check if Username or Email is already registered by another account
    const { rows: existingAcc } = await pool.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)', 
      [inputUsername, inputEmail]
    );
    if (existingAcc.length > 0) {
      return res.status(400).json({ 
        success: false, 
        errorKey: 'user_already_exists',
        error: 'User with this username or Gmail already exists!' 
      });
    }

    // All fields valid & unique -> Create new account
    const vectorStr = JSON.stringify(faceVector);
    const insertResult = await pool.query(
      `INSERT INTO users (username, password, email, face_vector, login_count, last_login_at) VALUES ($1, $2, $3, $4, 1, CURRENT_TIMESTAMP) RETURNING id`,
      [inputUsername, inputPassword, inputEmail, vectorStr]
    );

    return res.status(201).json({ 
      success: true, 
      message: 'Registration and biometric control successfully completed!',
      isNewUser: true,
      userId: insertResult.rows[0].id,
      username: inputUsername,
      email: inputEmail
    });

  } catch (err) {
    if (err.message && (err.message.includes('unique') || err.message.includes('duplicate'))) {
      return res.status(400).json({ 
        success: false, 
        errorKey: 'user_already_exists',
        error: 'User with this username or Gmail already exists!' 
      });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
};

app.post('/api/register', handleBiometricAuth);
app.post('/api/login', handleBiometricAuth);
app.post('/api/biometric-auth', handleBiometricAuth);

// Endpoint: Forgot password reset simulation
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Укажите ваш зарегистрированный Gmail адрес.' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, username, email FROM users WHERE LOWER(email) = $1',
      [email.trim().toLowerCase()]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь с таким Gmail адресом не найден.' });
    }

    return res.json({
      success: true,
      message: `Ссылка для восстановления и подтверждения отправлена на ${email}! Проверьте ваш почтовый ящик.`
    });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка при доступе к базе данных.' });
  }
});

// 2. Protected Admin Endpoints

// GET /api/admin/stats - Executive Smart City Analytics
app.get('/api/admin/stats', async (req, res) => {
  if (!verifyAdminAuth(req)) {
    return res.status(403).json({ error: 'Доступ запрещен. Неверный пароль администратора.' });
  }

  try {
    const usersRes = await pool.query('SELECT COUNT(*) FROM users');
    const totalUsers = parseInt(usersRes.rows[0].count, 10) || 0;

    const allTimeRes = await pool.query('SELECT COUNT(*) FROM problems');
    const allTimeReports = parseInt(allTimeRes.rows[0].count, 10) || 0;

    const monthRes = await pool.query(
      "SELECT COUNT(*) FROM problems WHERE timestamp >= DATE_TRUNC('month', CURRENT_TIMESTAMP)"
    );
    const monthReports = parseInt(monthRes.rows[0].count, 10) || 0;

    const weekRes = await pool.query(
      "SELECT COUNT(*) FROM problems WHERE timestamp >= DATE_TRUNC('week', CURRENT_TIMESTAMP)"
    );
    const weekReports = parseInt(weekRes.rows[0].count, 10) || 0;

    const statusRes = await pool.query('SELECT status, COUNT(*) FROM problems GROUP BY status');
    const statusCounts = { new: 0, in_progress: 0, resolved: 0, archived: 0 };
    statusRes.rows.forEach(r => {
      const st = r.status || 'new';
      statusCounts[st] = parseInt(r.count, 10) || 0;
    });

    const activeIssues = statusCounts.new + statusCounts.in_progress;
    // Count both currently-resolved and archived (which were previously resolved) for the rate
    const resolvedCount = statusCounts.resolved + statusCounts.archived;
    const resolutionRate = allTimeReports > 0 ? ((resolvedCount / allTimeReports) * 100).toFixed(1) + '%' : '0%';

    res.json({
      success: true,
      totalUsers,
      reports: {
        allTime: allTimeReports,
        thisMonth: monthReports,
        thisWeek: weekReports
      },
      statusBreakdown: statusCounts,
      activeIssues,
      resolutionRate
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/users - Citizen Registry with detailed metrics
app.get('/api/admin/users', async (req, res) => {
  if (!verifyAdminAuth(req)) {
    return res.status(403).json({ error: 'Доступ запрещен. Неверный пароль администратора.' });
  }

  try {
    const { rows } = await pool.query(`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.created_at,
        COALESCE(u.login_count, 0) AS login_count,
        u.last_login_at,
        COUNT(p.id) AS total_reports,
        COUNT(CASE WHEN p.timestamp >= DATE_TRUNC('month', CURRENT_TIMESTAMP) THEN 1 END) AS month_reports
      FROM users u
      LEFT JOIN problems p ON (LOWER(p.user_id_name) = LOWER(u.username) OR LOWER(p.username) = LOWER(u.username))
      GROUP BY u.id, u.username, u.email, u.created_at, u.login_count, u.last_login_at
      ORDER BY u.created_at DESC
    `);

    res.json({
      success: true,
      totalUsers: rows.length,
      users: rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/impersonate - Admin User Impersonation Endpoint
app.post('/api/admin/impersonate', async (req, res) => {
  if (!verifyAdminAuth(req)) {
    return res.status(403).json({ error: 'Доступ запрещен. Неверный пароль администратора.' });
  }

  const { userId, username } = req.body;
  if (!userId && !username) {
    return res.status(400).json({ error: 'Укажите ID или никнейм пользователя для имперсонации.' });
  }

  try {
    let userQuery;
    let params;
    if (userId) {
      userQuery = 'SELECT id, username, email FROM users WHERE id = $1';
      params = [userId];
    } else {
      userQuery = 'SELECT id, username, email FROM users WHERE LOWER(username) = LOWER($1)';
      params = [username];
    }

    const { rows } = await pool.query(userQuery, params);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден.' });
    }

    const targetUser = rows[0];

    // Increment login count for impersonated session
    await pool.query(
      'UPDATE users SET login_count = COALESCE(login_count, 0) + 1, last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [targetUser.id]
    );

    res.json({
      success: true,
      message: `Успешная инициализация сессии для пользователя ${targetUser.username}!`,
      user: {
        userId: targetUser.id,
        username: targetUser.username,
        email: targetUser.email || `${targetUser.username.toLowerCase()}@vaisperia.uz`
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Serve Admin Panel Page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 4. Get all problems
app.get('/api/problems', async (req, res) => {
  try {
    await updateReportLifecycle();
  } catch (lifecycleErr) {
    console.error('Error executing lifecycle update on GET /api/problems:', lifecycleErr);
  }

  try {
    // Exclude archived reports from map view (archived = resolved >24h ago, kept in DB for history)
    const { rows } = await pool.query("SELECT * FROM problems WHERE status != 'archived' ORDER BY timestamp DESC");
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user specific reports history from Supabase (PostgreSQL)
app.get('/api/user-reports', async (req, res) => {
  const username = req.query.username;
  if (!username) {
    return res.status(400).json({ error: 'Username query parameter is required.' });
  }

  try {
    await updateReportLifecycle();
  } catch (lifecycleErr) {
    console.error('Error executing lifecycle update on GET /api/user-reports:', lifecycleErr);
  }

  try {
    const { rows } = await pool.query(
      `SELECT * FROM problems 
       WHERE LOWER(username) = LOWER($1) OR LOWER(user_id_name) = LOWER($1) 
       ORDER BY timestamp DESC`,
      [username]
    );

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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/user-reports/:username', async (req, res) => {
  const { username } = req.params;
  if (!username) {
    return res.status(400).json({ error: 'Username is required.' });
  }

  try {
    await updateReportLifecycle();
  } catch (lifecycleErr) {
    console.error('Error executing lifecycle update on GET /api/user-reports/:username:', lifecycleErr);
  }

  try {
    const { rows } = await pool.query(
      `SELECT * FROM problems 
       WHERE LOWER(username) = LOWER($1) OR LOWER(user_id_name) = LOWER($1) 
       ORDER BY timestamp DESC`,
      [username]
    );

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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Report a new problem (Strictly CREATE / INSERT new record with unique ID)
app.post('/api/problems', (req, res) => {
  upload.single('photo')(req, res, async function (err) {
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
      const base64Data = req.file.buffer.toString('base64');
      photoUrl = `data:${req.file.mimetype};base64,${base64Data}`;
    }

    if (!description || !latitude || !longitude) {
       return res.status(400).json({ error: 'Description and location are required.' });
    }

    const isAnon = (isAnonymous === 'true' || isAnonymous === true || isAnonymous === 1 || isAnonymous === '1' || username === 'Анонимный гражданин' || username === 'Гость');
    const realUser = (username && username.trim() && username.trim() !== 'Анонимный гражданин' && username.trim() !== 'Гость') ? username.trim() : 'Adam_Vaisper';
    const displayUser = isAnon ? 'Анонимный гражданин' : realUser;
    const reportCategory = (category && category.trim()) ? category.trim() : 'Другое';
    const avatarData = isAnon ? '' : (userAvatar || '');

    try {
      // ALWAYS INSERT A BRAND NEW RECORD WITH UNIQUE ID (NO UPSERT / NO UPDATE BY COORDINATES)
      const result = await pool.query(`
        INSERT INTO problems (photo_url, description, latitude, longitude, username, category, status, is_anonymous, user_id_name, user_avatar)
        VALUES ($1, $2, $3, $4, $5, $6, 'new', $7, $8, $9)
        RETURNING id, timestamp
      `, [photoUrl, description, latitude, longitude, displayUser, reportCategory, isAnon ? 1 : 0, realUser, avatarData]);

      const reportId = result.rows[0].id;
      const reportTimestamp = result.rows[0].timestamp;
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
        timestamp: reportTimestamp ? reportTimestamp.toISOString() : new Date().toISOString()
      };

      // Dispatch notification asynchronously to Telegram Department Group
      sendReportToGroup(newReport, pool, path.join(__dirname, 'public'));

      res.status(201).json({ id: reportId, success: true });
    } catch (insertErr) {
      res.status(500).json({ error: insertErr.message });
    }
  });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Vaisperia Server running at http://0.0.0.0:${PORT}`);
});

server.keepAliveTimeout = 120000;
server.headersTimeout = 120000;
