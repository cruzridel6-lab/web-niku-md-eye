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

module.exports = async function stickerCommand(sock, chatId, msg) {
    let tmpFile;
    try {
        const selected = getMedia(msg);
        if (!selected) {
            return await sock.sendMessage(chatId, {
                text: '⚠️ Envía una imagen/video o responde a uno con *.sticker*.'
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
