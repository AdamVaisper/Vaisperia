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

// Step-by-Step Inline Keyboard Generator
function getInlineKeyboard(reportId, currentStatus = 'new') {
  if (currentStatus === 'resolved') {
    return { inline_keyboard: [] }; // Remove buttons on completion
  }
  if (currentStatus === 'in_progress') {
    return {
      inline_keyboard: [
        [
          { text: '🟢 Решено', callback_data: `status_resolve_init_${reportId}` }
        ]
      ]
    };
  }
  // Initial state ('new') -> Step A: Only ONE button
  return {
    inline_keyboard: [
      [
        { text: '🟡 В работу', callback_data: `status_in_progress_${reportId}` }
      ]
    ]
  };
}

// Native HTTPS Telegram API Caller
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

// Helper to send photo via multipart/form-data
function sendPhotoMultipart(chatId, filePath, caption, replyMarkup) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error('File not found: ' + filePath));
    }

    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const filename = path.basename(filePath);
    const fileData = fs.readFileSync(filePath);

    let postData = [];
    postData.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n`));
    postData.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n`));
    postData.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="parse_mode"\r\n\r\nHTML\r\n`));

    if (replyMarkup) {
      postData.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="reply_markup"\r\n\r\n${JSON.stringify(replyMarkup)}\r\n`));
    }

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

// Long Polling & Media Proof State Tracking
let pollingOffset = 0;
let dbInstance = null;

// Track active report resolutions waiting for photo/video proof
// Key: chatId, Value: { reportId, chatId, cardMsgId, promptMsgId, userTag }
const pendingProofByChat = {};
const pendingProofByReport = {};

async function pollUpdates() {
  while (true) {
    try {
      const res = await callTelegramApi('getUpdates', {
        offset: pollingOffset,
        timeout: 25,
        allowed_updates: ['callback_query', 'message']
      });

      if (res && res.ok && Array.isArray(res.result)) {
        for (const update of res.result) {
          pollingOffset = update.update_id + 1;
          if (update.callback_query) {
            await handleCallbackQuery(update.callback_query);
          } else if (update.message) {
            await handleIncomingMessage(update.message);
          }
        }
      }
    } catch (err) {
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

    const userTag = query.from.username ? `@${query.from.username}` : (query.from.first_name || 'Диспетчер');
    const message = query.message;

    if (data.startsWith('status_in_progress_')) {
      const reportId = parseInt(data.replace('status_in_progress_', ''), 10);
      if (!reportId || isNaN(reportId)) return;

      dbInstance.get('SELECT * FROM problems WHERE id = ?', [reportId], async (err, problem) => {
        if (err || !problem) {
          await callTelegramApi('answerCallbackQuery', { callback_query_id: query.id, text: 'Заявка не найдена.' });
          return;
        }

        dbInstance.run('UPDATE problems SET status = ? WHERE id = ?', ['in_progress', reportId]);
        problem.status = 'in_progress';

        const updatedCaption = buildMessageCaption(problem, `<b>Статус:</b> 🟡 В работе (Взял: ${userTag})`);
        const updatedKeyboard = getInlineKeyboard(reportId, 'in_progress');

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
          text: 'Заявка принята в работу 🟡'
        });
      });
    } else if (data.startsWith('status_resolve_init_')) {
      const reportId = parseInt(data.replace('status_resolve_init_', ''), 10);
      if (!reportId || isNaN(reportId)) return;

      dbInstance.get('SELECT * FROM problems WHERE id = ?', [reportId], async (err, problem) => {
        if (err || !problem) {
          await callTelegramApi('answerCallbackQuery', { callback_query_id: query.id, text: 'Заявка не найдена.' });
          return;
        }

        if (problem.status === 'resolved') {
          await callTelegramApi('answerCallbackQuery', { callback_query_id: query.id, text: 'Заявка уже завершена.' });
          return;
        }

        const chatId = message.chat.id;
        const cardMsgId = message.message_id;

        // Prompt user to reply with photo or video proof
        const promptRes = await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `⚠️ <b>Пожалуйста, отправьте видео или фото выполненной работы в ответ на это сообщение (Reply) для подтверждения закрытия заявки #${reportId}.</b>`,
          parse_mode: 'HTML',
          reply_to_message_id: cardMsgId
        });

        const promptMsgId = (promptRes && promptRes.ok && promptRes.result) ? promptRes.result.message_id : null;

        const proofEntry = {
          reportId: reportId,
          chatId: chatId,
          cardMsgId: cardMsgId,
          promptMsgId: promptMsgId,
          userTag: userTag,
          createdAt: Date.now()
        };

        pendingProofByChat[chatId] = proofEntry;
        pendingProofByReport[reportId] = proofEntry;

        await callTelegramApi('answerCallbackQuery', {
          callback_query_id: query.id,
          text: 'Отправьте фото/видео ответа (Reply) на сообщение для подтверждения!'
        });
      });
    }
  } catch (err) {
    console.error('Error handling callback query:', err);
    try {
      await callTelegramApi('answerCallbackQuery', { callback_query_id: query.id, text: 'Произошла ошибка.' });
    } catch(e) {}
  }
}

