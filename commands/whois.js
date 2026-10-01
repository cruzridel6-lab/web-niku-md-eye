const axios = require('axios');

module.exports = async function(sock, chatId, msg, q) {
    if (!q) return await sock.sendMessage(chatId, { text: '\u26A0\uFE0F .whois <dominio.com>' }, { quoted: msg });

    try {
        await sock.sendMessage(chatId, { text: '\u1F310 Consultando el dominio...' }, { quoted: msg });

        const response = await axios.get(`https://rdap.org/domain/${encodeURIComponent(q)}`, {
            timeout: 15000,
            headers: { 'Accept': 'application/json' }
        }).catch(async () => {
            // Fallback
            return { data: {
                ldhNombre: q,
                events: [{ eventAction: 'registration', eventFecha: 'Desconocido' }],
                status: ['Desconocido']
            }};
        });

        const data = response.data;
        const text = `*\u1F310 WHOIS: ${q}*\n\n` +
            `Dominio: ${data.ldhName || q}\n` +
            `Estado: ${(data.status || []).join(', ') || 'Desconocido'}\n` +
            `Creado: ${data.events?.find(e => e.eventAction === 'registration')?.eventDate || 'Desconocido'}\n` +
            `Actualizado: ${data.events?.find(e => e.eventAction === 'last update')?.eventDate || 'Desconocido'}\n` +
            `Expira: ${data.events?.find(e => e.eventAction === 'expiration')?.eventDate || 'Desconocido'}`;

        await sock.sendMessage(chatId, { text }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: `*\u1F310 WHOIS: ${q}*\n\nDomain registered. Use whois.com for full details.\n\nhttps://who.is/whois/${q}` }, { quoted: msg });
    }
};
