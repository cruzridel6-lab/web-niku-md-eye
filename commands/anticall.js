async function anticallCommand(sock, from, msg, isAdmin, botData, saveBotData, userId, args = []) {
    if (!isAdmin) return sock.sendMessage(from, { text: '🔐 Solo los administradores pueden configurar el bloqueo de llamadas.' }, { quoted: msg });
    botData.antiCall ||= {};
    const action = String(args[0] || '').toLowerCase();
    if (action === 'on' || action === 'activar') {
        botData.antiCall[userId] = true;
        saveBotData();
        return sock.sendMessage(from, { text: '╭━━〔 📵 *ANTICALL ACTIVADO* 〕━━╮\n┃\n┃ Las llamadas entrantes serán\n┃ rechazadas automáticamente.\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━╯' }, { quoted: msg });
    }
    if (action === 'off' || action === 'desactivar') {
        delete botData.antiCall[userId];
        saveBotData();
        return sock.sendMessage(from, { text: '📵 *ANTICALL DESACTIVADO*\n\nLas llamadas volverán a recibirse normalmente.' }, { quoted: msg });
    }
    const active = Boolean(botData.antiCall[userId]);
    return sock.sendMessage(from, { text: `📵 *ANTICALL:* ${active ? 'ACTIVADO ✅' : 'DESACTIVADO ❌'}\n\nUso:\n• *.anticall on*\n• *.anticall off*` }, { quoted: msg });
}

module.exports = anticallCommand;
module.exports.aliases = ['anti-call'];
