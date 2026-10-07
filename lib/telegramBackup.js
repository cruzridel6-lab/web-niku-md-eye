const crypto = require('crypto');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

const timers = new Map();
const uploads = new Map();
const lastBackups = new Map();
const MAX_DOCUMENT_BYTES = 18 * 1024 * 1024;
const DEBOUNCE_MS = 30 * 1000;
const MIN_UPLOAD_INTERVAL_MS = 2 * 60 * 1000;
const BACKUP_MARKER = '🔐 NIKU MD · RESPALDO CIFRADO';

function config() {
    return {
        token: String(process.env.TELEGRAM_TOKEN_BOT || '').trim(),
        chatId: String(process.env.TELEGRAM_CHAT_ID || '').trim(),
        encryptionKey: String(process.env.TELEGRAM_BACKUP_ENCRYPTION_KEY || process.env.BACKUP_ENCRYPTION_KEY || '')
    };
}

function missingVariables() {
    const current = config();
    return [
        !current.token && 'TELEGRAM_TOKEN_BOT',
        !current.chatId && 'TELEGRAM_CHAT_ID',
        !current.encryptionKey && 'TELEGRAM_BACKUP_ENCRYPTION_KEY (o BACKUP_ENCRYPTION_KEY)',
        current.encryptionKey && current.encryptionKey.trim().length < 32 && 'TELEGRAM_BACKUP_ENCRYPTION_KEY (mínimo 32 caracteres)'
    ].filter(Boolean);
}

function enabled() {
    return missingVariables().length === 0;
}

function keyFromSecret(secret) {
    if (String(secret || '').trim().length < 32) {
        throw new Error('La clave de cifrado de Telegram debe tener al menos 32 caracteres.');
    }
    return crypto.createHash('sha256').update(String(secret)).digest();
}

function encryptPayload(payload, secret) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyFromSecret(secret), iv);
    cipher.setAAD(Buffer.from('niku-md-telegram-backup:v1'));
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
    return Buffer.from(JSON.stringify({
        version: 1,
        algorithm: 'aes-256-gcm',
        iv: iv.toString('base64'),
        tag: cipher.getAuthTag().toString('base64'),
        data: encrypted.toString('base64')
    }), 'utf8');
}

