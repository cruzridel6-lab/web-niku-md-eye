'use strict';

const { answerLocal } = require('../lib/localAI');
const cooldowns = new Map();
const COOLDOWN_MS = 1500;
const MAX_PROMPT = 1200;

function cleanupCooldowns() {
    const now = Date.now();
    for (const [jid, expiresAt] of cooldowns) if (expiresAt <= now) cooldowns.delete(jid);
}

async function aiCommand(sock, from, msg, isAdmin, session, args = []) {
    cleanupCooldowns();
    const prompt = args.join(' ').trim();
    if (!prompt || ['ayuda', 'help', 'menu'].includes(prompt.toLowerCase())) {
        return sock.sendMessage(from, {
            text: '🤖 *NIKU IA LOCAL*\n\nNo usa OpenAI ni ninguna API externa.\n\nPregúntame cosas como:\n• *.ai ¿cómo gano monedas?*\n• *.ai ¿qué necesito para la mazmorra?*\n• *.ai ¿qué clase me conviene?*\n• *.ai ¿cómo funciona un duelo?*\n\nPuedo darte consejos y explicar los comandos RPG disponibles.'
        }, { quoted: msg });
    }
    if (prompt.length > MAX_PROMPT) return sock.sendMessage(from, { text: `⚠️ La pregunta es demasiado larga. Usa un máximo de *${MAX_PROMPT} caracteres*.` }, { quoted: msg });
    const remaining = (cooldowns.get(from) || 0) - Date.now();
    if (remaining > 0) return sock.sendMessage(from, { text: `⏳ Espera *${Math.ceil(remaining / 1000)} segundo* antes de volver a consultar la IA local.` }, { quoted: msg });
    cooldowns.set(from, Date.now() + COOLDOWN_MS);
    const answer = answerLocal(prompt);
    return sock.sendMessage(from, { text: `🤖 *NIKU IA LOCAL*\n\n${answer}` }, { quoted: msg });
}

aiCommand.aliases = ['ia', 'inteligencia', 'pregunta'];
module.exports = aiCommand;
