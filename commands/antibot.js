'use strict';

function isGroup(from) { return String(from || '').endsWith('@g.us'); }

async function antibotCommand(sock, from, msg, isAdmin, botData, saveBotData, args = []) {
    if (!isGroup(from)) return sock.sendMessage(from, { text: '❌ Este comando solo funciona dentro de un grupo.' }, { quoted: msg });
    if (!isAdmin) return sock.sendMessage(from, { text: '🔐 Solo los administradores pueden configurar el antibot.' }, { quoted: msg });
    botData.antiBotGroups ||= {};
    const action = String(args[0] || '').toLowerCase();
    if (['on', 'activar', 'enable'].includes(action)) {
        botData.antiBotGroups[from] = true;
        saveBotData();
        return sock.sendMessage(from, { text: '╭━━〔 🤖 *ANTIBOT ACTIVADO* 〕━━╮\n┃\n┃ Se bloquearán bots identificables\n┃ que intenten participar en el grupo.\n┃\n┃ Administradores y este bot quedan\n┃ protegidos de la regla.\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━╯' }, { quoted: msg });
    }
    if (['off', 'desactivar', 'disable'].includes(action)) {
        delete botData.antiBotGroups[from];
        saveBotData();
        return sock.sendMessage(from, { text: '╭━━〔 🤖 *ANTIBOT DESACTIVADO* 〕━━╮\n┃\n┃ La protección antibot quedó apagada.\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━╯' }, { quoted: msg });
    }
    const active = Boolean(botData.antiBotGroups[from]);
    return sock.sendMessage(from, { text: `🤖 *ANTIBOT:* ${active ? 'ACTIVADO ✅' : 'DESACTIVADO ❌'}\n\nUso:\n• *.antibot on*\n• *.antibot off*` }, { quoted: msg });
}

function isBotSender(msg, sender, botData = {}) {
    if (msg?.key?.isBot === true || msg?.message?.extendedTextMessage?.contextInfo?.isBot === true) return true;
    const number = String(sender || '').split('@')[0].split(':')[0].replace(/\D/g, '');
    if (!number) return false;
    const known = [
        ...(Array.isArray(botData.registeredBots) ? botData.registeredBots : []),
        ...Object.keys(botData.subbots || {})
    ];
    return known.some(item => String(item).split('@')[0].split(':')[0].replace(/\D/g, '') === number);
}

module.exports = antibotCommand;
module.exports.isBotSender = isBotSender;
