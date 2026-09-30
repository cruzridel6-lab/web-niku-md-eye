module.exports = async function alertas(sock, chatId, msg, isAdmin, botData, saveBotData, args = []) {
    const reply = text => sock.sendMessage(chatId, { text }, { quoted: msg });
    if (!chatId.endsWith('@g.us')) return reply('❌ Este comando solo funciona en grupos.');
    if (!isAdmin) return reply('❌ Solo los administradores pueden cambiar las alertas.');
    botData.groupAlerts ||= {};
    const action = String(args[0] || '').toLowerCase();
    if (['on', '1', 'activar', 'enable'].includes(action)) botData.groupAlerts[chatId] = true;
    else if (['off', '0', 'desactivar', 'disable'].includes(action)) delete botData.groupAlerts[chatId];
    else return reply(`🔔 Alertas del grupo: *${botData.groupAlerts[chatId] ? 'Activadas' : 'Desactivadas'}*\n\nUso: *.alertas on* u *.alertas off*`);
    saveBotData();
    return reply(`✅ Alertas ${botData.groupAlerts[chatId] ? 'activadas' : 'desactivadas'}.`);
};
