const dns = require('dns').promises;

module.exports = async function(sock, chatId, msg, q) {
    if (!q) return await sock.sendMessage(chatId, { text: '\u26A0\uFE0F .dnslookup <dominio.com>' }, { quoted: msg });

    try {
        await sock.sendMessage(chatId, { text: '\u1F4E1 Consultando DNS...' }, { quoted: msg });

        const [aRecords, aaaaRecords, mxRecords, txtRecords, nsRecords] = await Promise.allSettled([
            dns.resolve4(q),
            dns.resolve6(q).catch(() => []),
            dns.resolveMx(q),
            dns.resolveTxt(q),
            dns.resolveNs(q)
        ]);

        let text = `*\u1F4E1 Consulta DNS: ${q}*\n\n`;

        text += `*\u1F310 Registros A:*\n${aRecords.status === 'fulfilled' ? aRecords.value.join('\n') : 'Ninguno'}\n\n`;
        text += `*\u1F310 AAARegistros A:*\n${aaaaRecords.status === 'fulfilled' && aaaaRecords.value.length ? aaaaRecords.value.join('\n') : 'Ninguno'}\n\n`;
        text += `*\u2709\uFE0F Registros MX:*\n${mxRecords.status === 'fulfilled' ? mxRecords.value.map(r => `${r.exchange} (prioridad: ${r.priority})`).join('\n') : 'Ninguno'}\n\n`;
        text += `*\u1F4CB Registros TXT:*\n${txtRecords.status === 'fulfilled' ? txtRecords.value.map(r => r.join('')).join('\n') : 'Ninguno'}\n\n`;
        text += `*\u1F310 Registros NS:*\n${nsRecords.status === 'fulfilled' ? nsRecords.value.join('\n') : 'Ninguno'}`;

        await sock.sendMessage(chatId, { text }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '\u274C Error de DNS: ' + e.message }, { quoted: msg });
    }
};