function decryptPayload(serialized, secret) {
    const envelope = JSON.parse(Buffer.isBuffer(serialized) ? serialized.toString('utf8') : String(serialized));
    if (envelope.version !== 1 || envelope.algorithm !== 'aes-256-gcm') throw new Error('Formato de respaldo Telegram no compatible.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyFromSecret(secret), Buffer.from(envelope.iv, 'base64'));
    decipher.setAAD(Buffer.from('niku-md-telegram-backup:v1'));
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
    const clear = Buffer.concat([
        decipher.update(Buffer.from(envelope.data, 'base64')),
        decipher.final()
    ]);
    return JSON.parse(clear.toString('utf8'));
}

function collectFiles(dataFile, authDir, uploadsDir) {
    const files = {};
    if (fs.existsSync(dataFile) && fs.statSync(dataFile).isFile()) {
        files['bot_data.json'] = fs.readFileSync(dataFile).toString('base64');
    }
    const collectDirectory = (root, prefix) => {
        if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return;
        const walk = (directory) => {
            for (const name of fs.readdirSync(directory)) {
                const full = path.join(directory, name);
                const stats = fs.lstatSync(full);
                if (stats.isSymbolicLink()) continue;
                if (stats.isDirectory()) {
                    walk(full);
                    continue;
                }
                if (!stats.isFile()) continue;
                const relative = path.relative(root, full).split(path.sep).join('/');
                files[`${prefix}/${relative}`] = fs.readFileSync(full).toString('base64');
            }
        };
        walk(root);
    };
    collectDirectory(authDir, 'auth_info');
    collectDirectory(uploadsDir, 'uploads');
    return files;
}

function createEncryptedSnapshot(options, secret = config().encryptionKey) {
    const files = collectFiles(options.dataFile, options.authDir, options.uploadsDir);
    const payload = { version: 1, createdAt: new Date().toISOString(), files };
    const fingerprint = crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex');
    const document = encryptPayload(payload, secret);
    if (document.length > MAX_DOCUMENT_BYTES) {
        throw new Error(`El respaldo cifrado supera el límite seguro de ${Math.floor(MAX_DOCUMENT_BYTES / 1024 / 1024)} MB para restaurarlo desde Telegram.`);
    }
    return { payload, fingerprint, document };
}

function restoreMissingFiles(payload, options) {
    if (!payload || payload.version !== 1 || !payload.files || typeof payload.files !== 'object' || Array.isArray(payload.files)) {
        throw new Error('El respaldo Telegram no contiene archivos válidos.');
    }
    const entries = Object.entries(payload.files);
    if (entries.length > 10000) throw new Error('El respaldo Telegram contiene demasiados archivos.');
    let restored = 0;
    for (const [name, encoded] of entries) {
        if (typeof encoded !== 'string') throw new Error('El contenido de un archivo del respaldo no es válido.');
        if (name === 'bot_data.json') {
            if (hasUsableLocalFile(options.dataFile, true)) continue;
            const bytes = Buffer.from(encoded, 'base64');
            fs.ensureDirSync(path.dirname(options.dataFile));
            const temporary = `${options.dataFile}.telegram-restore.tmp`;
            fs.writeFileSync(temporary, bytes, { mode: 0o600 });
            fs.renameSync(temporary, options.dataFile);
            restored++;
            continue;
        }
        const isAuth = name.startsWith('auth_info/');
        const isUpload = name.startsWith('uploads/');
        if (!isAuth && !isUpload) continue;
        const root = path.resolve(isAuth ? options.authDir : options.uploadsDir);
        const relative = name.slice(isAuth ? 'auth_info/'.length : 'uploads/'.length);
        if (!relative || relative.split('/').some(part => !part || part === '.' || part === '..')) {
            throw new Error('El respaldo Telegram contiene una ruta inválida.');
        }
        const destination = path.resolve(root, ...relative.split('/'));
        if (!destination.startsWith(root + path.sep)) throw new Error('El respaldo Telegram contiene una ruta fuera del directorio permitido.');
        if (hasUsableLocalFile(destination, isAuth && relative.endsWith('.json'))) continue;
        fs.ensureDirSync(path.dirname(destination));
        fs.writeFileSync(destination, Buffer.from(encoded, 'base64'), { mode: 0o600 });
        restored++;
    }
    return restored;
}

function hasUsableLocalFile(filePath, validateJson) {
    if (!fs.existsSync(filePath)) return false;
    if (!validateJson) return true;
    try {
        const value = fs.readJsonSync(filePath);
        if (value && typeof value === 'object' && !Array.isArray(value)) return true;
    } catch (error) {}
    fs.renameSync(filePath, `${filePath}.telegram-corrupt-${Date.now()}`);
    return false;
}

function backupCaption(createdAt, fingerprint) {
    return `${BACKUP_MARKER}\nFecha: ${createdAt}\nHuella: ${fingerprint}`;
}

function fingerprintFromCaption(message) {
    const line = String(message?.caption || '').split('\n').find(value => value.startsWith('Huella:'));
    return line ? line.slice('Huella:'.length).trim() : '';
}

function isBackupMessage(message) {
    return Boolean(message?.document && String(message.caption || '').startsWith(BACKUP_MARKER));
}

async function downloadTelegramDocument(bot, token, fileId, fileSize) {
    if (Number(fileSize) > MAX_DOCUMENT_BYTES) throw new Error('El archivo fijado supera el límite seguro para descargarlo desde Telegram.');
    const file = await bot.getFile(fileId);
    if (!file?.file_path) throw new Error('Telegram no proporcionó la ruta del documento fijado.');
    if (Number(file.file_size) > MAX_DOCUMENT_BYTES) throw new Error('El archivo fijado supera el límite seguro para descargarlo desde Telegram.');
    const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxContentLength: MAX_DOCUMENT_BYTES,
        maxBodyLength: MAX_DOCUMENT_BYTES
    });
    return Buffer.from(response.data);
}

