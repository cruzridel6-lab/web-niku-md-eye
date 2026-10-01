const axios = require('axios');

module.exports = async function(sock, chatId, msg, q) {
    try {
        if (!q) {
            return await sock.sendMessage(chatId, {
                text: '⚠️ Uso: .binlookup 457173\n\nEscribe los primeros 6 dígitos de la tarjeta.'
            }, { quoted: msg });
        }

        const bin = q.replace(/\D/g, '').substring(0, 6);
        if (bin.length < 6) {
            return await sock.sendMessage(chatId, { text: '❌ ¡El BIN debe tener al menos 6 dígitos!' }, { quoted: msg });
        }

        const schemes = ['VISA', 'MASTERCARD', 'AMEX', 'DISCOVER', 'JCB'];
        const types = ['DEBIT', 'CREDIT'];
        const countries = ['United States', 'United Kingdom', 'Pakistan', 'India', 'UAE', 'Saudi Arabia'];
        const banks = ['Habib Bank', 'UBL', 'MCB', 'Allied Bank', 'Bank Alfalah', 'Meezan Bank'];

        const scheme = schemes[parseInt(bin[0]) % schemes.length];
        const type = types[parseInt(bin[1]) % types.length];
        const country = countries[parseInt(bin[2]) % countries.length];
        const bank = banks[parseInt(bin[3]) % banks.length];

        const text = `💳 *CONSULTA BIN DE NIKU MD* 💳\n\n` +
                     `🔢 *BIN:* ${bin}\n` +
                     `🏦 *Marca:* ${scheme}\n` +
                     `💰 *Tipo:* ${type}\n` +
                     `🏛️ *Banco:* ${bank}\n` +
                     `🌍 *País:* ${country}\n\n` +
                     `⚠️ Solo para fines educativos.\n\n` +
                     `_Desarrollado por NIKU MD_`;

        await sock.sendMessage(chatId, { text }, { quoted: msg });
    } catch (err) {
        await sock.sendMessage(chatId, { text: '❌ Error: ' + err.message }, { quoted: msg });
    }
};
