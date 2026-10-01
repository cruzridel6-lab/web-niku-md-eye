const axios = require('axios');

// Store active tempmail sessions
const tempmailSessions = {};

// Mail.tm API base URL
const MAIL_API = 'https://api.mail.tm';

async function createAccount() {
    try {
        // Get available domains
        const domainsRes = await axios.get(`${MAIL_API}/domains`, { timeout: 10000 });
        const domain = domainsRes.data['hydra:member'][0].domain;

        // Generate random credentials
        const randomId = Math.random().toString(36).substring(2, 10);
        const email = `${randomId}@${domain}`;
        const password = Math.random().toString(36).substring(2, 15);

        // Create account
        await axios.post(`${MAIL_API}/accounts`, {
            address: email,
            password: password
        }, { timeout: 10000 });

        // Get token
        const tokenRes = await axios.post(`${MAIL_API}/token`, {
            address: email,
            password: password
        }, { timeout: 10000 });

        return {
            email: email,
            password: password,
            token: tokenRes.data.token
        };
    } catch (err) {
        throw new Error('No se pudo crear el correo temporal: ' + err.message);
    }
}

async function checkMessages(token) {
    try {
        const res = await axios.get(`${MAIL_API}/messages`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000
        });
        return res.data['hydra:member'] || [];
    } catch (err) {
        return [];
    }
}

async function getMessage(token, messageId) {
    try {
        const res = await axios.get(`${MAIL_API}/messages/${messageId}`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000
        });
        return res.data;
    } catch (err) {
        return null;
    }
}

module.exports = async function(sock, chatId, msg) {
    try {
        const userId = chatId;

        // If user already has an active tempmail, show it
        if (tempmailSessions[userId]) {
            const session = tempmailSessions[userId];

            // Check for new messages
            const messages = await checkMessages(session.token);
            const newMessages = messages.filter(m => !session.seenMessages.includes(m.id));

            if (newMessages.length > 0) {
                // Forward new messages/OTPs
                for (const message of newMessages) {
                    const fullMsg = await getMessage(session.token, message.id);
                    if (fullMsg) {
                        const otpMatch = fullMsg.text?.match(/\b\d{4,8}\b/) || fullMsg.intro?.match(/\b\d{4,8}\b/);
                        const otp = otpMatch ? otpMatch[0] : null;

                        const forwardText = `📧 *NUEVO CORREO RECIBIDO* 📧\n\n` +
                                          `📨 *De:* ${fullMsg.from?.address || 'Desconocido'}\n` +
                                          `📌 *Asunto:* ${fullMsg.subject || 'No Subject'}\n` +
                                          `🕐 *Fecha:* ${new Date(fullMsg.createdAt).toLocaleString()}\n\n` +
                                          (otp ? `🔐 *CÓDIGO OTP DETECTADO:* \`${otp}\`\n\n` : '') +
                                          `📝 *Vista previa:*\n${fullMsg.intro || fullMsg.text?.substring(0, 500) || 'Sin contenido'}\n\n` +
                                          `_Desarrollado por NIKU MD_`;

                        await sock.sendMessage(chatId, { text: forwardText });
                        session.seenMessages.push(message.id);
                    }
                }
            }

            // Show current email info
            const text = `📧 *CORREO TEMPORAL DE NIKU MD* 📧\n\n` +
                         `✅ Correo activo:\n` +
                         `\`${session.email}\`\n\n` +
                         `📨 Correos totales: ${messages.length}\n` +
                         `🔔 Correos nuevos: ${newMessages.length}\n\n` +
                         `⏳ Buscando códigos OTP cada 30 segundos...\n` +
                         `🔄 Escribe .tempmail otra vez para revisar nuevos correos\n\n` +
                         `_Desarrollado por NIKU MD_`;

            await sock.sendMessage(chatId, { text }, { quoted: msg });
            return;
        }

        // Create new tempmail
        await sock.sendMessage(chatId, { text: '⏳ Creando correo temporal... espera un momento.' }, { quoted: msg });

        const account = await createAccount();

        // Store session
        tempmailSessions[userId] = {
            email: account.email,
            token: account.token,
            createdAt: Date.now(),
            seenMessages: []
        };

        const text = `📧 *CORREO TEMPORAL DE NIKU MD CREATED* 📧\n\n` +
                     `✅ *Correo:*\n` +
                     `\`${account.email}\`\n\n` +
                     `⏳ Válido durante 10 minutos\n` +
                     `🔔 Los códigos y correos nuevos se mostrarán en este chat\n\n` +
                     `📝 Usa este correo para recibir códigos OTP\n` +
                     `🔄 Escribe .tempmail otra vez para revisar nuevos correos\n\n` +
                     `_Desarrollado por NIKU MD_`;

        await sock.sendMessage(chatId, { text }, { quoted: msg });

        // Start auto-checking for emails
        startEmailChecker(sock, chatId, userId);

    } catch (err) {
        await sock.sendMessage(chatId, { text: '❌ Error: ' + err.message + '\n\nInténtalo más tarde.' }, { quoted: msg });
    }
};

function startEmailChecker(sock, chatId, userId) {
    const interval = setInterval(async () => {
        const session = tempmailSessions[userId];
        if (!session) {
            clearInterval(interval);
            return;
        }

        // Check if session expired (10 minutes)
        if (Date.now() - session.createdAt > 10 * 60 * 1000) {
            delete tempmailSessions[userId];
            clearInterval(interval);
            try {
                await sock.sendMessage(chatId, { text: '⏰ La sesión de correo temporal expiró. Usa .tempmail para crear otra.' });
            } catch(e) {}
            return;
        }

        try {
            const messages = await checkMessages(session.token);
            const newMessages = messages.filter(m => !session.seenMessages.includes(m.id));

            for (const message of newMessages) {
                const fullMsg = await getMessage(session.token, message.id);
                if (fullMsg) {
                    const otpMatch = fullMsg.text?.match(/\b\d{4,8}\b/) || fullMsg.intro?.match(/\b\d{4,8}\b/);
                    const otp = otpMatch ? otpMatch[0] : null;

                    const forwardText = `📧 *NUEVO CORREO RECIBIDO* 📧\n\n` +
                                      `📨 *De:* ${fullMsg.from?.address || 'Desconocido'}\n` +
                                      `📌 *Asunto:* ${fullMsg.subject || 'No Subject'}\n` +
                                      `🕐 *Fecha:* ${new Date(fullMsg.createdAt).toLocaleString()}\n\n` +
                                      (otp ? `🔐 *CÓDIGO OTP DETECTADO:* \`${otp}\`\n\n` : '') +
                                      `📝 *Vista previa:*\n${fullMsg.intro || fullMsg.text?.substring(0, 500) || 'Sin contenido'}\n\n` +
                                      `_Desarrollado por NIKU MD_`;

                    await sock.sendMessage(chatId, { text: forwardText });
                    session.seenMessages.push(message.id);
                }
            }
        } catch (e) {}
    }, 15000); // Check every 15 seconds
}
