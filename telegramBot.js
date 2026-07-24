const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

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

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8271258508:AAHHm4OC8wrYkY7zSBwGNGymY0vrNnV3Kzk';

// Department Chat IDs
const CHAT_ROUTING = {
  'Дороги': process.env.TELEGRAM_CHAT_UBDD || '-1003950961266',
  'Вода': process.env.TELEGRAM_CHAT_WATER || '-1004321829932',
  'Электричество': process.env.TELEGRAM_CHAT_ENERGY || '-1004355701194',
  'Мусор': process.env.TELEGRAM_CHAT_ECOLOGY || '-1004338321989',
  'Здания': process.env.TELEGRAM_CHAT_KHOKIMIYAT || '-1003966370649',
  'Другое': process.env.TELEGRAM_CHAT_KHOKIMIYAT || '-1003966370649'
};

function getChatIdForCategory(category) {
  if (!category) return CHAT_ROUTING['Другое'];
  return CHAT_ROUTING[category] || CHAT_ROUTING['Другое'];
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatTashkentDate(dateVal) {
  const d = dateVal ? new Date(dateVal) : new Date();
  if (isNaN(d.getTime())) return new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' });
  return d.toLocaleString('ru-RU', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function buildMessageCaption(report, statusSuffix = '') {
  const lat = Number(report.latitude);
  const lng = Number(report.longitude);
  const mapLink = `https://yandex.ru/maps/?pt=${lng},${lat}&z=17&l=map`;
  const dateStr = formatTashkentDate(report.timestamp || report.created_at);
  const cat = report.category || 'Другое';

  let text = [
    `🚨 <b>НОВАЯ ЗАЯВКА #${report.id}</b>`,
    ``,
    `<b>Категория:</b> ${escapeHtml(cat)}`,
    `<b>Адрес / Ориентир:</b> ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    `<b>Описание:</b> ${escapeHtml(report.description)}`,
    `<b>Дата:</b> ${dateStr}`,
    ``,
    `📍 <a href="${mapLink}">Открыть место на карте</a>`
  ].join('\n');

  if (statusSuffix) {
    text += `\n\n${statusSuffix}`;
  }

  return text;
}

function getInlineKeyboard(reportId, currentStatus = 'new') {
  if (currentStatus === 'resolved') {
    return {
      inline_keyboard: [
        [
          { text: '🟢 Решено (Закрыто)', callback_data: `noop` }
        ]
      ]
    };
  }
  if (currentStatus === 'in_progress') {
    return {
      inline_keyboard: [
        [
          { text: '🟡 В работе (Принято)', callback_data: `noop` },
          { text: '🟢 Решено', callback_data: `status_resolved_${reportId}` }
        ]
      ]
    };
  }
  return {
    inline_keyboard: [
      [
        { text: '🟡 В работу', callback_data: `status_in_progress_${reportId}` },
        { text: '🟢 Решено', callback_data: `status_resolved_${reportId}` }
      ]
    ]
  };
}

// Low-level helper to make Telegram API requests using native Node.js https
function callTelegramApi(method, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${TELEGRAM_BOT_TOKEN}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json);
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(data);
    req.end();
  });
}

// Helper to send photo via multipart/form-data if image exists locally
function sendPhotoMultipart(chatId, filePath, caption, replyMarkup) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error('File not found: ' + filePath));
    }

    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const filename = path.basename(filePath);
    const fileData = fs.readFileSync(filePath);

    let postData = [];

    // chat_id
    postData.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n`));

    // caption
    postData.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n`));

    // parse_mode
    postData.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="parse_mode"\r\n\r\nHTML\r\n`));

    // reply_markup
    if (replyMarkup) {
      postData.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="reply_markup"\r\n\r\n${JSON.stringify(replyMarkup)}\r\n`));
    }

    // photo file
    postData.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${filename}"\r\nContent-Type: image/jpeg\r\n\r\n`));
    postData.push(fileData);
    postData.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const totalPayload = Buffer.concat(postData);

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': totalPayload.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json);
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', err => reject(err));
    req.write(totalPayload);
    req.end();
  });
}

// Dispatch report to Telegram group
async function sendReportToGroup(report, db, publicDir) {
  const chatId = getChatIdForCategory(report.category);
  const caption = buildMessageCaption(report);
  const replyMarkup = getInlineKeyboard(report.id, report.status || 'new');

  let response = null;

  try {
    if (report.photo_url) {
      const relativePath = report.photo_url.startsWith('/') ? report.photo_url.slice(1) : report.photo_url;
      const localFilePath = path.join(publicDir || path.join(__dirname, 'public'), relativePath);

      if (fs.existsSync(localFilePath)) {
        response = await sendPhotoMultipart(chatId, localFilePath, caption, replyMarkup);
      }
    }

    if (!response || !response.ok) {
      response = await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: caption,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
        disable_web_page_preview: false
      });
    }

    if (response && response.ok && response.result) {
      const msgId = response.result.message_id;
      if (db && report.id) {
        db.run(
          `UPDATE problems SET telegram_message_id = ?, telegram_chat_id = ? WHERE id = ?`,
          [msgId, String(chatId), report.id],
          (err) => {
            if (err) console.error('Error updating telegram msg id in DB:', err);
          }
        );
      }
    }
  } catch (err) {
    console.error('Error sending report notification to Telegram group:', err);
  }
}

