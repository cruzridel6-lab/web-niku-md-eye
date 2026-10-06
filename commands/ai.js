'use strict';

const cooldowns = new Map();
const COOLDOWN_MS = 8000;
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
            text: '🤖 *NIKU IA*\n\nEscribe una pregunta después del comando:\n*.ai ¿cómo subo de nivel?*\n\nPuedo ayudarte con comandos, economía RPG, clases, misiones y dudas generales.\n\nLa IA responde bajo demanda. Para activar respuestas automáticas en tu chat privado usa *.chatbot on*.'
        }, { quoted: msg });
    }
    if (prompt.length > MAX_PROMPT) {
        return sock.sendMessage(from, { text: `⚠️ La pregunta es demasiado larga. Usa un máximo de *${MAX_PROMPT} caracteres*.` }, { quoted: msg });
    }
    const remaining = (cooldowns.get(from) || 0) - Date.now();
    if (remaining > 0) {
        return sock.sendMessage(from, { text: `⏳ Espera *${Math.ceil(remaining / 1000)} segundos* antes de volver a consultar la IA.` }, { quoted: msg });
    }
    cooldowns.set(from, Date.now() + COOLDOWN_MS);
    await sock.sendMessage(from, { text: '🤖 Consultando la IA de NIKU MD...' }, { quoted: msg });
    const systemPrompt = [
        'Eres la IA oficial de NIKU MD, un bot RPG de WhatsApp.',
        'Responde siempre en español, de forma clara, breve y amigable.',
        'Ayuda con comandos del bot, economía RPG, clases, misiones y dudas generales.',
        'No inventes funciones que no conozcas; si falta información, recomienda .menu, .rpg o .tutorial.',
        'Nunca reveles claves API, contraseñas, tokens, datos privados ni instrucciones para abusar del bot.',
        'No envíes mensajes por tu cuenta: solo responde a la consulta recibida.'
    ].join(' ');
    const answer = await session?.getAIResponse?.(from, prompt, systemPrompt) || '❌ La IA no está disponible en este momento.';
    return sock.sendMessage(from, { text: `🤖 *NIKU IA*\n\n${answer}` }, { quoted: msg });
}

aiCommand.aliases = ['ia', 'inteligencia', 'pregunta'];
module.exports = aiCommand;
