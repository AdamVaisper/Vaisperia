const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

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

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.gfbukhbuuemxsensrsvm:Nuraysfan09@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function initDb() {
  try {
    console.log('Connecting to PostgreSQL database...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        face_vector TEXT NOT NULL,
        email TEXT,
        login_count INTEGER DEFAULT 0,
        last_login_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Users table created or already exists.');

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
    console.log('Problems table created or already exists.');

    // Add metadata columns if missing
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;`);
    await pool.query(`ALTER TABLE problems ADD COLUMN IF NOT EXISTS username TEXT;`);
    await pool.query(`ALTER TABLE problems ADD COLUMN IF NOT EXISTS category TEXT;`);
    await pool.query(`ALTER TABLE problems ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new';`);
    await pool.query(`ALTER TABLE problems ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;`);
    await pool.query(`ALTER TABLE problems ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT;`);
    await pool.query(`ALTER TABLE problems ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;`);
    await pool.query(`ALTER TABLE problems ADD COLUMN IF NOT EXISTS is_anonymous INTEGER DEFAULT 0;`);
    await pool.query(`ALTER TABLE problems ADD COLUMN IF NOT EXISTS user_id_name TEXT;`);
    await pool.query(`ALTER TABLE problems ADD COLUMN IF NOT EXISTS user_avatar TEXT;`);

    console.log('Database initialization complete.');
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    await pool.end();
  }
}

initDb();
