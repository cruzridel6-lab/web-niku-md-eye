module.exports = async function antiPornCommand(sock, chatId, msg, isAdmin, botData, saveBotData, args = []) {
    if (!chatId.endsWith('@g.us')) return sock.sendMessage(chatId, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: msg });
    if (!isAdmin) return sock.sendMessage(chatId, { text: '❌ Solo los administradores pueden configurar Antiporno.' }, { quoted: msg });

    botData.antiPornGroups ||= {};
    const action = String(args[0] || '').toLowerCase();
    if (['on', '1', 'activar', 'enable'].includes(action)) {
        botData.antiPornGroups[chatId] = true;
        saveBotData();
        return sock.sendMessage(chatId, { text: '✅ Antiporno activado. Se eliminarán contenidos sexuales y se expulsará al remitente cuando sea posible.' }, { quoted: msg });
    }
    if (['off', '0', 'desactivar', 'disable'].includes(action)) {
        delete botData.antiPornGroups[chatId];
        saveBotData();
        return sock.sendMessage(chatId, { text: '❌ Antiporno desactivado.' }, { quoted: msg });
    }
    const status = botData.antiPornGroups[chatId] ? 'Activado' : 'Desactivado';
    return sock.sendMessage(chatId, { text: `🛡️ Antiporno: *${status}*\n\nUsa *.antiporno on* u *.antiporno off*.` }, { quoted: msg });
};
