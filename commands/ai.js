'use strict';

const { answerLocal } = require('../lib/localAI');
const cooldowns = new Map();
const COOLDOWN_MS = 1500;
const MAX_PROMPT = 1200;
const MAX_MEMORY = 240;
const MAX_ITEMS = 20;

function cleanupCooldowns() {
    const now = Date.now();
    for (const [jid, expiresAt] of cooldowns) if (expiresAt <= now) cooldowns.delete(jid);
}

function senderOf(msg, chatId) {
    return String(msg?.key?.participantAlt || msg?.key?.senderPn || msg?.key?.participant || chatId);
}
function personalKey(msg, chatId) { return `user:${senderOf(msg, chatId)}`; }
function groupKey(chatId) { return `group:${chatId}`; }
function memoryStore(botData) {
    botData.localAIMemory ||= {};
    return botData.localAIMemory;
}
function cleanMemory(value) {
    return String(value || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_MEMORY);
}
function memoryList(store, key) {
    return Array.isArray(store[key]) ? store[key] : [];
}
function scopeFrom(args, isGroup, isAdmin) {
    if (String(args[0] || '').toLowerCase() === 'grupo' && isGroup && isAdmin) return { group: true, rest: args.slice(1) };
    return { group: false, rest: args };
}
function helpText() {
    return '🧠 *MEMORIA DE NIKU IA*\n\n' +
        '• *.aprender <dato>* — Guardar un recuerdo personal\n' +
        '• *.aprender grupo <dato>* — Guardar un dato del grupo (solo admin)\n' +
        '• *.memoria* — Ver tus recuerdos guardados\n' +
        '• *.olvidar <número>* — Borrar un recuerdo\n' +
        '• *.olvidar todo* — Borrar tus recuerdos personales\n\n' +
        'La IA solo guarda lo que le indiques explícitamente; no almacena conversaciones completas.';
}

async function aiCommand(sock, from, msg, isAdmin, session, args = [], botData = {}, saveBotData = () => {}, commandName = 'ai') {
    cleanupCooldowns();
    const command = String(commandName || 'ai').toLowerCase();
    const store = memoryStore(botData);
    const userKey = personalKey(msg, from);
    const isGroup = String(from).endsWith('@g.us');

    if (['aprender', 'recordar'].includes(command)) {
        const scope = scopeFrom(args, isGroup, isAdmin);
        const value = cleanMemory(scope.rest.join(' ').replace(/^que\s+/i, ''));
        if (!value) return sock.sendMessage(from, { text: helpText() }, { quoted: msg });
        const key = scope.group ? groupKey(from) : userKey;
        const list = memoryList(store, key);
        if (list.some(item => item.toLowerCase() === value.toLowerCase())) return sock.sendMessage(from, { text: '🧠 Ese dato ya está guardado en la memoria local.' }, { quoted: msg });
        list.push(value);
        store[key] = list.slice(-MAX_ITEMS);
        saveBotData();
        return sock.sendMessage(from, { text: `${scope.group ? '🏠' : '🧠'} Dato guardado correctamente.\n\n“${value}”\n\nLa IA lo podrá usar como contexto en futuras consultas.` }, { quoted: msg });
    }
    if (command === 'memoria') {
        const personal = memoryList(store, userKey);
        const group = isGroup && isAdmin ? memoryList(store, groupKey(from)) : [];
        const lines = [
            personal.length ? `👤 *PERSONAL*\n${personal.map((item, i) => `${i + 1}. ${item}`).join('\n')}` : '👤 *PERSONAL*\nSin recuerdos guardados.',
            ...(isGroup && isAdmin ? [group.length ? `🏠 *GRUPO*\n${group.map((item, i) => `${i + 1}. ${item}`).join('\n')}` : '🏠 *GRUPO*\nSin recuerdos guardados.'] : [])
        ];
        return sock.sendMessage(from, { text: `🧠 *MEMORIA LOCAL DE NIKU IA*\n\n${lines.join('\n\n')}\n\nPara borrar: *.olvidar <número>*` }, { quoted: msg });
    }
    if (['olvidar', 'forget'].includes(command)) {
        const scope = scopeFrom(args, isGroup, isAdmin);
        const key = scope.group ? groupKey(from) : userKey;
        const list = memoryList(store, key);
        if (!list.length) return sock.sendMessage(from, { text: '🧠 No hay recuerdos guardados en ese espacio.' }, { quoted: msg });
        const target = String(scope.rest[0] || '').toLowerCase();
        if (target === 'todo' || target === 'all') {
            delete store[key]; saveBotData();
            return sock.sendMessage(from, { text: '🧹 Memoria borrada correctamente.' }, { quoted: msg });
        }
        const index = Number(target) - 1;
        if (!Number.isInteger(index) || index < 0 || index >= list.length) return sock.sendMessage(from, { text: `⚠️ Indica un número entre *1 y ${list.length}*. Usa *.memoria* para ver la lista.` }, { quoted: msg });
        const [removed] = list.splice(index, 1);
        if (list.length) store[key] = list; else delete store[key];
        saveBotData();
        return sock.sendMessage(from, { text: `🧹 Olvidé este dato:\n\n“${removed}”` }, { quoted: msg });
    }
    const prompt = args.join(' ').trim();
    if (!prompt || ['ayuda', 'help', 'menu'].includes(prompt.toLowerCase())) return sock.sendMessage(from, { text: `${helpText()}\n\n🤖 También puedes preguntar:\n*.ai ¿cómo gano monedas?*` }, { quoted: msg });
    if (prompt.length > MAX_PROMPT) return sock.sendMessage(from, { text: `⚠️ La pregunta es demasiado larga. Usa un máximo de *${MAX_PROMPT} caracteres*.` }, { quoted: msg });
    const remaining = (cooldowns.get(from) || 0) - Date.now();
    if (remaining > 0) return sock.sendMessage(from, { text: `⏳ Espera *${Math.ceil(remaining / 1000)} segundo* antes de volver a consultar la IA local.` }, { quoted: msg });
    cooldowns.set(from, Date.now() + COOLDOWN_MS);
    const memories = [...memoryList(store, userKey), ...(isGroup ? memoryList(store, groupKey(from)) : [])];
    const answer = answerLocal(prompt, memories);
    return sock.sendMessage(from, { text: `🤖 *NIKU IA LOCAL*\n\n${answer}` }, { quoted: msg });
}

aiCommand.aliases = ['ia', 'inteligencia', 'pregunta', 'aprender', 'recordar', 'memoria', 'olvidar', 'forget'];
module.exports = aiCommand;
