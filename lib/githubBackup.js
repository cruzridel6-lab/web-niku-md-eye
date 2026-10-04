const crypto = require('crypto');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

const timers = new Map();
const uploads = new Map();

function config() {
    return {
        token: process.env.GITHUB_BACKUP_TOKEN,
        repo: process.env.GITHUB_BACKUP_REPO,
        branch: process.env.GITHUB_BACKUP_BRANCH || 'main',
        // GitHub crea automáticamente `data/` al guardar el primer respaldo.
        // El contenido se cifra antes de salir del servidor.
        filePath: process.env.GITHUB_BACKUP_PATH || 'data/persistent-state.enc',
        encryptionKey: process.env.BACKUP_ENCRYPTION_KEY
    };
}

function enabled() {
    const value = config();
    return Boolean(value.token && value.repo && value.encryptionKey);
}

function keyFromSecret(secret) {
    return crypto.createHash('sha256').update(String(secret)).digest();
}

function encrypt(payload, secret) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyFromSecret(secret), iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
    return JSON.stringify({
        version: 1,
        algorithm: 'aes-256-gcm',
        iv: iv.toString('base64'),
        tag: cipher.getAuthTag().toString('base64'),
        data: encrypted.toString('base64')
    });
}

function decrypt(serialized, secret) {
    const envelope = JSON.parse(serialized);
    if (envelope.version !== 1 || envelope.algorithm !== 'aes-256-gcm') throw new Error('Formato de respaldo no compatible');
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyFromSecret(secret), Buffer.from(envelope.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
    const clear = Buffer.concat([
        decipher.update(Buffer.from(envelope.data, 'base64')),
        decipher.final()
    ]);
    return JSON.parse(clear.toString('utf8'));
}

function collectFiles(dataFile, authDir, uploadsDir) {
    const files = {};
    if (fs.existsSync(dataFile)) files['bot_data.json'] = fs.readFileSync(dataFile).toString('base64');
    if (fs.existsSync(authDir)) {
        const walk = (directory) => {
            for (const name of fs.readdirSync(directory)) {
                const full = path.join(directory, name);
                const relative = path.relative(authDir, full).split(path.sep).join('/');
                if (fs.statSync(full).isDirectory()) walk(full);
                else files[`auth_info/${relative}`] = fs.readFileSync(full).toString('base64');
            }
        };
        walk(authDir);
    }
    if (fs.existsSync(uploadsDir)) {
        const walkUploads = (directory) => {
            for (const name of fs.readdirSync(directory)) {
                const full = path.join(directory, name);
                const relative = path.relative(uploadsDir, full).split(path.sep).join('/');
                if (fs.statSync(full).isDirectory()) walkUploads(full);
                else files[`uploads/${relative}`] = fs.readFileSync(full).toString('base64');
            }
        };
        walkUploads(uploadsDir);
    }
    return files;
}

function applyFiles(payload, dataFile, authDir, uploadsDir) {
    if (!payload || !payload.files || typeof payload.files !== 'object') throw new Error('El respaldo no contiene archivos válidos');
    for (const [name, encoded] of Object.entries(payload.files)) {
        if (name === 'bot_data.json') {
            fs.ensureDirSync(path.dirname(dataFile));
            fs.writeFileSync(`${dataFile}.restore.tmp`, Buffer.from(encoded, 'base64'));
            fs.renameSync(`${dataFile}.restore.tmp`, dataFile);
            continue;
        }
        const isAuth = name.startsWith('auth_info/');
        const isUpload = name.startsWith('uploads/');
        if (!isAuth && !isUpload) continue;
        const root = isAuth ? authDir : uploadsDir;
        const relative = name.slice(isAuth ? 'auth_info/'.length : 'uploads/'.length);
        const destination = path.resolve(root, relative);
        if (!destination.startsWith(path.resolve(root) + path.sep)) throw new Error('Ruta de respaldo inválida');
        fs.ensureDirSync(path.dirname(destination));
        fs.writeFileSync(destination, Buffer.from(encoded, 'base64'));
    }
}

function headers(token) {
    return {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
    };
}

async function getRemote(c) {
    const url = `https://api.github.com/repos/${c.repo}/contents/${c.filePath}`;
    try {
        const response = await axios.get(url, { headers: headers(c.token), params: { ref: c.branch }, timeout: 15000 });
        return { content: Buffer.from(response.data.content.replace(/\n/g, ''), 'base64').toString('utf8'), sha: response.data.sha };
    } catch (error) {
        if (error.response?.status === 404) return null;
        throw error;
    }
}

async function uploadNow(options) {
    const c = config();
    if (!enabled()) return { skipped: true };
    const payload = {
        createdAt: new Date().toISOString(),
        files: collectFiles(options.dataFile, options.authDir, options.uploadsDir)
    };
    const encrypted = encrypt(payload, c.encryptionKey);
    const remote = await getRemote(c);
    const url = `https://api.github.com/repos/${c.repo}/contents/${c.filePath}`;
    const body = {
        message: 'chore: actualizar respaldo cifrado del bot',
        content: Buffer.from(encrypted, 'utf8').toString('base64'),
        branch: c.branch
    };
    if (remote?.sha) body.sha = remote.sha;
    await axios.put(url, body, { headers: headers(c.token), timeout: 20000 });
    console.log('[Backup] Respaldo cifrado actualizado en GitHub.');
    return { skipped: false };
}

function scheduleBackup(options) {
    if (!enabled()) return;
    clearTimeout(timers.get(options.dataFile));
    timers.set(options.dataFile, setTimeout(async () => {
        timers.delete(options.dataFile);
        const previous = uploads.get(options.dataFile) || Promise.resolve();
        const next = previous.catch(() => {}).then(() => uploadNow(options)).catch(error => {
            console.error('[Backup] No se pudo actualizar GitHub:', error.response?.data?.message || error.message);
        });
        uploads.set(options.dataFile, next);
        await next;
    }, 30000));
}

async function restoreBackup(options) {
    const c = config();
    if (!enabled()) return false;
    const remote = await getRemote(c);
    if (!remote) {
        console.log('[Backup] No existe un respaldo remoto todavía.');
        return false;
    }
    const payload = decrypt(remote.content, c.encryptionKey);
    applyFiles(payload, options.dataFile, options.authDir, options.uploadsDir);
    console.log('[Backup] Respaldo cifrado restaurado desde GitHub.');
    return true;
}

module.exports = { enabled, scheduleBackup, restoreBackup };
