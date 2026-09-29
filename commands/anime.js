const axios = require('axios');

module.exports = async function animeCommand(sock, chatId, msg, q = '') {
    const query = String(q || '').trim();
    if (!query) {
        return sock.sendMessage(chatId, { text: '⚠️ Uso: .anime <nombre del anime>' }, { quoted: msg });
    }

    try {
        await sock.sendMessage(chatId, { text: '🔎 Buscando anime...' }, { quoted: msg });
        const response = await axios.get('https://api.jikan.moe/v4/anime', {
            params: { q: query, limit: 1, sfw: true },
            timeout: 15000,
            headers: { Accept: 'application/json', 'User-Agent': 'NIKU-MD/3.0' }
        });
        const anime = response.data?.data?.[0];
        if (!anime) {
            return sock.sendMessage(chatId, { text: `❌ No encontré resultados para: ${query}` }, { quoted: msg });
        }

        const genres = Array.isArray(anime.genres) && anime.genres.length
            ? anime.genres.map(g => g.name).join(', ')
            : 'No disponible';
        const synopsis = String(anime.synopsis || 'Sin sinopsis disponible').replace(/\s+/g, ' ').slice(0, 500);
        const text = `🎨 *${anime.title || query}*\n\n` +
            `⭐ Puntuación: ${anime.score ?? 'N/D'}/10\n` +
            `📚 Episodios: ${anime.episodes ?? 'N/D'}\n` +
            `📅 Estado: ${anime.status || 'N/D'}\n` +
            `📜 Géneros: ${genres}\n` +
            `📝 Sinopsis: ${synopsis}${synopsis.length >= 500 ? '…' : ''}\n\n` +
            `🔗 ${anime.url || 'Enlace no disponible'}`;

        const imageUrl = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url;
        if (imageUrl) {
            await sock.sendMessage(chatId, { image: { url: imageUrl }, caption: text }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, { text }, { quoted: msg });
        }
    } catch (error) {
        const status = error.response?.status;
        const message = status === 429 || status === 504
            ? '⏳ Jikan está temporalmente ocupado. Espera unos segundos e inténtalo otra vez.'
            : '❌ No pude consultar anime ahora. Revisa tu conexión o prueba otra vez.';
        console.error('Error en anime:', status || error.message);
        await sock.sendMessage(chatId, { text: message }, { quoted: msg });
    }
};
