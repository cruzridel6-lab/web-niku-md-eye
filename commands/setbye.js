module.exports = async function setbye(sock, chatId, msg, isAdmin, botData, saveBotData, args = []) {
    const reply = text => sock.sendMessage(chatId, { text }, { quoted: msg });
    if (!chatId.endsWith('@g.us')) return reply('❌ Este comando solo funciona en grupos.');
    if (!isAdmin) return reply('❌ Solo los administradores pueden cambiar el texto.');
    const text = args.join(' ').trim();
    if (!text) return reply('✍️ Uso: *.setbye Adiós @user, te esperamos en @grupo*\nVariables: @user, @grupo, @desc');
    botData.groupByeText ||= {};
    botData.groupByeText[chatId] = text;
    saveBotData();
    return reply('✅ Texto de despedida actualizado.');
};
