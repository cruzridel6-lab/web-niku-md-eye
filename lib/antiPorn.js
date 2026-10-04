const crypto = require('crypto');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const tf = require('@tensorflow/tfjs');
const nsfwjs = require('nsfwjs');
const sharp = require('sharp');

const execFileAsync = promisify(execFile);
const pending = new Set();
let modelPromise = null;
const sexualTextPattern = /(?:porn(?:o|ography)?|porno|pornografia|pornografía|nopor|xxx|nsfw|onlyfans|xvideos|pornhub|xnxx|redtube|spankbang|desnudad?[oa]|desnudos|contenido\s*sexual|sexo\s+expl[ií]cito|\bpack\b|\+18|18\+)/i;
const sexualLinkPattern = /https?:\/\/[^\s]*(?:porn|xxx|sex|xvideos|pornhub|xnxx|redtube|spankbang|onlyfans)[^\s]*/i;

function containsSexualText(text = '') {
    const value = String(text || '');
    return sexualLinkPattern.test(value) || sexualTextPattern.test(value);
}

async function mediaToBuffer(media, mediaType) {
    const stream = await downloadContentFromMessage(media, mediaType);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

async function visualFrameFromMessage(media, type) {
    const source = await mediaToBuffer(media, type === 'sticker' ? 'sticker' : type);
    if (type === 'image' || type === 'sticker') return { buffer: source, mime: media.mimetype || (type === 'sticker' ? 'image/webp' : 'image/jpeg') };
    const token = crypto.randomBytes(8).toString('hex');
    const input = path.join(os.tmpdir(), `niku-antiporn-${token}.mp4`);
    const output = path.join(os.tmpdir(), `niku-antiporn-${token}.jpg`);
    try {
        fs.writeFileSync(input, source);
        await execFileAsync('ffmpeg', ['-y', '-i', input, '-frames:v', '1', '-vf', 'scale=640:-1', output], { timeout: 20000 });
        return { buffer: fs.readFileSync(output), mime: 'image/jpeg' };
    } finally {
        fs.removeSync(input);
        fs.removeSync(output);
    }
}

async function loadLocalModel() {
    if (!modelPromise) {
        modelPromise = nsfwjs.load(process.env.NSFW_MODEL || 'MobileNetV2').catch(error => {
            modelPromise = null;
            throw error;
        });
    }
    return modelPromise;
}

async function classifySexualMedia(media, type) {
    if (!media) return false;
    try {
        const visual = await visualFrameFromMessage(media, type);
        const { data, info } = await sharp(visual.buffer)
            .resize(224, 224, { fit: 'cover' })
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
        const input = tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3], 'int32');
        try {
            const model = await loadLocalModel();
            const predictions = await model.classify(input);
            const scores = Object.fromEntries(predictions.map(item => [item.className, Number(item.probability) || 0]));
            const pornThreshold = Number(process.env.NSFW_PORN_THRESHOLD || 0.45);
            const sexyThreshold = Number(process.env.NSFW_SEXY_THRESHOLD || 0.70);
            const blocked = (scores.Porn || 0) >= pornThreshold || (scores.Hentai || 0) >= pornThreshold || (scores.Sexy || 0) >= sexyThreshold;
            if (blocked) console.log(`[Antiporno local] Contenido bloqueado: Porn=${(scores.Porn || 0).toFixed(2)} Hentai=${(scores.Hentai || 0).toFixed(2)} Sexy=${(scores.Sexy || 0).toFixed(2)}`);
            return blocked;
        } finally {
            input.dispose();
        }
    } catch (error) {
        console.error('[Antiporno local] No se pudo analizar el contenido:', error.message);
        return false;
    }
}

async function enforce({ session, msg, from, sender, messageContent, text, type, enabled }) {
    if (!from?.endsWith('@g.us') || !enabled || msg.key.fromMe) return false;
    const messageId = msg.key.id || `${from}:${sender}:${Date.now()}`;
    if (pending.has(messageId)) return false;
    pending.add(messageId);
    try {
        let blocked = containsSexualText(text);
        const media = messageContent?.imageMessage || messageContent?.videoMessage || messageContent?.stickerMessage;
        if (!blocked && media && ['imageMessage', 'videoMessage', 'stickerMessage'].includes(type)) {
            blocked = await classifySexualMedia(media, type.replace('Message', ''));
        }
        if (!blocked) return false;
        try { await session.sock.sendMessage(from, { delete: msg.key }); } catch (error) { session.sendLog(`Antiporno no pudo borrar el mensaje: ${error.message}`, 'warning'); }
        try { await session.sock.groupParticipantsUpdate(from, [sender], 'remove'); } catch (error) { session.sendLog(`Antiporno no pudo expulsar a ${sender}: ${error.message}`, 'warning'); }
        await session.sock.sendMessage(from, { text: '🚫 Contenido sexual o pornográfico eliminado. El remitente fue expulsado.' });
        return true;
    } finally {
        pending.delete(messageId);
    }
}

module.exports = { containsSexualText, classifySexualMedia, enforce, loadLocalModel };
