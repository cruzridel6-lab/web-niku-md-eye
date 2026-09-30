module.exports = async function bye(sock, chatId, msg, isAdmin, botData, saveBotData, args = []) {
    const reply = text => sock.sendMessage(chatId, { text }, { quoted: msg });
    if (!chatId.endsWith('@g.us')) return reply('❌ Este comando solo funciona en grupos.');
    if (!isAdmin) return reply('❌ Solo los administradores pueden cambiar la despedida.');
    botData.groupBye ||= {};
    const action = String(args[0] || '').toLowerCase();
    if (['on', '1', 'activar', 'enable'].includes(action)) botData.groupBye[chatId] = true;
    else if (['off', '0', 'desactivar', 'disable'].includes(action)) delete botData.groupBye[chatId];
    else return reply(`👋 Despedida: *${botData.groupBye[chatId] ? 'Activada' : 'Desactivada'}*\n\nUso: *.bye on* u *.bye off*`);
    saveBotData();
    return reply(`✅ Despedida ${botData.groupBye[chatId] ? 'activada' : 'desactivada'}.`);
};
