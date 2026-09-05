const TelegramBot = require('node-telegram-bot-api');
const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// ==================== CONFIG ====================
const BOT_TOKEN = '8758747162:AAH_GzV7cb82ZD0XfLs2YkMrZ1dmGmW-OI8';          // @BotFather se lein
const ADMIN_IDS = [8601285274];                     // Apna Telegram numeric ID
const OBF_METHOD = 'Ultra Guard Obfuscation';

// ==================== DATA STORAGE ====================
const stats = { totalFiles: 0, commands: {} };
const usersDb = new Set();
const logsDb = [];
const userQueue = {}; // userId -> count

// ==================== HELPERS ====================
function logEvent(event) {
    const ts = new Date().toISOString().replace('T', ' ').split('.')[0];
    const entry = `[${ts}] ${event}`;
    logsDb.push(entry);
    if (logsDb.length > 2000) logsDb.shift();
}

function trackCommand(cmd) {
    stats.commands[cmd] = (stats.commands[cmd] || 0) + 1;
}

function isAdmin(userId) {
    return ADMIN_IDS.includes(userId);
}

function generateJunkArray(count, minLen, maxLen) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_';
    const arr = [];
    for (let i = 0; i < count; i++) {
        const len = Math.floor(Math.random() * (maxLen - minLen + 1)) + minLen;
        let str = '';
        for (let j = 0; j < len; j++) str += chars[Math.floor(Math.random() * chars.length)];
        arr.push(str);
    }
    return arr;
}

function generateDeadFuncs(count) {
    const funcs = [];
    for (let i = 0; i < count; i++) {
        const fn = `$var$const$break$dead${i.toString(16).padStart(6, '0')}`;
        funcs.push(`function ${fn}(a,b,c){var x=a+b+c+${i};var y=x*${i+1};var z=String.fromCharCode(${65 + (i % 26)});if(x===y)return z;var r=x>y?a:b;return r+"${crypto.randomBytes(10).toString('hex').toUpperCase()}";}`);
    }
    return funcs;
}

function applyUltraGuardLayer(code, originalName) {
    // Step 1: Wrap original code
    const payload = code.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
    const wrapped = `(function(){var _0xug=String.raw\`${payload}\`;eval(_0xug);})();`;

    // Step 2: Split into chunks and unicode-escape every char
    const chunkSize = 30;
    const chunks = [];
    for (let i = 0; i < wrapped.length; i += chunkSize) {
        chunks.push(wrapped.slice(i, i + chunkSize));
    }

    const encodedVars = [];
    const chunkVars = [];
    for (let i = 0; i < chunks.length; i++) {
        const varName = `$var$const$break$chunk${i.toString(16).padStart(6, '0')}`;
        let escaped = '';
        for (const c of chunks[i]) {
            escaped += `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`;
        }
        encodedVars.push(`var ${varName} = "${escaped}";`);
        chunkVars.push(varName);
    }

    // Step 3: Massive junk array (50k entries)
    const junkArray = generateJunkArray(50000, 30, 80);

    // Step 4: Dead code functions (3000)
    const deadFuncs = generateDeadFuncs(3000);

    // Step 5: Decoder
    const decoder = `
function $var$const$break$decode(chunks){
var r="";
for(var i=0;i<chunks.length;i++){
var s=chunks[i];
for(var j=0;j<s.length;j+=6){
var h=s.substr(j+2,4);
r+=String.fromCharCode(parseInt(h,16));
}
}
return r;
}`;

    // Step 6: Assemble
    const chunkArrayDecl = `var $var$const$break$allChunks=[${chunkVars.join(',')}];`;

    return `// ============================================
//  Ultra Guard Obfuscation
//  Protected by Ultra Guard Engine v3.0
//  Original: ${originalName}
//  Method: ${OBF_METHOD}
//  Do NOT modify this file
// ============================================

var $var$const$break$junkData=${JSON.stringify(junkArray)};

${deadFuncs.join('\n')}

${encodedVars.join('\n')}

${chunkArrayDecl}

${decoder}

var $var$const$break$finalCode=$var$const$break$decode($var$const$break$allChunks);
eval($var$const$break$finalCode);
`;
}

