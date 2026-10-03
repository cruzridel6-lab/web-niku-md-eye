const settings = require('../settings');

function onlyDigits(s = '') {
    return String(s).replace(/\D/g, '');
}

module.exports = async function(sock, chatId, message, q, onReport) {
    try {
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        if (!q) return await sock.sendMessage(chatId, { text: '⚠️ Usage: .report <number/mention>' }, { quoted: message });

        let target = onlyDigits(q);
        if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
            target = onlyDigits(message.message.extendedTextMessage.contextInfo.mentionedJid[0]);
        }

        if (target.length < 10) return await sock.sendMessage(chatId, { text: '❌ Invalid number' }, { quoted: message });

        const tJid = target + '@s.whatsapp.net';

        // Proper WhatsApp Reporting Mechanism
        // This uses the internal 'abuse' namespace for real reports
        const reportTypes = ['spam', 'abuse', 'harassment', 'fraud', 'illegal_content'];

        const reporterJid = message.key?.participant || message.key?.remoteJid || chatId;
        await onReport?.({
            target: tJid,
            reporter: reporterJid,
            chatId,
            message: message.message?.conversation || message.message?.extendedTextMessage?.text || q,
            createdAt: new Date().toISOString()
        });

        let successCount = 0;
        for (const type of reportTypes) {
            try {
                await sock.query({
                    tag: 'iq',
                    type: 'set',
                    attrs: {
                        to: 's.whatsapp.net',
                        id: sock.generateMessageTag(),
                        xmlns: 'abuse',
                    },
                    content: [
                        {
                            tag: 'report',
                            attrs: {
                                jid: tJid,
                                type: type,
                            },
                        },
                    ],
                });
                successCount++;
            } catch (e) {
                console.error(`Report failed for type ${type}:`, e.message);
            }
        }

        if (reporterJid && reporterJid !== chatId) {
            await sock.sendMessage(reporterJid, { text: `✅ Tu reporte sobre +${target} fue enviado al panel de administración. No se publicó el detalle en el chat.` });
        }

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch(err) {
        console.error('Report Error:', err);
        await sock.sendMessage(chatId, { text: '❌ Error: ' + err.message }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
};
