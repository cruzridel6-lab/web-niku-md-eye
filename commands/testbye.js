module.exports = async function testbye(sock, chatId, msg, isAdmin, botData) {
    if (!chatId.endsWith('@g.us')) return sock.sendMessage(chatId, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: msg });
    if (!isAdmin) return sock.sendMessage(chatId, { text: '❌ Solo los administradores pueden probarla.' }, { quoted: msg });
    const meta = await sock.groupMetadata(chatId).catch(() => ({ subject: 'este grupo', desc: '' }));
    const template = botData.groupByeText?.[chatId] || '👋 @user ha salido de @grupo.';
    const text = template.replace(/@user/g, `@${(msg.key.participant || msg.key.remoteJid).split('@')[0]}`).replace(/@grupo/g, meta.subject || 'este grupo').replace(/@desc/g, meta.desc || '');
    return sock.sendMessage(chatId, { text, mentions: [msg.key.participant || msg.key.remoteJid] }, { quoted: msg });
};