function obfuscateFile(inputPath, outputPath, filename) {
    const code = fs.readFileSync(inputPath, 'utf8');

    // Step A: javascript-obfuscator with MAX settings
    const obfuscationResult = JavaScriptObfuscator.obfuscate(code, {
        compact: false,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 1,
        deadCodeInjection: true,
        deadCodeInjectionThreshold: 1,
        debugProtection: true,
        debugProtectionInterval: 4000,
        disableConsoleOutput: true,
        identifierNamesGenerator: 'mangled',
        log: false,
        numbersToExpressions: true,
        renameGlobals: true,
        rotateStringArray: true,
        selfDefending: true,
        stringArray: true,
        stringArrayEncoding: ['rc4', 'base64'],
        stringArrayThreshold: 1,
        transformObjectKeys: true,
        unicodeEscapeSequence: true,
        splitStrings: true,
        splitStringsChunkLength: 3,
        stringArrayWrappersCount: 5,
        stringArrayWrappersType: 'function',
        stringArrayWrappersParametersMaxCount: 5,
        stringArrayWrappersChaoticMaxLength: 20
    });

    const obfCode = obfuscationResult.getObfuscatedCode();

    // Step B: Apply Ultra Guard custom layer
    const finalCode = applyUltraGuardLayer(obfCode, filename);

    fs.writeFileSync(outputPath, finalCode, 'utf8');
}

// ==================== BOT INIT ====================
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('='.repeat(50));
console.log('🤖 Ultra Guard Obfuscation Bot Started!');
console.log('='.repeat(50));

// ==================== COMMANDS ====================

// /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    usersDb.add(user.id);
    trackCommand('start');

    const welcome =
        `👋 <b>Selamat Datang di Bot Obfuscate & Encrypt File!</b>\n\n` +
        `🤖 <b>Bot:</b> Encrypt File\n` +
        `👤 <b>User:</b> ${user.first_name}\n` +
        `🆔 <b>ID:</b> <code>${user.id}</code>\n\n` +
        `📁 <b>Kirim file .js, .py, .html, .css, atau .txt</b>\n` +
        `🔒 <b>Method:</b> ${OBF_METHOD}\n\n` +
        `⚡ <b>Features:</b>\n` +
        `  ☑️ Admin Tools\n` +
        `  ☑️ Cek Online User Real-Time\n` +
        `  ☑️ Statistik Command Usage\n` +
        `  ☑️ Cek Logs - Error Checker\n\n` +
        `📦 <b>Obf Menu</b> - Proteksi file JavaScript\n` +
        `👥 <b>Group Menu</b> - Kelola grup\n` +
        `🔍 <b>/ceklogs</b> - Cek error sebelum running\n\n` +
        `🚀 <a href="https://t.me/yourchannel">Mulai Sekarang</a>`;

    const keyboard = {
        inline_keyboard: [
            [
                { text: '📦 Obf Menu', callback_data: 'obf_menu' },
                { text: '👥 Group Menu', callback_data: 'group_menu' }
            ],
            [{ text: '❌ Tutup', callback_data: 'close' }]
        ]
    };

    try {
        await bot.sendPhoto(chatId, 'https://envs.sh/Obf.jpg', {
            caption: welcome,
            parse_mode: 'HTML',
            reply_markup: keyboard
        });
    } catch (e) {
        await bot.sendMessage(chatId, welcome, {
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup: keyboard
        });
    }
});

// /admin
bot.onText(/\/admin/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    if (!isAdmin(userId)) {
        return bot.sendMessage(chatId, '⛔ <b>Access Denied!</b>\n\nSirf admin istemal kar sakta hai.', { parse_mode: 'HTML' });
    }
    trackCommand('admin');

    const text =
        `🔧 <b>Admin Tools</b>\n\n` +
        `📊 <b>Total Files:</b> ${stats.totalFiles}\n` +
        `👥 <b>Total Users:</b> ${usersDb.size}\n\n` +
        `<b>Commands:</b>\n` +
        `/ceklogs - Error logs check karein\n` +
        `/stats - Command usage stats\n` +
        `/broadcast - Sab users ko message bhejein\n` +
        `/clearlogs - Logs clear karein`;

    await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
});

