module.exports = async function(sock, chatId, msg, q) {
    if (!q) return await sock.sendMessage(chatId, { text: '\u26A0\uFE0F .screenshot <url>' }, { quoted: msg });

    try {
        let url = q;
        if (!url.startsWith('http')) url = 'https://' + url;

        await sock.sendMessage(chatId, { text: '\u1F5A5\uFE0F Tomando captura de pantalla...' }, { quoted: msg });

        const ssUrl = `https://image.thum.io/get/width/1200/crop/800/noanimate/${encodeURIComponent(url)}`;

        await sock.sendMessage(chatId, {
            image: { url: ssUrl },
            caption: `*\u1F5A5\uFE0F Captura de:*\n${url}`
        }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '\u274C Error: ' + e.message }, { quoted: msg });
    }
};