// Long Polling for Telegram Callback Queries
let pollingOffset = 0;
let dbInstance = null;

async function pollUpdates() {
  while (true) {
    try {
      const res = await callTelegramApi('getUpdates', {
        offset: pollingOffset,
        timeout: 25,
        allowed_updates: ['callback_query']
      });

      if (res && res.ok && Array.isArray(res.result)) {
        for (const update of res.result) {
          pollingOffset = update.update_id + 1;
          if (update.callback_query) {
            await handleCallbackQuery(update.callback_query);
          }
        }
      }
    } catch (err) {
      // Pause briefly on network error before retrying
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}

async function handleCallbackQuery(query) {
  try {
    const data = query.data;
    if (!data || data === 'noop') {
      await callTelegramApi('answerCallbackQuery', { callback_query_id: query.id });
      return;
    }

    let action = '';
    let reportId = null;

    if (data.startsWith('status_in_progress_')) {
      action = 'in_progress';
      reportId = parseInt(data.replace('status_in_progress_', ''), 10);
    } else if (data.startsWith('status_resolved_')) {
      action = 'resolved';
      reportId = parseInt(data.replace('status_resolved_', ''), 10);
    }

    if (!reportId || isNaN(reportId)) {
      await callTelegramApi('answerCallbackQuery', { callback_query_id: query.id });
      return;
    }

    const userTag = query.from.username ? `@${query.from.username}` : (query.from.first_name || 'Диспетчер');

    if (!dbInstance) {
      await callTelegramApi('answerCallbackQuery', { callback_query_id: query.id, text: 'Ошибка системы: база данных не подключена.' });
      return;
    }

    dbInstance.get('SELECT * FROM problems WHERE id = ?', [reportId], async (err, problem) => {
      if (err || !problem) {
        await callTelegramApi('answerCallbackQuery', { callback_query_id: query.id, text: 'Заявка не найдена в базе.' });
        return;
      }

      let newStatus = problem.status || 'new';
      let statusSuffix = '';
      let nowMs = Date.now();

      if (action === 'in_progress') {
        newStatus = 'in_progress';
        statusSuffix = `<b>Статус:</b> 🟡 В работе (Принял: ${userTag})`;
        dbInstance.run('UPDATE problems SET status = ? WHERE id = ?', ['in_progress', reportId]);
      } else if (action === 'resolved') {
        newStatus = 'resolved';
        statusSuffix = `<b>Статус:</b> 🟢 Решено (Закрыл: ${userTag})`;
        dbInstance.run('UPDATE problems SET status = ?, resolved_at = ? WHERE id = ?', ['resolved', new Date(nowMs).toISOString(), reportId]);
      }

      // Update problem object in-memory for formatting
      problem.status = newStatus;
      problem.resolved_at = nowMs;

      const updatedCaption = buildMessageCaption(problem, statusSuffix);
      const updatedKeyboard = getInlineKeyboard(reportId, newStatus);
      const message = query.message;

      if (message) {
        const isPhotoMsg = Boolean(message.photo || message.caption);
        if (isPhotoMsg) {
          await callTelegramApi('editMessageCaption', {
            chat_id: message.chat.id,
            message_id: message.message_id,
            caption: updatedCaption,
            parse_mode: 'HTML',
            reply_markup: updatedKeyboard
          });
        } else {
          await callTelegramApi('editMessageText', {
            chat_id: message.chat.id,
            message_id: message.message_id,
            text: updatedCaption,
            parse_mode: 'HTML',
            reply_markup: updatedKeyboard
          });
        }
      }

      await callTelegramApi('answerCallbackQuery', {
        callback_query_id: query.id,
        text: action === 'in_progress' ? 'Заявка переведена "В работу" 🟡' : 'Заявка отмечена "Решено" 🟢'
      });
    });
  } catch (err) {
    console.error('Error handling callback query:', err);
    try {
      await callTelegramApi('answerCallbackQuery', { callback_query_id: query.id, text: 'Произошла ошибка при обработке.' });
    } catch(e) {}
  }
}

function initTelegramBot(db) {
  dbInstance = db;
  console.log('🤖 Telegram Dispatcher Bot service initialized (@vaisperia_dispatch_bot)');
  // Start background long polling
  pollUpdates().catch(err => console.error('Telegram bot polling error:', err));
}

module.exports = {
  sendReportToGroup,
  initTelegramBot
};
