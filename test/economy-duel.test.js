const test = require('node:test');
const assert = require('node:assert/strict');

const runEconomy = require('../commands/economy');

const CHAT = 'grupo-pruebas@g.us';
const CHALLENGER = '15550000001@s.whatsapp.net';
const TARGET_PHONE = '15550000002@s.whatsapp.net';
const TARGET_LID = '275550000002@lid';

function message(sender, { mentioned = [], participantAlt } = {}) {
    return {
        key: {
            remoteJid: CHAT,
            participant: sender,
            ...(participantAlt ? { participantAlt } : {})
        },
        message: {
            extendedTextMessage: {
                contextInfo: { mentionedJid: mentioned }
            }
        }
    };
}

function state(users, phoneAliases = {}) {
    return {
        economy: { [CHAT]: { users } },
        pvpDuels: {},
        pvpDuelHistory: {},
        phoneAliases,
        profiles: {}
    };
}

function socket() {
    const sent = [];
    return {
        sent,
        sendMessage: async (chatId, content) => {
            sent.push({ chatId, content });
            return { key: { id: `reply-${sent.length}` } };
        }
    };
}

function responseText(reply) {
    return reply.content.caption || reply.content.text || '';
}

test('permite retar una mención LID sin billetera previa', async () => {
    const botData = state({ [CHALLENGER]: { coins: 3000, bank: 0, lastSeen: 0 } });
    const sock = socket();

    await runEconomy(sock, CHAT, message(CHALLENGER, { mentioned: [TARGET_LID] }), 'duelo', '@Walter 1000', botData, () => {}, '.');

    const pending = Object.values(botData.pvpDuels[CHAT]);
    assert.equal(pending.length, 1);
    assert.equal(pending[0].challenger, CHALLENGER);
    assert.equal(pending[0].target, TARGET_LID);
    assert.match(responseText(sock.sent.at(-1)), /DESAFÍO PvP ENVIADO/);
    assert.deepEqual(sock.sent.at(-1).content.mentions, [CHALLENGER, TARGET_LID]);
});

test('el jugador LID sin billetera queda asociado al reto al intentar aceptar', async () => {
    const botData = state({ [CHALLENGER]: { coins: 3000, bank: 0, lastSeen: 0 } });
    const sock = socket();
    await runEconomy(sock, CHAT, message(CHALLENGER, { mentioned: [TARGET_LID] }), 'duelo', '@Walter 1000', botData, () => {}, '.');

    await runEconomy(sock, CHAT, message(TARGET_LID), 'duelo', 'aceptar', botData, () => {}, '.');

    assert.ok(botData.economy[CHAT].users[TARGET_LID]);
    assert.match(responseText(sock.sent.at(-1)), /Necesitas \*\d+ monedas de oro 🪙\* para aceptar el duelo/);
    assert.doesNotMatch(responseText(sock.sent.at(-1)), /No tienes duelos pendientes/);
});

test('reutiliza la billetera de teléfono al retar y aceptar con un LID vinculado', async () => {
    const botData = state({
        [CHALLENGER]: { coins: 3000, bank: 0, lastSeen: 0 },
        [TARGET_PHONE]: { coins: 1000, bank: 0, lastSeen: 0 }
    }, { '15550000002': TARGET_LID });
    const sock = socket();
    await runEconomy(sock, CHAT, message(CHALLENGER, { mentioned: [TARGET_LID] }), 'duelo', '@Walter 1000', botData, () => {}, '.');

    const pending = Object.values(botData.pvpDuels[CHAT]);
    assert.equal(pending[0].target, TARGET_PHONE);

    await runEconomy(sock, CHAT, message(TARGET_LID, { participantAlt: TARGET_PHONE }), 'duelo', 'aceptar', botData, () => {}, '.');

    assert.equal(Object.keys(botData.pvpDuels[CHAT]).length, 0);
    assert.equal(botData.pvpDuelHistory[CHAT].length, 1);
    assert.match(responseText(sock.sent.at(-1)), /DUELO PvP RESUELTO/);
});
