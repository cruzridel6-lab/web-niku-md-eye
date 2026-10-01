const axios = require('axios');

module.exports = async function(sock, chatId, msg, q) {
    if (!q) return await sock.sendMessage(chatId, { text: '\u26A0\uFE0F .npm <paquete>' }, { quoted: msg });

    try {
        await sock.sendMessage(chatId, { text: '\u1F4E6 Buscando en npm...' }, { quoted: msg });

        const response = await axios.get(`https://registry.npmjs.org/${encodeURIComponent(q)}`, { timeout: 10000 });
        const pkg = response.data;
        const latest = pkg['dist-tags'].latest;
        const info = pkg.versions[latest];

        const text = `*\u1F4E6 npm: ${pkg.name}*\n\n` +
            `Versión: ${latest}\n` +
            `Descripción: ${pkg.description || 'N/A'}\n` +
            `Autor: ${pkg.author?.name || 'N/A'}\n` +
            `Licencia: ${pkg.license || 'N/A'}\n` +
            `Última modificación: ${new Date(pkg.time.modified).toLocaleDateString()}\n` +
            `Descargas: https://www.npmjs.com/package/${pkg.name}\n\n` +
            `*Instalación:*\n\`npm install ${pkg.name}\``;

        await sock.sendMessage(chatId, { text }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '\u274C Paquete no encontrado: ' + e.message }, { quoted: msg });
    }
};