// /ceklogs
bot.onText(/\/ceklogs/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    if (!isAdmin(userId)) return;
    trackCommand('ceklogs');

    if (logsDb.length === 0) {
        return bot.sendMessage(chatId, '✅ <b>No errors found!</b> Logs bilkul clean hain.', { parse_mode: 'HTML' });
    }

    const recent = logsDb.slice(-100).join('\n');
    let text = `🔍 <b>Recent Logs / Errors:</b>\n\n<code>${recent}</code>`;
    if (text.length > 4000) text = text.slice(0, 3990) + '...</code>';

    await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
});

// /stats
bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    if (!isAdmin(userId)) return;
    trackCommand('stats');

    let text = '📈 <b>Command Usage Statistics</b>\n\n';
    const sorted = Object.entries(stats.commands).sort((a, b) => b[1] - a[1]);
    for (const [cmd, count] of sorted) {
        text += `/${cmd}: ${count}\n`;
    }
    if (sorted.length === 0) text += '<i>Koi data nahi</i>';

    await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
});

// /broadcast
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    if (!isAdmin(userId)) return;
    trackCommand('broadcast');

    const message = match[1];
    let sent = 0, failed = 0;

    for (const uid of usersDb) {
        try {
            await bot.sendMessage(uid, `📢 <b>Broadcast:</b>\n\n${message}`, { parse_mode: 'HTML' });
            sent++;
            await new Promise(r => setTimeout(r, 50));
        } catch (e) {
            failed++;
        }
    }

    await bot.sendMessage(chatId, `✅ <b>Broadcast Complete!</b>\n\nSent: ${sent}\nFailed: ${failed}`, { parse_mode: 'HTML' });
});

// /clearlogs
bot.onText(/\/clearlogs/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    if (!isAdmin(userId)) return;
    logsDb.length = 0;
    await bot.sendMessage(chatId, '🗑️ <b>Logs cleared!</b>', { parse_mode: 'HTML' });
});

