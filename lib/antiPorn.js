const crypto = require('crypto');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const sharp = require('sharp');

const execFileAsync = promisify(execFile);
const pending = new Set();
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
    if (type === 'image') return { buffer: source, mime: media.mimetype || 'image/jpeg' };
    const token = crypto.randomBytes(8).toString('hex');
    const input = path.join(os.tmpdir(), `niku-antiporn-${token}.${type === 'sticker' ? 'webp' : 'mp4'}`);
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

async function classifySexualMedia(openai, media, type) {
    if (!openai || !media) return false;
    try {
        let visual = await visualFrameFromMessage(media, type);
        if (type === 'sticker' && visual.mime === 'image/webp') {
            visual = { buffer: await sharp(visual.buffer).png().toBuffer(), mime: 'image/png' };
        }
        const completion = await openai.chat.completions.create({
            model: process.env.OPENAI_MODERATION_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'Clasifica imágenes para moderación de un grupo. Responde únicamente JSON válido con las claves sexual (boolean) y confidence (número entre 0 y 1). Marca sexual=true solo si hay desnudez explícita, actividad sexual, genitales, pornografía o una representación claramente sexual; no marques personas vestidas, trajes de baño normales, arte no explícito ni educación médica.' },
                { role: 'user', content: [{ type: 'text', text: '¿Este contenido debe bloquearse por ser sexual o pornográfico?' }, { type: 'image_url', image_url: { url: `data:${visual.mime};base64,${visual.buffer.toString('base64')}` } }] }
            ],
            temperature: 0,
            max_tokens: 80
        }, { timeout: 30000 });
        const raw = completion.choices?.[0]?.message?.content;
        const text = Array.isArray(raw) ? raw.map(part => part?.text || '').join('') : String(raw || '');
        const match = text.match(/\{[\s\S]*\}/);
        const result = match ? JSON.parse(match[0]) : null;
        return Boolean(result?.sexual === true && Number(result.confidence || 0) >= 0.7);
    } catch (error) {
        console.error('[Antiporno] No se pudo analizar el contenido:', error.message);
        return false;
    }
}

async function enforce({ session, msg, from, sender, messageContent, text, type, openai, enabled }) {
    if (!from?.endsWith('@g.us') || !enabled || msg.key.fromMe) return false;
    const messageId = msg.key.id || `${from}:${sender}:${Date.now()}`;
    if (pending.has(messageId)) return false;
    pending.add(messageId);
    try {
        let blocked = containsSexualText(text);
        const media = messageContent?.imageMessage || messageContent?.videoMessage || messageContent?.stickerMessage;
        if (!blocked && media && ['imageMessage', 'videoMessage', 'stickerMessage'].includes(type)) {
            blocked = await classifySexualMedia(openai, media, type.replace('Message', ''));
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

module.exports = { containsSexualText, classifySexualMedia, enforce };
