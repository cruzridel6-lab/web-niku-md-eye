function targetFromMessage(msg, q = '') {
    const context = msg.message?.extendedTextMessage?.contextInfo;
    return context?.mentionedJid?.[0] || context?.participant || msg.mentionedJid?.[0] || msg.quoted?.sender || (String(q).match(/\d{5,}/)?.[0] ? `${String(q).match(/\d{5,}/)[0]}@s.whatsapp.net` : null);
}

module.exports = async function mute(sock, chatId, msg, isAdmin, q = '', botData, saveBotData) {
    const reply = text => sock.sendMessage(chatId, { text }, { quoted: msg });
    if (!chatId.endsWith('@g.us')) return reply('❌ Este comando solo funciona en grupos.');
    if (!isAdmin) return reply('❌ Solo los administradores pueden usar mute.');
    const target = targetFromMessage(msg, q);
    if (target && target !== chatId) {
        botData.mutedUsers ||= {};
        botData.mutedUsers[chatId] ||= [];
        if (!botData.mutedUsers[chatId].includes(target)) botData.mutedUsers[chatId].push(target);
        saveBotData();
        return sock.sendMessage(chatId, { text: `🔇 @${target.split('@')[0]} ha sido silenciado. Sus mensajes serán eliminados.`, mentions: [target] }, { quoted: msg });
    }
    try {
        await sock.groupSettingUpdate(chatId, 'announcement');
        return reply('🔒 Grupo cerrado para participantes. Solo los administradores pueden escribir.');
    } catch (e) {
        return reply('❌ No pude silenciar el grupo. Verifica que el bot sea administrador.');
    }
};
