module.exports = async function setwelcome(sock, chatId, msg, isAdmin, botData, saveBotData, args = [], prefix = '.') {
    const reply = text => sock.sendMessage(chatId, { text }, { quoted: msg });
    if (!chatId.endsWith('@g.us')) return reply('❌ Este comando solo funciona en grupos.');
    if (!isAdmin) return reply('❌ Solo los administradores pueden cambiar el texto.');
    const text = args.join(' ').trim();
    if (!text) return reply(`✍️ Uso: *${prefix}setwelcome Hola @user, bienvenido a @grupo*\nVariables: @user, @grupo, @desc`);
    botData.groupWelcomeText ||= {};
    botData.groupWelcomeText[chatId] = text;
    saveBotData();
    return reply('✅ Texto de bienvenida actualizado.');
};
