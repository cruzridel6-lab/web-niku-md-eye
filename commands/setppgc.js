const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

module.exports = async function(sock, chatId, msg, isAdmin, prefix = '.') {
    if (!isAdmin) return await sock.sendMessage(chatId, { text: '\u274C Only admin!' }, { quoted: msg });
    
    try {
        const quoted = msg.message?.imageMessage || msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
        if (!quoted) return await sock.sendMessage(chatId, { text: `🖼️ Envía una imagen, respóndela y escribe *${prefix}setppgc* para cambiar la foto del grupo.` }, { quoted: msg });
        
        const stream = await downloadContentFromMessage(quoted, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        
        await sock.updateProfilePicture(chatId, buffer);
        await sock.sendMessage(chatId, { text: '\u2705 Group profile picture updated!' }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '\u274C Error: ' + e.message }, { quoted: msg });
    }
};
