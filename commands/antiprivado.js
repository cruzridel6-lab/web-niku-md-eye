'use strict';

const inFlight = new Set();
const recentActions = new Map();
const ACTION_TTL = 15_000;
const MAX_AUDIT = 500;

function ensureConfig(botData) {
    botData.antiPrivate ||= {};
    botData.antiPrivate.stats ||= { blocked: 0, dangerous: 0, flood: 0, deleted: 0, lastAt: null };
    botData.antiPrivate.audit ||= [];
    return botData.antiPrivate;
}
function trimAudit(config) {
    if (config.audit.length > MAX_AUDIT) config.audit.splice(MAX_AUDIT);
}
function normalizeText(text) {
    return String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function dangerousReason(text) {
    const raw = String(text || '');
    const normalized = normalizeText(raw);
    const compact = normalized.replace(/[\s._-]+/g, '');
    const dangerous = [
        'bug', 'payload', 'crash', 'freeze', 'nuke', 'spam', 'locspam', 'vcardspam',
        'buttonspam', 'pollspam', 'contactspam', 'callbomb', 'smsbomb', 'lag', 'hack',
        'bomb', 'flood', 'massmention', 'mentionall', 'sendall', 'destroy', 'kill'
    ];
    const command = normalized.match(/(^|\s)\.([a-z0-9_-]+)/)?.[2] || '';
    const distance = (left, right) => {
        const row = Array.from({ length: right.length + 1 }, (_, i) => i);
        for (let i = 1; i <= left.length; i++) {
            let diagonal = row[0]; row[0] = i;
            for (let j = 1; j <= right.length; j++) {
                const next = row[j];
                row[j] = left[i - 1] === right[j - 1] ? diagonal : Math.min(row[j] + 1, row[j - 1] + 1, diagonal + 1);
                diagonal = next;
            }
        }
        return row[right.length];
    };
    if (command && dangerous.some(item => command === item || (item.length >= 4 && distance(command, item) <= 1))) return 'comando-peligroso';
    if (compact.includes('forcecloseios') || compact.includes('forcecloseandroid') || compact.includes('forcecloseandriod')) return 'force-close-ios-android';
    if (compact.includes('blanksyxs7')) return 'blank-syxs7';
    if (compact.includes('delayinvisible')) return 'delay-invisible';
    if (compact.includes('crashiam') || compact.includes('crasiham')) return 'crashiam-file';
    if (compact.includes('gcfrz')) return 'gcfrz-file';
    if (compact.includes('losinvisible')) return 'los-invisible-file';
    if (compact.includes('killsystem')) return 'kill-system-file';
    if (compact.includes('stickercrash')) return 'sticker-crash-file';
    if (compact.includes('xbetainvis')) return 'xbetainvis-file';
    if (compact.includes('xdelay')) return 'xdelay-file';
    if (compact.includes('xgc')) return 'xgc-file';
    if (/\b(?:bug|crash|freeze|nuke|spam|bomb|hack|lag|flood)\s*(?:payload|attack|bomber|bomb|spam)\b/.test(normalized)) return 'payload';
    if (/\u0000/.test(raw)) return 'caracter-nulo';
    const invisible = (raw.match(/[\u034f\u200b\u200e\u200f\u202a-\u202e\u2060\ufeff]/g) || []).length;
    if (raw.length > 1800 && invisible > 80) return 'caracteres-invisibles';
    if (raw.length > 6000) return 'mensaje-excesivo';
    if ((raw.match(/https?:\/\//gi) || []).length >= 5) return 'flood-enlaces';
    if (/(.)\1{120,}/u.test(raw)) return 'flood-repeticion';
    if ((raw.match(/\./g) || []).length > 40 && raw.length < 400) return 'flood-comandos';
    return null;
}

module.exports = async function antiPrivadoCommand(sock, chatId, msg, isAdmin, botData, saveBotData, args = []) {
    if (!isAdmin) return sock.sendMessage(chatId, { text: '❌ Solo el propietario o un administrador autorizado puede usar este comando.' }, { quoted: msg });
    const config = ensureConfig(botData);
    const action = String(args[0] || '').toLowerCase();
    if (['on', '1', 'activar', 'enable'].includes(action)) {
        config.enabled = true; config.enabledAt = new Date().toISOString(); saveBotData();
        return sock.sendMessage(chatId, { text: '🔒 *ANTIPRIVADO REFORZADO ACTIVADO*\n\nBloqueo inmediato de privados no autorizados.\n✅ Borra mensaje\n✅ Bloquea contacto\n✅ Intenta eliminar chat\n✅ Detecta payload, flood, spam y variantes\n✅ Acciones paralelas para responder más rápido\n\nEl propietario queda exento.' }, { quoted: msg });
    }
    if (['off', '0', 'desactivar', 'disable'].includes(action)) {
        config.enabled = false; config.disabledAt = new Date().toISOString(); saveBotData();
        return sock.sendMessage(chatId, { text: '🔓 *ANTIPRIVADO DESACTIVADO*\n\nLos chats privados volverán a procesarse normalmente.' }, { quoted: msg });
    }
    const stats = config.stats;
    return sock.sendMessage(chatId, { text: `🔒 *ANTIPRIVADO REFORZADO*\n\nEstado: *${config.enabled ? 'ACTIVADO' : 'DESACTIVADO'}*\n🚫 Bloqueos: *${stats.blocked}*\n⚠️ Firmas peligrosas: *${stats.dangerous}*\n🌊 Flood detectado: *${stats.flood}*\n🗑️ Mensajes borrados: *${stats.deleted}*\n\nUsa *.antiprivado on/off*.` }, { quoted: msg });
};

module.exports.aliases = ['antiprivate', 'antipv'];
module.exports.isDangerousPrivateCommand = text => Boolean(dangerousReason(text));
module.exports.enforcePrivate = async function enforcePrivate(sock, msg, from, text, botData, isExempt = false, log = () => {}) {
    const config = ensureConfig(botData);
    if (isExempt || !config.enabled || String(from).endsWith('@g.us') || from === 'status@broadcast') return false;
    const sender = msg?.key?.participantAlt || msg?.key?.senderPn || msg?.key?.participant || from;
    const target = String(sender).endsWith('@lid') && (msg?.key?.participantAlt || msg?.key?.senderPn) ? (msg.key.participantAlt || msg.key.senderPn) : sender;
    const actionKey = `${from}:${msg?.key?.id || 'unknown'}`;
    const now = Date.now();
    for (const [key, expires] of recentActions) if (expires <= now) recentActions.delete(key);
    if (inFlight.has(actionKey) || recentActions.has(actionKey)) return true;
    inFlight.add(actionKey); recentActions.set(actionKey, now + ACTION_TTL);
    const reason = dangerousReason(text);
    config.stats.blocked += 1;
    if (reason) config.stats.dangerous += 1;
    if (reason?.startsWith('flood') || reason === 'mensaje-excesivo') config.stats.flood += 1;
    config.stats.lastAt = new Date().toISOString();
    config.audit.unshift({ at: config.stats.lastAt, jid: String(target), reason: reason || 'privado-no-autorizado' });
    trimAudit(config);
    try {
        const deletion = sock.sendMessage(from, { delete: msg.key }).then(() => { config.stats.deleted += 1; }).catch(error => log(`Antiprivado no pudo borrar: ${error.message}`, 'warning'));
        const blocking = sock.updateBlockStatus(target, 'block').catch(error => log(`Antiprivado no pudo bloquear ${target}: ${error.message}`, 'warning'));
        const chatDeletion = typeof sock.chatModify === 'function'
            ? sock.chatModify({ delete: true, lastMessages: [{ key: msg.key, messageTimestamp: msg.messageTimestamp || Math.floor(now / 1000) }] }, from).catch(error => log(`Antiprivado no pudo eliminar chat ${from}: ${error.message}`, 'warning'))
            : Promise.resolve();
        await Promise.allSettled([deletion, blocking, chatDeletion]);
    } finally {
        inFlight.delete(actionKey);
    }
    return true;
};
