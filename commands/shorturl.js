const axios = require('axios');

module.exports = async function(sock, chatId, msg, q) {
    if (!q) return await sock.sendMessage(chatId, { text: '\u26A0\uFE0F .shorturl <url larga>' }, { quoted: msg });

    try {
        await sock.sendMessage(chatId, { text: '\u1F517 Acortando el enlace...' }, { quoted: msg });

        const response = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(q)}`, { timeout: 10000 });

        await sock.sendMessage(chatId, {
            text: `*\u1F517 Enlace acortado*\n\n` +
                `*Original:* ${q}\n` +
                `*Corto:* ${response.data}`
        }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '\u274C Error: ' + e.message }, { quoted: msg });
    }
};
