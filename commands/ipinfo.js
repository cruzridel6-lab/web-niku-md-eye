const axios = require('axios');

module.exports = async function(sock, chatId, msg, q) {
    try {
        if (!q) {
            return await sock.sendMessage(chatId, {
                text: '⚠️ Uso: .ipinfo 8.8.8.8\n\nEscribe una dirección IP para consultar.'
            }, { quoted: msg });
        }

        const ip = q.trim();
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

        if (!ipRegex.test(ip)) {
            return await sock.sendMessage(chatId, { text: '❌ ¡El formato de la IP no es válido!' }, { quoted: msg });
        }

        try {
            const response = await axios.get(`https://ipapi.co/${ip}/json/`, { timeout: 5000 });
            const data = response.data;

            const text = `🌐 *INFORMACIÓN DE IP DE NIKU MD* 🌐\n\n` +
                         `📍 *IP:* ${data.ip || ip}\n` +
                         `🏙️ *Ciudad:* ${data.city || 'N/A'}\n` +
                         `🏛️ *Región:* ${data.region || 'N/A'}\n` +
                         `🌍 *País:* ${data.country_name || 'N/A'} (${data.country || 'N/A'})\n` +
                         `📮 *Código postal:* ${data.postal || 'N/A'}\n` +
                         `🌐 *Proveedor:* ${data.org || 'N/A'}\n` +
                         `📡 *ASN:* ${data.asn || 'N/A'}\n` +
                         `⏰ *Zona horaria:* ${data.timezone || 'N/A'}\n\n` +
                         `_Desarrollado por NIKU MD_`;

            await sock.sendMessage(chatId, { text }, { quoted: msg });
        } catch (apiErr) {
            const text = `🌐 *INFORMACIÓN DE IP DE NIKU MD* 🌐\n\n` +
                         `📍 *IP:* ${ip}\n` +
                         `⚠️ *Estado:* Se alcanzó el límite de la API o la IP no existe\n` +
                         `🔄 Inténtalo más tarde o prueba con otra IP.\n\n` +
                         `_Desarrollado por NIKU MD_`;
            await sock.sendMessage(chatId, { text }, { quoted: msg });
        }
    } catch (err) {
        await sock.sendMessage(chatId, { text: '❌ Error: ' + err.message }, { quoted: msg });
    }
};