// Handle Incoming Media Messages (Photo / Video Proof)
async function handleIncomingMessage(msg) {
  try {
    const chatId = msg.chat.id;
    const hasMedia = Boolean(msg.photo || msg.video || msg.document);

    if (!hasMedia) return;

    // Check if message is a reply to prompt message or card
    let pendingEntry = pendingProofByChat[chatId];
    if (!pendingEntry) return;

    const replyMsg = msg.reply_to_message;
    if (replyMsg) {
      const isReplyToPrompt = pendingEntry.promptMsgId && (replyMsg.message_id === pendingEntry.promptMsgId);
      const isReplyToCard = pendingEntry.cardMsgId && (replyMsg.message_id === pendingEntry.cardMsgId);
      if (!isReplyToPrompt && !isReplyToCard) {
        // If reply target doesn't match active pending report, ignore or fallback
        return;
      }
    }

    const { reportId, cardMsgId, userTag } = pendingEntry;
    const nowIso = new Date().toISOString();

    if (!dbInstance) return;

    dbInstance.run('UPDATE problems SET status = ?, resolved_at = ? WHERE id = ?', ['resolved', nowIso, reportId], function(err) {
      if (err) console.error('Error setting problem status to resolved:', err);

      dbInstance.get('SELECT * FROM problems WHERE id = ?', [reportId], async (err, problem) => {
        if (!problem) return;

        problem.status = 'resolved';
        problem.resolved_at = Date.now();

        const updatedCaption = buildMessageCaption(problem, `<b>Статус:</b> 🟢 Решено (Закрыл: ${userTag} с доказательством)`);
        const updatedKeyboard = getInlineKeyboard(reportId, 'resolved'); // empty keyboard

        // Edit original report card message
        try {
          const isPhotoCard = Boolean(problem.photo_url);
          if (isPhotoCard) {
            await callTelegramApi('editMessageCaption', {
              chat_id: chatId,
              message_id: cardMsgId,
              caption: updatedCaption,
              parse_mode: 'HTML',
              reply_markup: updatedKeyboard
            });
          } else {
            await callTelegramApi('editMessageText', {
              chat_id: chatId,
              message_id: cardMsgId,
              text: updatedCaption,
              parse_mode: 'HTML',
              reply_markup: updatedKeyboard
            });
          }
        } catch (e) {
          console.error('Error updating original card message:', e);
        }

        // Send confirmation in chat
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `✅ <b>Заявка #${reportId} успешно закрыта с медиа-подтверждением!</b>`,
          parse_mode: 'HTML',
          reply_to_message_id: msg.message_id
        });

        // Clean up pending entry
        delete pendingProofByChat[chatId];
        delete pendingProofByReport[reportId];
      });
    });
  } catch (err) {
    console.error('Error processing media proof message:', err);
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
