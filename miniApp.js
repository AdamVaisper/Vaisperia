// Vaisperia — department Telegram Mini App backend (isolated module).
// Uses only existing `problems` columns (status, resolved_at, telegram_*): no schema changes.
const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const bot = require('./telegramBot');

const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // Telegram Bot API upload limit
const INIT_DATA_MAX_AGE_SEC = 24 * 60 * 60;
const MEMBER_CACHE_MS = 5 * 60 * 1000;

// Department -> categories it owns. Khokimiyat additionally owns everything not routed elsewhere
// (mirrors CHAT_ROUTING fallback in telegramBot.js).
const DEPT_CATEGORIES = {
  ubdd: ['Дороги'],
  water: ['Вода'],
  res: ['Электричество'],
  ecology: ['Мусор'],
  khokimiyat: ['Здания', 'Другое']
};
const ROUTED_ELSEWHERE = ['Дороги', 'Вода', 'Электричество', 'Мусор'];

function deptWhere(dept, startIndex) {
  if (dept === 'khokimiyat') {
    return { sql: `(category IS NULL OR category <> ALL($${startIndex}::text[]))`, params: [ROUTED_ELSEWHERE] };
  }
  return { sql: `category = ANY($${startIndex}::text[])`, params: [DEPT_CATEGORIES[dept]] };
}

// ---- Telegram WebApp initData verification (https://core.telegram.org/bots/webapps) ----
function verifyInitData(initData) {
  if (!initData || typeof initData !== 'string') return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(bot.TELEGRAM_BOT_TOKEN).digest();
  const calc = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  const a = Buffer.from(calc, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const authDate = parseInt(params.get('auth_date'), 10);
  if (!authDate || (Date.now() / 1000 - authDate) > INIT_DATA_MAX_AGE_SEC) return null;
  let user = null;
  try { user = JSON.parse(params.get('user') || 'null'); } catch (e) { user = null; }
  if (!user || !user.id) return null;
  return { user, startParam: params.get('start_param') || '' };
}

const memberCache = new Map(); // `${chatId}:${userId}` -> { ok, at }
async function isGroupMember(chatId, userId) {
  const key = `${chatId}:${userId}`;
  const hit = memberCache.get(key);
  if (hit && Date.now() - hit.at < MEMBER_CACHE_MS) return hit.ok;
  let ok = false;
  try {
    const r = await bot.callTelegramApi('getChatMember', { chat_id: chatId, user_id: userId });
    const s = r && r.ok && r.result ? r.result.status : '';
    ok = s === 'creator' || s === 'administrator' || s === 'member' || (s === 'restricted' && r.result.is_member);
  } catch (e) {
    ok = false;
  }
  memberCache.set(key, { ok, at: Date.now() });
  return ok;
}

// Middleware: valid Telegram session + membership in the department's group
async function requireDeptSession(req, res, next) {
  const session = verifyInitData(req.headers['x-telegram-init-data']);
  if (!session) return res.status(401).json({ error: 'Откройте приложение из Telegram-группы службы.' });
  const dept = String(session.startParam || req.headers['x-miniapp-dept'] || '').toLowerCase();
  if (!DEPT_CATEGORIES[dept]) return res.status(400).json({ error: 'Служба не определена. Откройте приложение по кнопке в группе.' });
  const chatId = bot.DEPT_CHATS[dept];
  if (!(await isGroupMember(chatId, session.user.id))) {
    return res.status(403).json({ error: 'Доступ только для участников группы службы.' });
  }
  req.mini = { dept, chatId, user: session.user };
  next();
}

function userTag(u) {
  return u.username ? `@${u.username}` : ([u.first_name, u.last_name].filter(Boolean).join(' ') || 'Сотрудник');
}

// Public projection: no author / personal data
function publicRow(p) {
  return {
    id: p.id,
    category: p.category || 'Другое',
    status: p.status,
    description: p.description,
    latitude: p.latitude,
    longitude: p.longitude,
    photo_url: p.photo_url || null,
    timestamp: p.timestamp,
    resolved_at: p.resolved_at
  };
}

async function loadOwned(pool, dept, id) {
  const w = deptWhere(dept, 2);
  const { rows } = await pool.query(`SELECT * FROM problems WHERE id = $1 AND ${w.sql}`, [id, ...w.params]);
  return rows[0] || null;
}

const videoUpload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (req, file, cb) => cb(null, `vaisperia-proof-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`)
  }),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 1 },
  fileFilter: (req, file, cb) => cb(null, /^video\//i.test(file.mimetype || ''))
}).single('video');

