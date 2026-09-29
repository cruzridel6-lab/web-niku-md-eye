const fetch = require('node-fetch');

async function handleTranslateCommand(sock, chatId, message, match = '') {
    try {
        await sock.presenceSubscribe?.(chatId);
        await sock.sendPresenceUpdate?.('composing', chatId);

        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        let textToTranslate = '';
        let lang = '';
        const raw = String(match || '').trim();

        if (quoted) {
            textToTranslate = quoted.conversation || quoted.extendedTextMessage?.text ||
                quoted.imageMessage?.caption || quoted.videoMessage?.caption || '';
            lang = raw.split(/\s+/)[0]?.toLowerCase() || '';
        } else {
            const args = raw.split(/\s+/).filter(Boolean);
            if (args.length < 2) {
                return sock.sendMessage(chatId, {
                    text: '🌐 *TRADUCTOR*\n\nUso:\n• Responde un mensaje con `.translate es`\n• Escribe `.translate hello es`\n\nEjemplo: `.translate buenos días en`'
                }, { quoted: message });
            }
            lang = args.pop().toLowerCase();
            textToTranslate = args.join(' ');
        }

        if (!textToTranslate) {
            return sock.sendMessage(chatId, { text: '❌ No encontré texto para traducir.' }, { quoted: message });
        }
        if (!/^[a-z]{2}(?:-[a-z]{2})?$/.test(lang)) {
            return sock.sendMessage(chatId, { text: '❌ Código de idioma no válido. Usa códigos como es, en, fr o ja.' }, { quoted: message });
        }

        let translatedText = null;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        try {
            const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(lang)}&dt=t&q=${encodeURIComponent(textToTranslate)}`, { signal: controller.signal });
            if (response.ok) {
                const data = await response.json();
                translatedText = data?.[0]?.map(part => part?.[0] || '').join('').trim() || null;
            }
        } catch (e) {}

        if (!translatedText) {
            try {
                const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(textToTranslate)}&langpair=en|${encodeURIComponent(lang)}`, { signal: controller.signal });
                const data = await response.json();
                translatedText = data?.responseData?.translatedText || null;
            } catch (e) {}
        }

        if (!translatedText) {
            try {
                const response = await fetch(`https://api.dreaded.site/api/translate?text=${encodeURIComponent(textToTranslate)}&lang=${encodeURIComponent(lang)}`, { signal: controller.signal });
                const data = await response.json();
                translatedText = data?.translated || null;
            } catch (e) {}
        }
        clearTimeout(timeout);

        if (!translatedText) throw new Error('No translation result');
        await sock.sendMessage(chatId, { text: `🌐 Traducción (${lang})\n\n${translatedText}` }, { quoted: message });
    } catch (error) {
        console.error('Error en translate:', error.message);
        await sock.sendMessage(chatId, {
            text: '❌ No pude traducir el texto. Intenta de nuevo en unos segundos.\n\nUso: responde un mensaje con `.translate es` o escribe `.translate hello es`'
        }, { quoted: message });
    }
}

module.exports = { handleTranslateCommand };
