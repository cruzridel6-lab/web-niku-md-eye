const axios = require('axios');

module.exports = async function logoCommand(sock, chatId, msg, q = '') {
    const name = String(q || '').trim();
    if (!name) {
        return sock.sendMessage(chatId, {
            text: '⚠️ Uso: .logo <nombre o concepto>\n\nEjemplo: .logo NIKU MD gaming'
        }, { quoted: msg });
    }

    try {
        await sock.sendMessage(chatId, { text: '🎨 Creando tu logo...' }, { quoted: msg });
        const prompt = `professional modern logo for ${name}, clean vector emblem, centered composition, transparent-style background, no watermark, high quality`;
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&enhance=true`;
        const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
        await sock.sendMessage(chatId, {
            image: response.data,
            mimetype: 'image/jpeg',
            caption: `🎨 *Logo generado*\n\nConcepto: ${name}\n\n_NIKU MD • Generador de logos_`
        }, { quoted: msg });
    } catch (error) {
        console.error('Error en logo:', error.message);
        await sock.sendMessage(chatId, {
            text: '❌ No pude generar el logo ahora. Intenta de nuevo en unos segundos.'
        }, { quoted: msg });
    }
};