function registerMiniApp(app, pool) {
  app.get('/api/miniapp/session', requireDeptSession, (req, res) => {
    res.json({ dept: req.mini.dept, title: bot.DEPT_TITLES[req.mini.dept], user: { name: userTag(req.mini.user) } });
  });

  // Queue: new / in_progress strictly FIFO (oldest first); resolved = latest archive first
  app.get('/api/miniapp/reports', requireDeptSession, async (req, res) => {
    const tab = String(req.query.tab || 'new');
    const w = deptWhere(req.mini.dept, 1);
    let sql;
    if (tab === 'new') {
      sql = `SELECT * FROM problems WHERE status = 'new' AND ${w.sql} ORDER BY timestamp ASC, id ASC`;
    } else if (tab === 'in_progress') {
      sql = `SELECT * FROM problems WHERE status = 'in_progress' AND ${w.sql} ORDER BY timestamp ASC, id ASC`;
    } else if (tab === 'resolved') {
      sql = `SELECT * FROM problems WHERE status IN ('resolved','archived') AND ${w.sql} ORDER BY resolved_at DESC NULLS LAST, id DESC LIMIT 200`;
    } else {
      return res.status(400).json({ error: 'Неизвестная вкладка.' });
    }
    try {
      const { rows } = await pool.query(sql, w.params);
      res.json({ items: rows.map(publicRow) });
    } catch (e) {
      res.status(500).json({ error: 'Ошибка базы данных.' });
    }
  });

  // new -> in_progress (atomic; only if still new)
  app.post('/api/miniapp/reports/:id/take', requireDeptSession, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'Некорректный ID.' });
    try {
      const owned = await loadOwned(pool, req.mini.dept, id);
      if (!owned) return res.status(404).json({ error: 'Заявка не найдена в очереди вашей службы.' });
      const { rows } = await pool.query(
        `UPDATE problems SET status = 'in_progress' WHERE id = $1 AND status = 'new' RETURNING *`, [id]
      );
      if (!rows[0]) return res.status(409).json({ error: 'Заявка уже взята в работу или закрыта.' });
      const tag = bot.escapeHtml(userTag(req.mini.user));
      bot.syncCardStatus(rows[0], `<b>Статус:</b> 🟡 В работе (Взял: ${tag} · Mini App)`, 'in_progress').catch(() => {});
      res.json({ success: true, item: publicRow(rows[0]) });
    } catch (e) {
      res.status(500).json({ error: 'Ошибка базы данных.' });
    }
  });

  // in_progress -> resolved: requires video proof; status changes ONLY after the video reaches the group
  app.post('/api/miniapp/reports/:id/resolve', requireDeptSession, (req, res) => {
    videoUpload(req, res, async (upErr) => {
      const file = req.file;
      const cleanup = () => { if (file && file.path) fs.unlink(file.path, () => {}); };
      if (upErr) {
        cleanup();
        const msg = upErr.code === 'LIMIT_FILE_SIZE' ? 'Видео больше 50 МБ. Снимите более короткий ролик.' : 'Не удалось загрузить видео.';
        return res.status(400).json({ error: msg });
      }
      if (!file) return res.status(400).json({ error: 'Прикрепите видеодоказательство устранения проблемы.' });

      const id = parseInt(req.params.id, 10);
      try {
        if (!id) { cleanup(); return res.status(400).json({ error: 'Некорректный ID.' }); }
        const owned = await loadOwned(pool, req.mini.dept, id);
        if (!owned) { cleanup(); return res.status(404).json({ error: 'Заявка не найдена в очереди вашей службы.' }); }
        if (owned.status !== 'in_progress') {
          cleanup();
          return res.status(409).json({ error: owned.status === 'new' ? 'Сначала возьмите заявку в работу.' : 'Заявка уже закрыта.' });
        }

        const tag = bot.escapeHtml(userTag(req.mini.user));
        const lat = Number(owned.latitude), lng = Number(owned.longitude);
        const caption = [
          `✅ <b>ОТЧЁТ: заявка #${owned.id} решена</b>`,
          `<b>Категория:</b> ${bot.escapeHtml(owned.category || 'Другое')}`,
          `<b>Исполнитель:</b> ${tag}`,
          `<b>Закрыто:</b> ${bot.formatTashkentDate(new Date())}`,
          `📍 <a href="https://maps.google.com/?q=${lat},${lng}">Место на карте</a>`,
          `🎥 Видеодоказательство приложено`
        ].join('\n');

        const tg = await bot.sendVideoFile(owned.telegram_chat_id || req.mini.chatId, file.path, file.mimetype, caption, owned.telegram_message_id);
        cleanup();
        if (!tg || !tg.ok) {
          return res.status(502).json({ error: 'Telegram не принял видео. Статус не изменён, попробуйте ещё раз.' });
        }

        const { rows } = await pool.query(
          `UPDATE problems SET status = 'resolved', resolved_at = NOW() WHERE id = $1 AND status = 'in_progress' RETURNING *`, [id]
        );
        if (!rows[0]) return res.status(409).json({ error: 'Статус заявки изменился, обновите список.' });
        bot.syncCardStatus(rows[0], `<b>Статус:</b> 🟢 Решено (Закрыл: ${tag} с видеодоказательством · Mini App)`, 'resolved').catch(() => {});
        res.json({ success: true, item: publicRow(rows[0]) });
      } catch (e) {
        cleanup();
        console.error('[MiniApp] resolve failed:', e && e.message);
        res.status(500).json({ error: 'Ошибка при закрытии заявки.' });
      }
    });
  });

  console.log('📱 Telegram Mini App endpoints ready (/miniapp/)');
}

module.exports = { registerMiniApp };
