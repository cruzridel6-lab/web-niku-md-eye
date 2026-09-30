const axios = require('axios');

const INTERACTIONS = {
    angry: ['angry', 'enojar'], bath: ['bath'], bite: ['bite', 'morder'], bleh: ['bleh'], blush: ['blush'],
    bored: ['bored', 'aburrido'], coffee: ['coffee', 'cafe'], cry: ['cry', 'llorar'], cuddle: ['cuddle'],
    dance: ['dance', 'bailar'], drunk: ['drunk'], eat: ['eat', 'comer'], handhold: ['handhold'],
    happy: ['happy', 'feliz'], highfive: ['highfive'], hug: ['hug', 'abrazo'], jump: ['jump'],
    kill: ['kill', 'matar'], kiss: ['kiss', 'muak'], kisscheek: ['kisscheek', 'beso'], laugh: ['laugh'],
    lick: ['lick'], love: ['love', 'amor'], nope: ['nope'], pat: ['pat'], pout: ['pout'],
    punch: ['punch', 'pegar'], push: ['push'], run: ['run', 'correr'], sad: ['sad', 'triste'],
    scared: ['scared'], seduce: ['seduce', 'seducir'], shy: ['shy', 'timido'], slap: ['slap'],
    sleep: ['sleep'], smile: ['smile', 'sonreir'], smoke: ['smoke', 'fumar'], spit: ['spit', 'escupir'],
    step: ['step', 'pisar'], think: ['think'], walk: ['walk'], wave: ['wave', 'hola'], wink: ['wink']
};

const LABELS = {
    angry: 'se enoja', bath: 'se da un baño', bite: 'muerde', bleh: 'hace bleh', blush: 'se sonroja',
    bored: 'se aburre', coffee: 'toma café', cry: 'llora', cuddle: 'se acurruca', dance: 'baila',
    drunk: 'se emborracha', eat: 'come', handhold: 'toma de la mano', happy: 'se pone feliz', highfive: 'choca los cinco',
    hug: 'abraza', jump: 'salta', kill: 'ataca', kiss: 'besa', kisscheek: 'da un beso en la mejilla',
    laugh: 'se ríe', lick: 'lame', love: 'demuestra su amor', nope: 'dice que no', pat: 'acaricia',
    pout: 'hace puchero', punch: 'golpea', push: 'empuja', run: 'corre', sad: 'se pone triste',
    scared: 'se asusta', seduce: 'seduce', shy: 'se avergüenza', slap: 'da una bofetada', sleep: 'se duerme',
    smile: 'sonríe', smoke: 'fuma', spit: 'escupe', step: 'pisa', think: 'piensa', walk: 'camina',
    wave: 'saluda', wink: 'guiña el ojo'
};

const ALIAS_TO_COMMAND = Object.fromEntries(Object.entries(INTERACTIONS).flatMap(([key, aliases]) => aliases.map(alias => [alias, key])));
const animeAliases = Object.values(INTERACTIONS).flat();
const animeMenu = `╭───〔 🎌 ANIME 〕───╮\n│\n│ 😡 .angry · Enojarse\n│ 🛁 .bath · Baño\n│ 😳 .blush · Sonrojarse\n│ ☕ .coffee · Café\n│ 😭 .cry · Llorar\n│ 💃 .dance · Bailar\n│ 🍜 .eat · Comer\n│ 😊 .happy · Felicidad\n│ 🙌 .highfive · Chocar los cinco\n│ 🤗 .hug · Abrazar\n│ 💋 .kiss · Besar\n│ ❤️ .love · Amor\n│ 👋 .wave · Saludar\n│ 👊 .punch · Golpear\n│ 🏃 .run · Correr\n│ 😢 .sad · Tristeza\n│ 😳 .shy · Vergüenza\n│ 😊 .smile · Sonreír\n│ 😴 .sleep · Dormir\n│ 😉 .wink · Guiñar\n│\n│ ✨ 43 reacciones disponibles\n│ Usa una reacción con @mención\n╰────────────────────╯`;

