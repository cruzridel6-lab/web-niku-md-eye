const axios = require('axios');

module.exports = async function(sock, chatId, msg, q) {
    if (!q) return await sock.sendMessage(chatId, { text: '\u26A0\uFE0F .github <usuario>' }, { quoted: msg });

    try {
        await sock.sendMessage(chatId, { text: '\u1F431 Consultando el perfil de GitHub...' }, { quoted: msg });

        const response = await axios.get(`https://api.github.com/users/${encodeURIComponent(q)}`, { timeout: 10000 });
        const user = response.data;

        const text = `*\u1F431 GitHub: ${user.login}*\n\n` +
            `${user.bio ? '*Biografía:* ' + user.bio + '\n' : ''}` +
            `\u1F464 Nombre: ${user.name || 'N/A'}\n` +
            `\u1F4CD Ubicación: ${user.location || 'N/A'}\n` +
            `\u1F3E2 Empresa: ${user.company || 'N/A'}\n` +
            `\u1F4DD Repositorios públicos: ${user.public_repos}\n` +
            `\u1F465 Seguidores: ${user.followers} | Siguiendo: ${user.following}\n` +
            `\u1F4C5 Se unió: ${new Date(user.created_at).toLocaleDateString()}\n` +
            `\u1F517 ${user.html_url}`;

        if (user.avatar_url) {
            await sock.sendMessage(chatId, { image: { url: user.avatar_url }, caption: text }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, { text }, { quoted: msg });
        }
    } catch (e) {
        await sock.sendMessage(chatId, { text: '\u274C Usuario no encontrado o error: ' + e.message }, { quoted: msg });
    }
};
