'use strict';

module.exports = async function antiPrivadoCommand(sock, chatId, msg, isAdmin, botData, saveBotData, args = []) {
    if (!isAdmin) return sock.sendMessage(chatId, { text: '❌ Solo el propietario o un administrador autorizado puede usar este comando.' }, { quoted: msg });
    const action = String(args[0] || '').toLowerCase();
    if (['on', '1', 'activar', 'enable'].includes(action)) {
        botData.antiPrivate = { enabled: true, enabledAt: new Date().toISOString() };
        saveBotData();
        return sock.sendMessage(chatId, { text: '🔒 *ANTIPRIVADO ACTIVADO*\n\nLos chats privados nuevos serán bloqueados automáticamente.\nEl mensaje recibido se eliminará cuando WhatsApp lo permita.\n\nEl propietario y el bot quedan exentos.' }, { quoted: msg });
    }
    if (['off', '0', 'desactivar', 'disable'].includes(action)) {
        botData.antiPrivate = { enabled: false, disabledAt: new Date().toISOString() };
        saveBotData();
        return sock.sendMessage(chatId, { text: '🔓 *ANTIPRIVADO DESACTIVADO*\n\nLos chats privados volverán a procesarse normalmente.' }, { quoted: msg });
    }
    const enabled = Boolean(botData.antiPrivate?.enabled);
    return sock.sendMessage(chatId, { text: `🔒 *ANTIPRIVADO*\n\nEstado: *${enabled ? 'ACTIVADO' : 'DESACTIVADO'}*\n\nUsa *.antiprivado on* o *.antiprivado off*.` }, { quoted: msg });
};

module.exports.aliases = ['antiprivate', 'antipv'];

module.exports.isDangerousPrivateCommand = function isDangerousPrivateCommand(text) {
    const normalized = String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
                row[j] = left[i - 1] === right[j - 1]
                    ? diagonal
                    : Math.min(row[j] + 1, row[j - 1] + 1, diagonal + 1);
                diagonal = next;
            }
        }
        return row[right.length];
    };
    const similarCommand = command && dangerous.some(item => command === item || (item.length >= 4 && distance(command, item) <= 1));
    const payloadWords = /\b(?:bug|crash|freeze|nuke|spam|bomb|hack|lag|flood)\s*(?:payload|attack|bomber|bomb|spam)\b/.test(normalized);
    const hostileChars = /\u0000/.test(String(text || '')) || (String(text || '').length > 2500 && (String(text || '').match(/[\u034f\u200e\u200f\u200b]/g) || []).length > 100);
    return Boolean(similarCommand || payloadWords || hostileChars);
};

module.exports.enforcePrivate = async function enforcePrivate(sock, msg, from, text, botData, isExempt = false, log = () => {}) {
    if (isExempt || !botData.antiPrivate?.enabled || String(from).endsWith('@g.us') || from === 'status@broadcast') return false;
    const dangerous = module.exports.isDangerousPrivateCommand(text);
    const sender = msg?.key?.participantAlt || msg?.key?.senderPn || msg?.key?.participant || from;
    const target = String(sender).endsWith('@lid') && (msg?.key?.participantAlt || msg?.key?.senderPn) ? (msg.key.participantAlt || msg.key.senderPn) : sender;
    try { await sock.sendMessage(from, { delete: msg.key }); } catch (error) { log(`Antiprivado no pudo borrar el mensaje: ${error.message}`, 'warning'); }
    try { await sock.updateBlockStatus(target, 'block'); } catch (error) { log(`Antiprivado no pudo bloquear ${target}: ${error.message}`, 'warning'); }
    try {
        if (typeof sock.chatModify === 'function') {
            await sock.chatModify({ delete: true, lastMessages: [{ key: msg.key, messageTimestamp: msg.messageTimestamp || Math.floor(Date.now() / 1000) }] }, from);
        }
    } catch (error) { log(`Antiprivado no pudo borrar el chat ${from}: ${error.message}`, 'warning'); }
    botData.antiPrivate.lastAction = { at: new Date().toISOString(), jid: String(target), dangerousCommand: dangerous };
    return true;
};
