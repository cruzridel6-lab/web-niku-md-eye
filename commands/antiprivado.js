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
    return /(^|\s)\.(?:bug|payload|crash|freeze|nuke|spam|locspam|vcardspam|buttonspam|pollspam|contactspam|lag|hack)\b/.test(normalized)
        || /\b(?:bug\s*payload|crash\s*payload|freeze\s*payload|payload\s*bug)\b/.test(normalized);
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