function senderOf(msg, chatId) { return msg?.key?.participant || (msg?.key?.fromMe ? msg?.key?.remoteJid : chatId); }
function numberOf(jid) { return String(jid || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, ''); }
function getTarget(msg, q) {
    const context = msg?.message?.extendedTextMessage?.contextInfo || {};
    const mentioned = context.mentionedJid?.[0] || context.participant || context.quotedMessage?.key?.participant || context.quotedMessage?.key?.sender;
    if (mentioned) return mentioned;
    const match = String(q || '').match(/@?(\d{7,16})/);
    return match ? `${match[1]}@s.whatsapp.net` : null;
}
function displayName(msg, jid, fallback) {
    if (jid && numberOf(jid) !== numberOf(senderOf(msg, jid))) return `@${numberOf(jid)}`;
    return msg?.pushName || fallback || 'Usuario';
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function fetchInteractionMedia(canonical) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const response = await axios.get(`https://api.stellarwa.xyz/sfw/interaction?inter=${canonical}&key=Midnight`, {
                responseType: 'arraybuffer', timeout: 20000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 15; Pixel 7)', Accept: 'video/mp4, image/gif, application/octet-stream' }
            });
            const media = Buffer.from(response.data);
            if (media.length >= 1000) return media;
            throw new Error('La API devolvió un archivo vacío');
        } catch (error) {
            lastError = error;
            if (attempt < 2) await wait(700 * (attempt + 1));
        }
    }
    try {
        const fallback = await axios.get(`https://nekos.best/api/v2/${canonical}`, { timeout: 10000, headers: { 'User-Agent': 'NIKU-MD/3.0' } });
        const url = fallback.data?.results?.[0]?.url;
        if (url) {
            const media = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000, headers: { 'User-Agent': 'NIKU-MD/3.0' } });
            const buffer = Buffer.from(media.data);
            if (buffer.length >= 1000) return buffer;
        }
    } catch (fallbackError) {
        lastError = fallbackError;
    }
    throw lastError || new Error('No se pudo obtener la reacción');
}
async function animeInfo(sock, chatId, msg, query) {
    if (!query) return sock.sendMessage(chatId, { text: `${animeMenu}\n\nTambién puedes buscar un anime con: *.anime <nombre>*` }, { quoted: msg });
    try {
        const response = await axios.get('https://api.jikan.moe/v4/anime', { params: { q: query, limit: 1, sfw: true }, timeout: 15000, headers: { Accept: 'application/json', 'User-Agent': 'NIKU-MD/3.0' } });
        const anime = response.data?.data?.[0];
        if (!anime) return sock.sendMessage(chatId, { text: `❌ No encontré resultados para: ${query}` }, { quoted: msg });
        const genres = Array.isArray(anime.genres) && anime.genres.length ? anime.genres.map(g => g.name).join(', ') : 'No disponible';
        const synopsis = String(anime.synopsis || 'Sin sinopsis disponible').replace(/\s+/g, ' ').slice(0, 500);
        const text = `🎨 *${anime.title || query}*\n\n⭐ Puntuación: ${anime.score ?? 'N/D'}/10\n📚 Episodios: ${anime.episodes ?? 'N/D'}\n📅 Estado: ${anime.status || 'N/D'}\n📜 Géneros: ${genres}\n📝 Sinopsis: ${synopsis}${synopsis.length >= 500 ? '…' : ''}\n\n🔗 ${anime.url || 'Enlace no disponible'}`;
        const imageUrl = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url;
        return imageUrl ? sock.sendMessage(chatId, { image: { url: imageUrl }, caption: text }, { quoted: msg }) : sock.sendMessage(chatId, { text }, { quoted: msg });
    } catch (error) {
        const status = error.response?.status;
        const text = status === 429 || status === 504 ? '⏳ Jikan está ocupado. Espera unos segundos e inténtalo otra vez.' : '❌ No pude consultar ese anime ahora. Intenta de nuevo.';
        console.error('Error en anime info:', status || error.message);
        return sock.sendMessage(chatId, { text }, { quoted: msg });
    }
}

async function animeCommand(sock, chatId, msg, command = 'anime', q = '') {
    const canonical = ALIAS_TO_COMMAND[String(command || '').toLowerCase()];
    if (!canonical) return animeInfo(sock, chatId, msg, q);
    const sender = senderOf(msg, chatId);
    const target = getTarget(msg, q);
    const senderName = msg?.pushName || `@${numberOf(sender)}`;
    const targetName = target ? `@${numberOf(target)}` : null;
    const caption = target && numberOf(target) !== numberOf(sender)
        ? `✨ *${senderName}* ${LABELS[canonical]} a *${targetName}* ${canonical === 'kill' || canonical === 'punch' || canonical === 'slap' ? '💥' : '♡'}`
        : `✨ *${senderName}* ${LABELS[canonical]} ${canonical === 'cry' || canonical === 'sad' ? '🥺' : '♡'}`;
    try {
        const media = await fetchInteractionMedia(canonical);
        const mentions = [sender]; if (target && numberOf(target) !== numberOf(sender)) mentions.push(target);
        return sock.sendMessage(chatId, { video: media, gifPlayback: true, caption, mentions }, { quoted: msg });
    } catch (error) {
        console.error(`Error en reacción anime ${canonical}:`, error.response?.status || error.message);
        return sock.sendMessage(chatId, { text: `❌ No pude cargar la reacción *${canonical}*. La API está temporalmente ocupada; inténtalo nuevamente.` }, { quoted: msg });
    }
}

module.exports = animeCommand;
module.exports.aliases = animeAliases;
module.exports.menu = animeMenu;
