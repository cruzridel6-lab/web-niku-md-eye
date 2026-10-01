module.exports = async function(sock, chatId, msg, q) {
    if (!q) return await sock.sendMessage(chatId, { text: '\u26A0\uFE0F .calc <expresión>' }, { quoted: msg });

    try {
        // Safe evaluation - only allow math operations
        const sanitized = q.replace(/[^0-9+\-*/().\s%^]/g, '');
        if (!sanitized) return await sock.sendMessage(chatId, { text: '\u274C ¡La expresión no es válida!' }, { quoted: msg });

        const result = Function('"use strict"; return (' + sanitized + ')')();

        await sock.sendMessage(chatId, {
            text: `*\u1F4CA Calculadora*\n\n` +
                `Expresión: ${sanitized}\n` +
                `Resultado: *${result}*`
        }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '\u274C Error matemático: ' + e.message }, { quoted: msg });
    }
};
