function targetFromMessage(msg, q = '') {
    const context = msg.message?.extendedTextMessage?.contextInfo;
    return context?.mentionedJid?.[0] || context?.participant || msg.mentionedJid?.[0] || msg.quoted?.sender || (String(q).match(/\d{5,}/)?.[0] ? `${String(q).match(/\d{5,}/)[0]}@s.whatsapp.net` : null);
}

module.exports = async function unmute(sock, chatId, msg, isAdmin, q = '', botData, saveBotData) {
    const reply = text => sock.sendMessage(chatId, { text }, { quoted: msg });
    if (!chatId.endsWith('@g.us')) return reply('❌ Este comando solo funciona en grupos.');
    if (!isAdmin) return reply('❌ Solo los administradores pueden usar unmute.');
    const target = targetFromMessage(msg, q);
    if (target && target !== chatId) {
        const users = botData.mutedUsers?.[chatId] || [];
        botData.mutedUsers ||= {};
        botData.mutedUsers[chatId] = users.filter(jid => jid !== target);
        saveBotData();
        return sock.sendMessage(chatId, { text: `🔊 @${target.split('@')[0]} ya puede escribir nuevamente.`, mentions: [target] }, { quoted: msg });
    }
    try {
        await sock.groupSettingUpdate(chatId, 'not_announcement');
        return reply('🔓 Grupo abierto. Todos pueden enviar mensajes.');
    } catch (e) {
        return reply('❌ No pude abrir el grupo. Verifica que el bot sea administrador.');
    }
};
