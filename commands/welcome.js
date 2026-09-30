module.exports = async function welcome(sock, chatId, msg, isAdmin, botData, saveBotData, args = []) {
    const reply = text => sock.sendMessage(chatId, { text }, { quoted: msg });
    if (!chatId.endsWith('@g.us')) return reply('❌ Este comando solo funciona en grupos.');
    if (!isAdmin) return reply('❌ Solo los administradores pueden cambiar la bienvenida.');
    botData.groupWelcome ||= {};
    const action = String(args[0] || '').toLowerCase();
    if (['on', '1', 'activar', 'enable'].includes(action)) botData.groupWelcome[chatId] = true;
    else if (['off', '0', 'desactivar', 'disable'].includes(action)) delete botData.groupWelcome[chatId];
    else return reply(`👋 Bienvenida: *${botData.groupWelcome[chatId] ? 'Activada' : 'Desactivada'}*\n\nUso: *.welcome on* u *.welcome off*`);
    saveBotData();
    return reply(`✅ Bienvenida ${botData.groupWelcome[chatId] ? 'activada' : 'desactivada'}.`);
};
