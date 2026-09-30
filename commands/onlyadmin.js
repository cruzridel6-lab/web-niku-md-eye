module.exports = async function onlyAdminCommand(sock, chatId, msg, isAdmin, botData, saveBotData, args = []) {
    if (!chatId.endsWith('@g.us')) return sock.sendMessage(chatId, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: msg });
    if (!isAdmin) return sock.sendMessage(chatId, { text: '❌ Solo los administradores pueden cambiar este modo.' }, { quoted: msg });
    botData.adminOnlyGroups ||= {};
    const action = String(args[0] || '').toLowerCase();
    if (['on', '1', 'activar', 'enable'].includes(action)) {
        botData.adminOnlyGroups[chatId] = true;
        saveBotData();
        return sock.sendMessage(chatId, { text: '🔐 Modo *Solo Admin* activado. Solo los administradores podrán usar comandos.' }, { quoted: msg });
    }
    if (['off', '0', 'desactivar', 'disable'].includes(action)) {
        delete botData.adminOnlyGroups[chatId];
        saveBotData();
        return sock.sendMessage(chatId, { text: '🔓 Modo *Solo Admin* desactivado.' }, { quoted: msg });
    }
    const status = botData.adminOnlyGroups[chatId] ? 'Activado' : 'Desactivado';
    return sock.sendMessage(chatId, { text: `🔐 Modo Solo Admin: *${status}*\n\nUsa *.onlyadmin on* u *.onlyadmin off*.` }, { quoted: msg });
};
