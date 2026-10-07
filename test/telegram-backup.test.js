const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const telegramBackup = require('../lib/telegramBackup');

const SECRET = 'clave-de-prueba-aleatoria-mayor-a-32-caracteres';

function temporaryState(t, prefix) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    t.after(() => fs.removeSync(root));
    const paths = {
        root,
        dataFile: path.join(root, 'bot_data.json'),
        authDir: path.join(root, 'auth_info'),
        uploadsDir: path.join(root, 'uploads')
    };
    fs.ensureDirSync(paths.authDir);
    fs.ensureDirSync(paths.uploadsDir);
    return paths;
}

function setTelegramEnvironment(t, chatId) {
    const previous = {
        token: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_BACKUP_CHAT_ID,
        telegramKey: process.env.TELEGRAM_BACKUP_ENCRYPTION_KEY,
        backupKey: process.env.BACKUP_ENCRYPTION_KEY
    };
    process.env.TELEGRAM_BOT_TOKEN = 'test-token-not-real';
    process.env.TELEGRAM_BACKUP_CHAT_ID = chatId;
    process.env.TELEGRAM_BACKUP_ENCRYPTION_KEY = SECRET;
    delete process.env.BACKUP_ENCRYPTION_KEY;
    t.after(() => {
        if (previous.token === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
        else process.env.TELEGRAM_BOT_TOKEN = previous.token;
        if (previous.chatId === undefined) delete process.env.TELEGRAM_BACKUP_CHAT_ID;
        else process.env.TELEGRAM_BACKUP_CHAT_ID = previous.chatId;
        if (previous.telegramKey === undefined) delete process.env.TELEGRAM_BACKUP_ENCRYPTION_KEY;
        else process.env.TELEGRAM_BACKUP_ENCRYPTION_KEY = previous.telegramKey;
        if (previous.backupKey === undefined) delete process.env.BACKUP_ENCRYPTION_KEY;
        else process.env.BACKUP_ENCRYPTION_KEY = previous.backupKey;
    });
}

function populateState(paths) {
    fs.writeJsonSync(paths.dataFile, { coins: 1234, webProgress: ['rpg', 'perfil'] });
    fs.ensureDirSync(path.join(paths.authDir, 'main'));
    fs.writeJsonSync(path.join(paths.authDir, 'main', 'creds.json'), { registered: true, secret: 'whatsapp-auth-secret' });
    fs.writeFileSync(path.join(paths.uploadsDir, 'hero.txt'), 'imagen-del-panel');
}

test('el respaldo cifra progreso, sesión WhatsApp y archivos y restaura solo lo que falta', t => {
    const source = temporaryState(t, 'niku-telegram-source-');
    const target = temporaryState(t, 'niku-telegram-target-');
    populateState(source);
    fs.writeJsonSync(target.dataFile, { coins: 9999, webProgress: ['local-mas-reciente'] });

    const snapshot = telegramBackup.createEncryptedSnapshot(source, SECRET);
    assert.equal(snapshot.payload.files['bot_data.json'] !== undefined, true);
    assert.equal(snapshot.payload.files['auth_info/main/creds.json'] !== undefined, true);
    assert.equal(snapshot.payload.files['uploads/hero.txt'] !== undefined, true);
    assert.equal(snapshot.document.includes(Buffer.from('whatsapp-auth-secret')), false);

    const decoded = telegramBackup.decryptPayload(snapshot.document, SECRET);
    const restoredCount = telegramBackup.restoreMissingFiles(decoded, target);
    assert.equal(restoredCount, 2);
    assert.deepEqual(fs.readJsonSync(target.dataFile), { coins: 9999, webProgress: ['local-mas-reciente'] });
    assert.deepEqual(fs.readJsonSync(path.join(target.authDir, 'main', 'creds.json')), { registered: true, secret: 'whatsapp-auth-secret' });
    assert.equal(fs.readFileSync(path.join(target.uploadsDir, 'hero.txt'), 'utf8'), 'imagen-del-panel');
});

test('rechaza rutas del respaldo que intentan salir de los directorios administrados', t => {
    const target = temporaryState(t, 'niku-telegram-path-');
    assert.throws(() => telegramBackup.restoreMissingFiles({
        version: 1,
        files: { 'uploads/../../outside.txt': Buffer.from('no').toString('base64') }
    }, target), /ruta inválida/i);
});

test('sube un documento cifrado al grupo y fija el último respaldo', async t => {
    const chatId = '-10090000000001';
    setTelegramEnvironment(t, chatId);
    const source = temporaryState(t, 'niku-telegram-upload-');
    populateState(source);
    let uploaded;
    const pinnedIds = [];
    const bot = {
        getChat: async id => ({ id, pinned_message: null }),
        sendDocument: async (id, document, options, fileOptions) => {
            uploaded = { id, document: Buffer.from(document), options, fileOptions };
            return { message_id: 321, document: { file_id: 'file-321', file_size: uploaded.document.length }, caption: options.caption };
        },
        pinChatMessage: async (_id, messageId) => { pinnedIds.push(messageId); return true; }
    };

    const result = await telegramBackup.backupNow({ ...source, bot });
    assert.deepEqual(result, { uploaded: true, pinned: true, messageId: 321 });
    assert.equal(uploaded.id, chatId);
    assert.match(uploaded.options.caption, /RESPALDO CIFRADO/);
    assert.equal(uploaded.fileOptions.filename.endsWith('.enc'), true);
    assert.equal(uploaded.document.includes(Buffer.from('whatsapp-auth-secret')), false);
    assert.deepEqual(pinnedIds, [321]);
});

test('restaura automáticamente el documento fijado en Telegram', async t => {
    const chatId = '-10090000000002';
    setTelegramEnvironment(t, chatId);
    const source = temporaryState(t, 'niku-telegram-restore-source-');
    const target = temporaryState(t, 'niku-telegram-restore-target-');
    populateState(source);
    const snapshot = telegramBackup.createEncryptedSnapshot(source, SECRET);
    const pinnedMessage = {
        message_id: 456,
        caption: `🔐 NIKU MD · RESPALDO CIFRADO\nHuella: ${snapshot.fingerprint}`,
        document: { file_id: 'file-456', file_size: snapshot.document.length }
    };
    const bot = { getChat: async () => ({ pinned_message: pinnedMessage }) };

    const restored = await telegramBackup.restoreBackup({
        ...target,
        bot,
        downloadFile: async (_bot, _token, fileId) => {
            assert.equal(fileId, 'file-456');
            return snapshot.document;
        }
    });
    assert.equal(restored, true);
    assert.deepEqual(fs.readJsonSync(target.dataFile), { coins: 1234, webProgress: ['rpg', 'perfil'] });
    assert.deepEqual(fs.readJsonSync(path.join(target.authDir, 'main', 'creds.json')), { registered: true, secret: 'whatsapp-auth-secret' });
    assert.equal(fs.readFileSync(path.join(target.uploadsDir, 'hero.txt'), 'utf8'), 'imagen-del-panel');
});


test('recupera bot_data.json si la copia local está corrupta y conserva una copia para diagnóstico', t => {
    const source = temporaryState(t, 'niku-telegram-corrupt-source-');
    const target = temporaryState(t, 'niku-telegram-corrupt-target-');
    populateState(source);
    fs.writeFileSync(target.dataFile, '{archivo roto');

    const snapshot = telegramBackup.createEncryptedSnapshot(source, SECRET);
    const decoded = telegramBackup.decryptPayload(snapshot.document, SECRET);
    const restoredCount = telegramBackup.restoreMissingFiles(decoded, target);

    assert.equal(restoredCount, 3);
    assert.deepEqual(fs.readJsonSync(target.dataFile), { coins: 1234, webProgress: ['rpg', 'perfil'] });
    const corruptCopy = fs.readdirSync(target.root).find(name => name.startsWith('bot_data.json.telegram-corrupt-'));
    assert.ok(corruptCopy, 'la versión corrupta se conserva separada');
});


test('responde a /backupid publicado en el canal con TELEGRAM_BACKUP_CHAT_ID', async () => {
    const listeners = {};
    const replies = [];
    const bot = {
        on: (event, handler) => { listeners[event] = handler; },
        sendMessage: async (...args) => { replies.push(args); }
    };
    assert.equal(telegramBackup.registerBackupIdCommand(bot), true);
    await listeners.channel_post({
        chat: { id: -1009876543210, type: 'channel' },
        message_id: 77,
        text: '/backupid@niku_backup_bot'
    });
    assert.equal(replies.length, 1);
    assert.equal(replies[0][0], -1009876543210);
    assert.match(replies[0][1], /TELEGRAM_BACKUP_CHAT_ID=-1009876543210/);
    assert.deepEqual(replies[0][2], { reply_to_message_id: 77 });

    await listeners.channel_post({ chat: { id: -1009876543210, type: 'channel' }, message_id: 78, text: '/otrocomando' });
    assert.equal(replies.length, 1);
});
