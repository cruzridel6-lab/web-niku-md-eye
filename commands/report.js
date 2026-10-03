const settings = require('../settings');

function normalizeJid(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (raw.includes('@')) return raw;
    const digits = raw.replace(/\D/g, '');
    return digits ? `${digits}@s.whatsapp.net` : null;
}

function maskPhoneNumber(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return 'No disponible';
    if (digits.length <= 4) return `${'*'.repeat(digits.length)}`;
    return `+${'*'.repeat(Math.max(4, digits.length - 4))}${digits.slice(-4)}`;
}

function formatReportTime(message) {
    const timestamp = Number(message?.messageTimestamp);
    const date = Number.isFinite(timestamp) && timestamp > 0
        ? new Date(timestamp * 1000)
        : new Date();
    const timeZone = process.env.REPORT_TIMEZONE || 'UTC';
    return new Intl.DateTimeFormat('es-ES', {
        dateStyle: 'short',
        timeStyle: 'medium',
        timeZone
    }).format(date) + ` (${timeZone})`;
}

async function resolveChannelJid(sock) {
    const configured = normalizeJid(process.env.REPORT_CHANNEL_JID);
    if (configured) return configured;

    const channelLink = settings.whatsappChannel;
    const channelKey = channelLink?.split('/channel/')[1]?.split(/[?#]/)[0];
    if (channelKey && typeof sock.newsletterMetadata === 'function') {
        const metadata = await sock.newsletterMetadata('invite', channelKey, 'GUEST');
        if (metadata?.id) return metadata.id;
    }

    return normalizeJid(settings.ownerNumber);
}

module.exports = async function reportCommand(sock, chatId, message, q) {
    const problem = String(q || '').trim();
    const reply = text => sock.sendMessage(chatId, { text }, { quoted: message });

    if (!problem) {
        return reply('⚠️ Describe el problema después del comando.\n\nEjemplo: *.reporte El bot no responde al comando .menu*');
    }

    const senderJid = message?.key?.participant || message?.participant || chatId;
    const senderNumber = String(senderJid).split('@')[0].split(':')[0];
    const userName = message?.pushName || 'Usuario sin nombre';
    const reportTime = formatReportTime(message);
    const reportText = [
        '📩 *Reporte entregado del usuario*',
        '',
        `👤 *Usuario:* ${userName}`,
        `📱 *Número censurado:* ${maskPhoneNumber(senderNumber)}`,
        `🕒 *Hora:* ${reportTime}`,
        '',
        '📝 *Problema descrito:*',
        problem
    ].join('\n');

    try {
        const destination = await resolveChannelJid(sock);
        if (!destination) throw new Error('No hay destino configurado para reportes');

        try {
            await sock.sendMessage(destination, { text: reportText });
        } catch (channelError) {
            const ownerJid = normalizeJid(settings.ownerNumber);
            if (!ownerJid || ownerJid === destination) throw channelError;
            console.warn(`No se pudo enviar el reporte al canal (${channelError.message}); se usará el propietario.`);
            await sock.sendMessage(ownerJid, { text: reportText });
        }

        await reply('✅ Tu reporte fue entregado correctamente. Gracias por avisarnos.');
    } catch (error) {
        console.error('Report delivery error:', error);
        await reply('❌ No se pudo entregar el reporte en este momento. Inténtalo de nuevo más tarde.');
    }
};
