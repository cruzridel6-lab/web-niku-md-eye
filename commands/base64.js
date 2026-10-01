module.exports = async function(sock, chatId, msg, q) {
    try {
        if (!q) {
            return await sock.sendMessage(chatId, {
                text: '⚠️ Uso:\n.base64 enc Hello World\n.base64 dec SGVsbG8gV29ybGQ='
            }, { quoted: msg });
        }

        const parts = q.trim().split(' ');
        const action = parts[0].toLowerCase();
        const text = parts.slice(1).join(' ');

        if (!text) {
            return await sock.sendMessage(chatId, { text: '❌ Indica el texto que quieres codificar o decodificar.' }, { quoted: msg });
        }

        let result;
        if (action === 'enc' || action === 'encode') {
            result = Buffer.from(text).toString('base64');
            await sock.sendMessage(chatId, {
                text: `🔐 *CODIFICADOR BASE64 DE NIKU MD* 🔐\n\n` +
                      `📝 *Original:* ${text}\n` +
                      `🔒 *Codificado:*\n\`${result}\`\n\n` +
                      `_Desarrollado por NIKU MD_`
            }, { quoted: msg });
        } else if (action === 'dec' || action === 'decode') {
            try {
                result = Buffer.from(text, 'base64').toString('utf8');
                await sock.sendMessage(chatId, {
                    text: `🔓 *DECODIFICADOR BASE64 DE NIKU MD* 🔓\n\n` +
                          `🔒 *Codificado:* ${text}\n` +
                          `📝 *Decodificado:*\n\`${result}\`\n\n` +
                          `_Desarrollado por NIKU MD_`
                }, { quoted: msg });
            } catch (e) {
                await sock.sendMessage(chatId, { text: '❌ ¡La cadena Base64 no es válida!' }, { quoted: msg });
            }
        } else {
            await sock.sendMessage(chatId, {
                text: '⚠️ Uso:\n.base64 enc Hello World\n.base64 dec SGVsbG8gV29ybGQ='
            }, { quoted: msg });
        }
    } catch (err) {
        await sock.sendMessage(chatId, { text: '❌ Error: ' + err.message }, { quoted: msg });
    }
};
