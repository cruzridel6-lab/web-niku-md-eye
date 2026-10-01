const axios = require('axios');

module.exports = async function(sock, chatId, msg, q) {
    if (!q) return await sock.sendMessage(chatId, { text: '\u26A0\uFE0F .wiki <búsqueda>' }, { quoted: msg });

    try {
        await sock.sendMessage(chatId, { text: '\u1F4D2 Buscando en Wikipedia...' }, { quoted: msg });

        const search = await axios.get(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&origin=*`, { timeout: 10000 });
        const results = search.data.query.search;

        if (!results.length) return await sock.sendMessage(chatId, { text: '\u274C ¡No se encontró ningún artículo en Wikipedia!' }, { quoted: msg });

        const page = results[0];
        const pageId = page.pageid;

        const detail = await axios.get(`https://en.wikipedia.org/w/api.php?action=query&pageids=${pageId}&prop=extracts&exintro=true&explaintext=true&format=json&origin=*`, { timeout: 10000 });
        const extract = detail.data.query.pages[pageId].extract;

        let text = `*\u1F4D2 ${page.title}*\n\n`;
        text += extract ? extract.substring(0, 2000) : 'No hay resumen disponible.';
        text += `\n\n\u1F517 https://en.wikipedia.org/?curid=${pageId}`;

        await sock.sendMessage(chatId, { text }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '\u274C Error: ' + e.message }, { quoted: msg });
    }
};
