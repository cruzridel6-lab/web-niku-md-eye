const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');

function unwrapMessage(message) {
    let current = message || {};
    while (current.ephemeralMessage?.message || current.viewOnceMessage?.message || current.viewOnceMessageV2?.message) {
        current = current.ephemeralMessage?.message || current.viewOnceMessage?.message || current.viewOnceMessageV2?.message;
    }
    return current;
}

function getMedia(msg) {
    const message = unwrapMessage(msg.message);
    const quoted = unwrapMessage(message.extendedTextMessage?.contextInfo?.quotedMessage);
    const source = quoted.imageMessage || quoted.videoMessage
        ? quoted
        : message.imageMessage || message.videoMessage
            ? message
            : null;

    if (!source) return null;
    if (source.imageMessage) return { media: source.imageMessage, type: 'image' };
    if (source.videoMessage) return { media: source.videoMessage, type: 'video' };
    return null;
}

function escapeXml(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function wrapText(value, maxChars = 18) {
    const lines = [];
    let line = '';
    for (const word of String(value).trim().split(/\s+/)) {
        if (word.length > maxChars) {
            if (line) lines.push(line);
            for (let i = 0; i < word.length; i += maxChars) lines.push(word.slice(i, i + maxChars));
            line = '';
        } else if (!line) line = word;
        else if (`${line} ${word}`.length <= maxChars) line += ` ${word}`;
        else { lines.push(line); line = word; }
    }
    if (line) lines.push(line);
    return lines.slice(0, 8);
}

async function createTextSticker(text) {
    const lines = wrapText(text);
    const fontSize = lines.length > 5 ? 32 : lines.length > 3 ? 38 : 46;
    const lineHeight = fontSize + 10;
    const startY = 256 - ((lines.length - 1) * lineHeight) / 2 + fontSize * 0.35;
    const textNodes = lines.map((line, index) => `<text x="256" y="${startY + index * lineHeight}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}px" font-weight="700" fill="#ffffff" stroke="#151522" stroke-width="3" paint-order="stroke">${escapeXml(line)}</text>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#ec4899"/></linearGradient><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-opacity=".35"/></filter></defs><rect x="34" y="54" width="444" height="404" rx="58" fill="url(#bg)" filter="url(#shadow)"/><circle cx="88" cy="112" r="22" fill="#ffffff" opacity=".18"/><circle cx="430" cy="400" r="32" fill="#ffffff" opacity=".14"/>${textNodes}</svg>`;
    return sharp(Buffer.from(svg)).webp({ quality: 90, effort: 4 }).toBuffer();
}

function runFfmpeg(args) {
    return new Promise((resolve, reject) => {
        const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        child.stderr.on('data', chunk => { stderr += chunk.toString(); });
        child.once('error', reject);
        child.once('close', code => {
            if (code === 0) return resolve();
            reject(new Error(`FFmpeg terminó con código ${code}${stderr ? `: ${stderr.slice(-300)}` : ''}`));
        });
    });
}

module.exports = async function stickerCommand(sock, chatId, msg, textArg = '') {
    let tmpFile;
    try {
        const selected = getMedia(msg);
        if (!selected && String(textArg).trim()) {
            await sock.sendMessage(chatId, { text: '✨ Creando sticker con texto...' }, { quoted: msg });
            const stickerBuffer = await createTextSticker(String(textArg).trim());
            return await sock.sendMessage(chatId, { sticker: stickerBuffer, isAnimated: false }, { quoted: msg });
        }
        if (!selected) {
            return await sock.sendMessage(chatId, {
                text: '⚠️ Usa *.sticker <texto>* para crear un sticker con texto, o envía/responde a una imagen o video.'
            }, { quoted: msg });
        }

        await sock.sendMessage(chatId, { text: '✨ Convirtiendo a sticker...' }, { quoted: msg });

        const stream = await downloadContentFromMessage(selected.media, selected.type);
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const inputBuffer = Buffer.concat(chunks);
        if (!inputBuffer.length) throw new Error('No se pudo descargar el archivo multimedia.');

        await fs.ensureDir(path.join(__dirname, '..', 'data'));
        tmpFile = path.join(__dirname, '..', 'data', `sticker_${Date.now()}_${Math.random().toString(36).slice(2)}.webp`);

        if (selected.type === 'image') {
            await sharp(inputBuffer)
                .rotate()
                .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .webp({ quality: 82, effort: 4 })
                .toFile(tmpFile);
        } else {
            const inputFile = `${tmpFile}.input`;
            await fs.writeFile(inputFile, inputBuffer);
            try {
                await runFfmpeg([
                    '-y', '-i', inputFile,
                    '-t', '10', '-an',
                    '-vf', 'fps=15,scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,format=yuva420p',
                    '-c:v', 'libwebp', '-lossless', '0', '-q:v', '65', '-loop', '0',
                    tmpFile
                ]);
            } finally {
                await fs.remove(inputFile);
            }
        }

        const stickerBuffer = await fs.readFile(tmpFile);
        if (!stickerBuffer.length) throw new Error('No se creó el sticker WebP.');

        await sock.sendMessage(chatId, {
            sticker: stickerBuffer,
            isAnimated: selected.type === 'video'
        }, { quoted: msg });
    } catch (error) {
        console.error('Error en sticker:', error);
        await sock.sendMessage(chatId, {
            text: `❌ No pude convertirlo en sticker: ${error.message}`
        }, { quoted: msg });
    } finally {
        if (tmpFile) await fs.remove(tmpFile).catch(() => {});
    }
};
