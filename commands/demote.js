module.exports = async function(sock, chatId, msg, isAdmin) {
    if (!isAdmin) return await sock.sendMessage(chatId, { text: '╭━━〔 🔐 *ACCESO DENEGADO* 〕━━╮\n┃\n┃ Este comando solo puede usarlo\n┃ un administrador del grupo.\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━╯' }, { quoted: msg });
    
    try {
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (mentioned.length === 0) {
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
            if (quoted) {
                await sock.groupParticipantsUpdate(chatId, [quoted], 'demote');
                return await sock.sendMessage(chatId, { text: `╭━━〔 🔻 *ADMINISTRADOR DEGRADADO* 〕━━╮\n┃\n┃ 👤 Usuario: @${quoted.split('@')[0]}\n┃ ✅ Ya no tiene permisos de administrador.\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`, mentions: [quoted] }, { quoted: msg });
            }
            return await sock.sendMessage(chatId, { text: '╭━━〔 ⚠️ *FALTA EL USUARIO* 〕━━╮\n┃\n┃ Menciona a la persona o responde\n┃ a uno de sus mensajes.\n┃\n┃ Ejemplo: *.demote @usuario*\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━╯' }, { quoted: msg });
        }
        await sock.groupParticipantsUpdate(chatId, mentioned, 'demote');
        const names = mentioned.map(jid => `@${jid.split('@')[0]}`).join(', ');
        await sock.sendMessage(chatId, { text: `╭━━〔 🔻 *DEGRADACIÓN COMPLETADA* 〕━━╮\n┃\n┃ ✅ Se retiró la administración a\n┃ 👥 ${names}\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`, mentions: mentioned }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: `╭━━〔 ❌ *NO SE PUDO DEGRADAR* 〕━━╮\n┃\n┃ ${e.message}\n┃\n┃ Verifica que el bot sea administrador\n┃ y que el usuario siga en el grupo.\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯` }, { quoted: msg });
    }
};
