async function mentionJid(sock, chatId, jid) {
    if (!String(jid).endsWith('@lid')) return jid;
    try {
        const metadata = await sock.groupMetadata(chatId);
        const participant = metadata.participants.find(item => item.id === jid || item.lid === jid || item.jid === jid);
        return participant?.id || participant?.jid || jid;
    } catch { return jid; }
}

module.exports = async function(sock, chatId, msg, isAdmin) {
    if (!isAdmin) return await sock.sendMessage(chatId, { text: '╭━━〔 🔐 *ACCESO DENEGADO* 〕━━╮\n┃\n┃ Este comando solo puede usarlo\n┃ un administrador del grupo.\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━╯' }, { quoted: msg });
    
    try {
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (mentioned.length === 0) {
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
            if (quoted) {
                await sock.groupParticipantsUpdate(chatId, [quoted], 'promote');
                const mention = await mentionJid(sock, chatId, quoted);
                return await sock.sendMessage(chatId, { text: `╭━━〔 🛡️ *ADMINISTRADOR PROMOVIDO* 〕━━╮\n┃\n┃ 👤 Usuario: @${mention.split('@')[0]}\n┃ ✅ Ahora tiene permisos de administrador.\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`, mentions: [mention] }, { quoted: msg });
            }
            return await sock.sendMessage(chatId, { text: '╭━━〔 ⚠️ *FALTA EL USUARIO* 〕━━╮\n┃\n┃ Menciona a la persona o responde\n┃ a uno de sus mensajes.\n┃\n┃ Ejemplo: *.promote @usuario*\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━╯' }, { quoted: msg });
        }
        await sock.groupParticipantsUpdate(chatId, mentioned, 'promote');
        const mentions = await Promise.all(mentioned.map(jid => mentionJid(sock, chatId, jid)));
        const names = mentions.map(jid => `@${jid.split('@')[0]}`).join(', ');
        await sock.sendMessage(chatId, { text: `╭━━〔 🛡️ *PROMOCIÓN COMPLETADA* 〕━━╮\n┃\n┃ ✅ Se promovió correctamente a\n┃ 👥 ${names}\n┃\n┃ Ahora ${mentions.length === 1 ? 'este usuario tiene' : 'estos usuarios tienen'} permisos de administrador.\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`, mentions }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: `╭━━〔 ❌ *NO SE PUDO PROMOVER* 〕━━╮\n┃\n┃ ${e.message}\n┃\n┃ Verifica que el bot sea administrador\n┃ y que el usuario siga en el grupo.\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯` }, { quoted: msg });
    }
};
