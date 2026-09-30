module.exports = async function mutelist(sock, chatId, msg, isAdmin, botData) {
    const reply = text => sock.sendMessage(chatId, { text }, { quoted: msg });
    if (!chatId.endsWith('@g.us')) return reply('❌ Este comando solo funciona en grupos.');
    if (!isAdmin) return reply('❌ Solo los administradores pueden ver esta lista.');
    const users = botData.mutedUsers?.[chatId] || [];
    if (!users.length) return reply('🔇 No hay usuarios silenciados en este grupo.');
    return sock.sendMessage(chatId, { text: `🔇 *USUARIOS SILENCIADOS*\n\n${users.map(x => `• @${x.split('@')[0]}`).join('\n')}\n\nTotal: ${users.length}`, mentions: users }, { quoted: msg });
};
