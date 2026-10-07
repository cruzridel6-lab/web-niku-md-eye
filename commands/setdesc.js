module.exports = async function(sock, chatId, msg, isAdmin, q, prefix = '.') {
    if (!isAdmin) return await sock.sendMessage(chatId, { text: '\u274C Only admin!' }, { quoted: msg });
    if (!q) return await sock.sendMessage(chatId, { text: `✍️ Usa *${prefix}setdesc <descripción>* para cambiarla.` }, { quoted: msg });
    
    try {
        await sock.groupUpdateDescription(chatId, q);
        await sock.sendMessage(chatId, { text: '\u2705 Group description updated!' }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '\u274C Error: ' + e.message }, { quoted: msg });
    }
};