// ==================== CALLBACK QUERIES ====================
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const msgId = query.message.message_id;
    const data = query.data;

    try { await bot.answerCallbackQuery(query.id); } catch (e) {}

    if (data === 'close') {
        try { await bot.deleteMessage(chatId, msgId); } catch (e) {}
        return;
    }

    if (data === 'obf_menu') {
        const text =
            `📦 <b>Obfuscate Menu</b>\n\n` +
            `Kirim file JavaScript (.js) untuk di obfuscate.\n\n` +
            `✅ Ultra Guard Obfuscation\n` +
            `✅ Heavy string encryption (RC4 + Base64)\n` +
            `✅ Control flow flattening\n` +
            `✅ Dead code injection\n` +
            `✅ Unicode escape sequences\n` +
            `✅ Self-defending code\n` +
            `✅ Anti-debug protection\n\n` +
            `📏 <b>Size increase:</b> ~40KB → ~10MB\n` +
            `🔐 <b>Security:</b> Maximum`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '🔙 Back', callback_data: 'back_start' }],
                [{ text: '❌ Tutup', callback_data: 'close' }]
            ]
        };

        try {
            await bot.editMessageCaption(text, {
                chat_id: chatId,
                message_id: msgId,
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
        } catch (e) {
            await bot.editMessageText(text, {
                chat_id: chatId,
                message_id: msgId,
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
        }
    }

    if (data === 'group_menu') {
        const text =
            `👥 <b>Group Menu</b>\n\n` +
            `• Auto-delete spam\n` +
            `• Welcome new members\n` +
            `• Anti-flood protection\n` +
            `• Admin commands\n\n` +
            `<i>Coming soon in v2.0</i>`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '🔙 Back', callback_data: 'back_start' }],
                [{ text: '❌ Tutup', callback_data: 'close' }]
            ]
        };

        try {
            await bot.editMessageCaption(text, {
                chat_id: chatId,
                message_id: msgId,
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
        } catch (e) {
            await bot.editMessageText(text, {
                chat_id: chatId,
                message_id: msgId,
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
        }
    }

    if (data === 'back_start') {
        const user = query.from;
        const welcome =
            `👋 <b>Selamat Datang di Bot Obfuscate & Encrypt File!</b>\n\n` +
            `🤖 <b>Bot:</b> Encrypt File\n` +
            `👤 <b>User:</b> ${user.first_name}\n` +
            `🆔 <b>ID:</b> <code>${user.id}</code>\n\n` +
            `📁 <b>Kirim file .js, .py, .html, .css, atau .txt</b>\n` +
            `🔒 <b>Method:</b> ${OBF_METHOD}\n\n` +
            `⚡ <b>Features:</b>\n` +
            `  ☑️ Admin Tools\n` +
            `  ☑️ Cek Online User Real-Time\n` +
            `  ☑️ Statistik Command Usage\n` +
            `  ☑️ Cek Logs - Error Checker\n\n` +
            `📦 <b>Obf Menu</b> - Proteksi file JavaScript\n` +
            `👥 <b>Group Menu</b> - Kelola grup\n` +
            `🔍 <b>/ceklogs</b> - Cek error sebelum running\n\n` +
            `🚀 <a href="https://t.me/yourchannel">Mulai Sekarang</a>`;

        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📦 Obf Menu', callback_data: 'obf_menu' },
                    { text: '👥 Group Menu', callback_data: 'group_menu' }
                ],
                [{ text: '❌ Tutup', callback_data: 'close' }]
            ]
        };

        try {
            await bot.editMessageCaption(welcome, {
                chat_id: chatId,
                message_id: msgId,
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
        } catch (e) {
            await bot.editMessageText(welcome, {
                chat_id: chatId,
                message_id: msgId,
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
        }
    }
});

// ==================== FILE HANDLER ====================
bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const doc = msg.document;
    const fname = doc.file_name;
    const fsize = doc.file_size || 0;

    const allowed = ['.js', '.py', '.html', '.htm', '.txt', '.css'];
    const ext = path.extname(fname).toLowerCase();
    if (!allowed.includes(ext)) {
        return bot.sendMessage(chatId, '❌ <b>Sirf ye files allowed hain:</b>\n<code>.js .py .html .css .txt</code>', { parse_mode: 'HTML' });
    }

    // Queue
    userQueue[userId] = (userQueue[userId] || 0) + 1;
    if (userQueue[userId] > 1) {
        await bot.sendMessage(
            chatId,
            `⏳ <b>Antrian Anda memiliki ${userQueue[userId]} tugas dalam antrian.</b>\nMohon tunggu giliran Anda.`,
            { parse_mode: 'HTML' }
        );
    }

    stats.totalFiles++;
    trackCommand('obfuscate');
    logEvent(`User ${userId} | ${fname} | ${(fsize / 1024).toFixed(2)}KB`);

    // Progress message
    const prog = await bot.sendMessage(
        chatId,
        `🔄 <b>Processing...</b>\n\n` +
        `⬜ Initializing...\n` +
        `⬜ Downloading...\n` +
        `⬜ Processing...\n` +
        `⬜ Preparing output...\n` +
        `⬜ Uploading...\n` +
        `⬜ Completed!`,
        { parse_mode: 'HTML' }
    );

    let inputPath = null;
    let outputPath = null;

    try {
        // Step 1: Download
        await bot.editMessageText(
            `🔄 <b>Processing...</b>\n\n` +
            `☑️ Initializing...\n` +
            `🔄 Downloading...\n` +
            `⬜ Processing...\n` +
            `⬜ Preparing output...\n` +
            `⬜ Uploading...\n` +
            `⬜ Completed!`,
            { chat_id: chatId, message_id: prog.message_id, parse_mode: 'HTML' }
        );

        const fileLink = await bot.getFileLink(doc.file_id);
        const response = await fetch(fileLink);
        const buffer = Buffer.from(await response.arrayBuffer());

        inputPath = path.join(os.tmpdir(), `ug_input_${Date.now()}_${fname}`);
        fs.writeFileSync(inputPath, buffer);

        // Step 2: Process
        await bot.editMessageText(
            `🔄 <b>Processing...</b>\n\n` +
            `☑️ Initializing...\n` +
            `☑️ Downloading...\n` +
            `🔄 Processing...\n` +
            `⬜ Preparing output...\n` +
            `⬜ Uploading...\n` +
            `⬜ Completed!`,
            { chat_id: chatId, message_id: prog.message_id, parse_mode: 'HTML' }
        );

        outputPath = inputPath + '.obfuscated.js';
        obfuscateFile(inputPath, outputPath, fname);

        const outSize = fs.statSync(outputPath).size;

        // Step 3: Prepare output
        await bot.editMessageText(
            `🔄 <b>Processing...</b>\n\n` +
            `☑️ Initializing...\n` +
            `☑️ Downloading...\n` +
            `☑️ Processing...\n` +
            `🔄 Preparing output...\n` +
            `⬜ Uploading...\n` +
            `⬜ Completed!`,
            { chat_id: chatId, message_id: prog.message_id, parse_mode: 'HTML' }
        );

        // Step 4: Upload
        await bot.editMessageText(
            `🔄 <b>Processing...</b>\n\n` +
            `☑️ Initializing...\n` +
            `☑️ Downloading...\n` +
            `☑️ Processing...\n` +
            `☑️ Preparing output...\n` +
            `🔄 Uploading...\n` +
            `⬜ Completed!`,
            { chat_id: chatId, message_id: prog.message_id, parse_mode: 'HTML' }
        );

        const newName = `ultraguard-obfuscated-${fname}`;

        const caption =
            `✅ <b>Obfuscated file (${OBF_METHOD}) siap!</b>\n` +
            `SUKSES ENCRYPT ⭐\n\n` +
            `📁 <b>File:</b> <code>${fname}</code>\n` +
            `📊 <b>Size:</b> ${(fsize / 1024).toFixed(2)} KB → ${(outSize / 1024).toFixed(2)} KB\n` +
            `🔧 <b>Method:</b> ${OBF_METHOD}\n` +
            `📌 <b>Status:</b> <code>Completed!</code>`;

        await bot.sendDocument(chatId, fs.createReadStream(outputPath), {
            caption: caption,
            parse_mode: 'HTML',
            filename: newName
        });

        // Final progress
        await bot.editMessageText(
            `☑️ <b>Processing...</b>\n\n` +
            `☑️ Initializing...\n` +
            `☑️ Downloading...\n` +
            `☑️ Processing...\n` +
            `☑️ Preparing output...\n` +
            `☑️ Uploading...\n` +
            `☑️ <b>Completed!</b>\n\n` +
            `📁 <b>File:</b> <code>${fname}</code>\n` +
            `📊 <b>Size:</b> ${(fsize / 1024).toFixed(2)} KB → ${(outSize / 1024).toFixed(2)} KB\n` +
            `🔧 <b>Method:</b> ${OBF_METHOD}\n` +
            `📌 <b>Status:</b> <code>Completed!</code>`,
            { chat_id: chatId, message_id: prog.message_id, parse_mode: 'HTML' }
        );

        logEvent(`SUCCESS ${fname}: ${(fsize / 1024).toFixed(2)}KB -> ${(outSize / 1024).toFixed(2)}KB`);

    } catch (err) {
        logEvent(`ERROR ${fname}: ${err.message}`);
        await bot.editMessageText(
            `❌ <b>Error!</b>\n\n<code>${err.message}</code>\n\n` +
            `🔍 /ceklogs se details dekh sakte hain.`,
            { chat_id: chatId, message_id: prog.message_id, parse_mode: 'HTML' }
        );
    } finally {
        userQueue[userId] = Math.max(0, (userQueue[userId] || 1) - 1);
        if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (outputPath && fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
});

// Error handler
bot.on('polling_error', (err) => {
    console.error('Polling error:', err.message);
});

bot.on('error', (err) => {
    console.error('Bot error:', err.message);
});
