'use strict';

async function strictModeCommand(sock, from, msg, isAdmin, botData, saveBotData, args = []) {
    if (!from.endsWith('@g.us')) return sock.sendMessage(from, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: msg });
    if (!isAdmin) return sock.sendMessage(from, { text: '❌ Solo los administradores pueden usar el modo estricto.' }, { quoted: msg });
    botData.strictGroups ||= {};
    botData.antilinkGroups ||= {};
    botData.antiSalesGroups ||= {};
    botData.antiStickerGroups ||= {};
    const action = String(args[0] || 'estado').toLowerCase();
    if (['on', 'activar', 'enable'].includes(action)) {
        if (!botData.strictGroups[from]) {
            botData.strictGroups[from] = {
                previous: {
                    antilink: botData.antilinkGroups[from] ?? null,
                    antiSales: Boolean(botData.antiSalesGroups[from]),
                    antiSticker: botData.antiStickerGroups[from] ? { ...botData.antiStickerGroups[from], users: undefined } : null
                },
                enabledAt: new Date().toISOString()
            };
        }
        botData.antilinkGroups[from] = 'kick';
        botData.antiSalesGroups[from] = true;
        botData.antiStickerGroups[from] ||= { enabled: false, users: {} };
        botData.antiStickerGroups[from].enabled = true;
        saveBotData();
        return sock.sendMessage(from, { text: '🛡️ *MODO ESTRICTO ACTIVADO*\n\n✅ Antienlace: borrar y expulsar\n✅ Antiventas: borrar y expulsar\n✅ Antispam de stickers: 5 permitidos, 3 advertencias = expulsión\n✅ Las advertencias del grupo quedan activas\n\nDesactivar: *.modoestricto off*' }, { quoted: msg });
    }
    if (['off', 'desactivar', 'disable'].includes(action)) {
        const previous = botData.strictGroups[from]?.previous;
        if (previous?.antilink) botData.antilinkGroups[from] = previous.antilink;
        else delete botData.antilinkGroups[from];
        if (previous?.antiSales) botData.antiSalesGroups[from] = true;
        else delete botData.antiSalesGroups[from];
        if (previous?.antiSticker) botData.antiStickerGroups[from] = previous.antiSticker;
        else delete botData.antiStickerGroups[from];
        delete botData.strictGroups[from];
        saveBotData();
        return sock.sendMessage(from, { text: '✅ *Modo estricto desactivado.*\nSe restauró la configuración anterior de antienlace, antiventas y antisticker.' }, { quoted: msg });
    }
    return sock.sendMessage(from, { text: `🛡️ *MODO ESTRICTO:* ${botData.strictGroups[from] ? 'ACTIVADO' : 'DESACTIVADO'}\n\nUso: *.modoestricto on* | *.modoestricto off*` }, { quoted: msg });
}

module.exports = strictModeCommand;