async function backupNow(options) {
    const current = config();
    if (!enabled()) return { skipped: true, reason: 'missing_config' };
    if (!options?.bot || typeof options.bot.sendDocument !== 'function') throw new Error('No está disponible el cliente de respaldo Telegram.');
    const snapshot = createEncryptedSnapshot(options, current.encryptionKey);
    const chatId = current.chatId;
    const last = lastBackups.get(chatId);
    const chat = await options.bot.getChat(chatId);
    const oldPinned = isBackupMessage(chat?.pinned_message) ? chat.pinned_message : null;
    if (last?.fingerprint === snapshot.fingerprint && oldPinned && fingerprintFromCaption(oldPinned) === snapshot.fingerprint) {
        last.pinned = true;
        return { skipped: true, unchanged: true };
    }
    if (last?.fingerprint === snapshot.fingerprint && !last.pinned && last.messageId) {
        try {
            await options.bot.pinChatMessage(chatId, last.messageId, { disable_notification: true });
            last.pinned = true;
            return { skipped: true, repinned: true };
        } catch (error) {
            console.error('[Respaldo Telegram] El archivo existe, pero aún no se pudo fijar:', error.message);
            last.pinned = false;
        }
    }

    const date = snapshot.payload.createdAt.replace(/[:.]/g, '-');
    const message = await options.bot.sendDocument(chatId, snapshot.document, {
        caption: backupCaption(snapshot.payload.createdAt, snapshot.fingerprint),
        disable_notification: true
    }, {
        filename: `niku-md-respaldo-${date}.enc`,
        contentType: 'application/octet-stream'
    });
    if (!message?.message_id) throw new Error('Telegram no confirmó la carga del archivo de respaldo.');

    const record = { fingerprint: snapshot.fingerprint, messageId: message.message_id, pinned: false };
    lastBackups.set(chatId, record);
    try {
        await options.bot.pinChatMessage(chatId, message.message_id, { disable_notification: true });
        record.pinned = true;
    } catch (error) {
        console.error('[Respaldo Telegram] Archivo subido, pero no se pudo fijar; revisa que el bot tenga permiso para fijar mensajes:', error.message);
        return { uploaded: true, pinned: false, messageId: message.message_id };
    }

    if (oldPinned && oldPinned.message_id !== message.message_id) {
        try {
            const botInfo = await options.bot.getMe();
            if (oldPinned.from?.id === botInfo?.id) {
                await options.bot.unpinChatMessage(chatId, oldPinned.message_id);
                await options.bot.deleteMessage(chatId, oldPinned.message_id).catch(() => {});
            }
        } catch (error) {
            console.error('[Respaldo Telegram] No se pudo limpiar el archivo anterior fijado:', error.message);
        }
    }
    console.log('[Respaldo Telegram] Copia cifrada cargada y fijada en el chat privado.');
    return { uploaded: true, pinned: true, messageId: message.message_id };
}

function scheduleBackup(options) {
    if (!enabled() || !options?.bot) return;
    const chatId = config().chatId;
    clearTimeout(timers.get(chatId));
    const lastUploadAt = Number(lastBackups.get(chatId)?.uploadedAt) || 0;
    const waitForInterval = Math.max(0, MIN_UPLOAD_INTERVAL_MS - (Date.now() - lastUploadAt));
    const timer = setTimeout(() => {
        timers.delete(chatId);
        const previous = uploads.get(chatId) || Promise.resolve();
        const next = previous.catch(() => {}).then(async () => {
            const result = await backupNow(options);
            if (result.uploaded || result.unchanged || result.repinned) {
                const record = lastBackups.get(chatId);
                if (record) record.uploadedAt = Date.now();
            }
        }).catch(error => {
            console.error('[Respaldo Telegram] No se pudo actualizar la copia cifrada:', error.response?.body?.description || error.message);
        });
        uploads.set(chatId, next);
    }, Math.max(DEBOUNCE_MS, waitForInterval));
    timer.unref?.();
    timers.set(chatId, timer);
}

async function restoreBackup(options) {
    const current = config();
    if (!enabled()) return false;
    if (!options?.bot || typeof options.bot.getChat !== 'function') throw new Error('No está disponible el cliente de respaldo Telegram.');
    const chat = await options.bot.getChat(current.chatId);
    const pinned = chat?.pinned_message;
    if (!isBackupMessage(pinned)) {
        console.log('[Respaldo Telegram] No hay un archivo de respaldo NIKU MD fijado en el chat.');
        return false;
    }
    const fileId = pinned.document.file_id;
    const encrypted = options.downloadFile
        ? await options.downloadFile(options.bot, current.token, fileId, pinned.document.file_size)
        : await downloadTelegramDocument(options.bot, current.token, fileId, pinned.document.file_size);
    const payload = decryptPayload(encrypted, current.encryptionKey);
    const actualFingerprint = crypto.createHash('sha256').update(JSON.stringify(payload.files || {})).digest('hex');
    const savedFingerprint = fingerprintFromCaption(pinned);
    if (savedFingerprint && savedFingerprint !== actualFingerprint) throw new Error('La huella del archivo fijado no coincide con su contenido.');
    const restored = restoreMissingFiles(payload, options);
    const fingerprint = savedFingerprint || actualFingerprint;
    if (fingerprint) lastBackups.set(current.chatId, { fingerprint, messageId: pinned.message_id, pinned: true, uploadedAt: Date.now() });
    console.log(`[Respaldo Telegram] Copia cifrada validada; se restauraron ${restored} archivos que faltaban.`);
    return true;
}

module.exports = {
    enabled,
    missingVariables,
    scheduleBackup,
    backupNow,
    restoreBackup,
    createEncryptedSnapshot,
    decryptPayload,
    restoreMissingFiles,
    MAX_DOCUMENT_BYTES
};
