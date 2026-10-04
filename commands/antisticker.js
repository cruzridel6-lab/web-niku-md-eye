'use strict';

const WINDOW_MS = 15 * 24 * 60 * 60 * 1000;
const ALLOWED_CONSECUTIVE = 5;
const MAX_WARNINGS = 3;

function normalizeJid(value) { return String(value || '').split(':')[0].trim(); }
function isStickerMessage(messageContent) { return Boolean(messageContent?.stickerMessage); }
function ensureGroupState(botData, groupId) {
    botData.antiStickerGroups ||= {};
    botData.antiStickerGroups[groupId] ||= { enabled: false, users: {} };
    const state = botData.antiStickerGroups[groupId];
    state.users ||= {};
    return state;
}
async function antiStickerCommand(sock, from, msg, isAdmin, botData, saveBotData, args = []) {
    if (!from.endsWith('@g.us')) return sock.sendMessage(from, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: msg });
    if (!isAdmin) return sock.sendMessage(from, { text: '❌ Solo los administradores pueden configurar el antispam de stickers.' }, { quoted: msg });
    const state = ensureGroupState(botData, from);
    const action = String(args[0] || '').toLowerCase();
    if (['on', 'activar', 'enable'].includes(action)) {
        state.enabled = true;
        saveBotData();
        return sock.sendMessage(from, { text: '✅ *Antispam de stickers activado.*\n\nSe permiten 5 stickers seguidos. Desde el sexto se aplica una advertencia. Con 3 advertencias, el usuario será expulsado.\n\n⏳ Las advertencias se reinician cada 15 días.' }, { quoted: msg });
    }
    if (['off', 'desactivar', 'disable'].includes(action)) {
        state.enabled = false;
        saveBotData();
        return sock.sendMessage(from, { text: '❌ Antispam de stickers desactivado.' }, { quoted: msg });
    }
    if (['reset', 'reiniciar', 'limpiar'].includes(action)) {
        state.users = {};
        saveBotData();
        return sock.sendMessage(from, { text: '✅ Se reiniciaron los avisos y contadores de stickers de este grupo.' }, { quoted: msg });
    }
    return sock.sendMessage(from, { text: `🧩 *Antispam de stickers:* ${state.enabled ? 'ACTIVADO' : 'DESACTIVADO'}\n\n• Límite: *${ALLOWED_CONSECUTIVE} stickers seguidos*\n• Aviso desde: *${ALLOWED_CONSECUTIVE + 1}.° sticker*\n• Expulsión: *${MAX_WARNINGS}/3 avisos*\n• Reinicio: cada *15 días*\n\nUso: *.antiestiker on* | *.antiestiker off*` }, { quoted: msg });
}
function resetExpired(entry, now = Date.now()) {
    if (!entry.windowStartedAt || now - Number(entry.windowStartedAt) >= WINDOW_MS) {
        entry.warningCount = 0;
        entry.windowStartedAt = now;
    }
    if (!Number.isFinite(Number(entry.consecutive))) entry.consecutive = 0;
}
async function enforceStickerSpam({ sock, from, msg, sender, botJid, isAdmin, botData, saveBotData }) {
    const state = botData.antiStickerGroups?.[from];
    if (!state?.enabled || isAdmin || normalizeJid(sender) === normalizeJid(botJid)) return false;
    const key = normalizeJid(sender);
    const now = Date.now();
    const entry = state.users[key] ||= { consecutive: 0, warningCount: 0, windowStartedAt: now };
    resetExpired(entry, now);
    entry.consecutive += 1;
    if (entry.consecutive <= ALLOWED_CONSECUTIVE) {
        saveBotData();
        return false;
    }
    entry.warningCount += 1;
    entry.consecutive = 0;
    entry.lastWarningAt = new Date(now).toISOString();
    if (entry.warningCount >= MAX_WARNINGS) {
        try {
            await sock.sendMessage(from, { text: `🚫 @${key.split('@')[0]} recibió *3/3 avisos* por spam de stickers y será expulsado.`, mentions: [key] });
            await sock.groupParticipantsUpdate(from, [key], 'remove');
            delete state.users[key];
            saveBotData();
        } catch (error) {
            saveBotData();
            await sock.sendMessage(from, { text: `⚠️ @${key.split('@')[0]} llegó a *3/3 avisos*, pero no pude expulsarlo. Verifica que el bot sea administrador.`, mentions: [key] });
        }
        return true;
    }
    saveBotData();
    await sock.sendMessage(from, { text: `⚠️ *Aviso de stickers ${entry.warningCount}/3*\n\n@${key.split('@')[0]}, se permiten solo ${ALLOWED_CONSECUTIVE} stickers seguidos. El contador de avisos se reinicia cada 15 días.`, mentions: [key] });
    return true;
}
function noteNonSticker({ from, sender, botData }) {
    const state = botData.antiStickerGroups?.[from];
    const entry = state?.users?.[normalizeJid(sender)];
    if (entry) entry.consecutive = 0;
}
module.exports = antiStickerCommand;
module.exports.enforceStickerSpam = enforceStickerSpam;
module.exports.isStickerMessage = isStickerMessage;
module.exports.noteNonSticker = noteNonSticker;
module.exports.WINDOW_MS = WINDOW_MS;
