function publicNumber(jid) {
    return String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
}

module.exports = async function reportCommand(sock, chatId, message, q = '', onReport) {
    const reportText = String(q || '').trim().replace(/\s+/g, ' ');
    if (!reportText) {
        return sock.sendMessage(chatId, {
            text: '⚠️ Escribe el mensaje del reporte.\n\nUso: *.reporte <mensaje>*'
        }, { quoted: message });
    }
    if (reportText.length > 2000) {
        return sock.sendMessage(chatId, {
            text: '⚠️ El reporte no puede superar los 2.000 caracteres.'
        }, { quoted: message });
    }

    const reporter = message?.key?.participant || message?.key?.remoteJid || chatId;
    await onReport?.({
        reporter,
        reporterNumber: publicNumber(reporter),
        chatId,
        message: reportText,
        createdAt: new Date().toISOString()
    });

    await sock.sendMessage(chatId, {
        text: '✅ Reporte recibido. El equipo administrativo revisará tu mensaje.'
    }, { quoted: message });
};
