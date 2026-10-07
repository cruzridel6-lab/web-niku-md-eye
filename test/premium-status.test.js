const test = require('node:test');
const assert = require('node:assert/strict');
const runEconomy = require('../commands/economy');

function mockSocket() {
    const sent = [];
    return {
        sent,
        sock: { async sendMessage(...args) { sent.push(args); return { ok: true }; } }
    };
}
async function runStatus({ jid = '111111111@s.whatsapp.net', q = '', botData = {}, contextInfo } = {}) {
    const { sock, sent } = mockSocket();
    const msg = { key: { participant: jid }, message: contextInfo ? { extendedTextMessage: { contextInfo } } : {} };
    await runEconomy(sock, 'group@g.us', msg, 'premiumtiempo', q, botData, () => {}, '.');
    return sent[0][1].text;
}

test('premiumtiempo informa el tiempo restante de la cuenta propia sin crear billetera', async () => {
    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString();
    const botData = { premiumUsers: { '111111111@s.whatsapp.net': { expiresAt } } };
    const text = await runStatus({ botData });
    assert.match(text, /Tu cuenta/);
    assert.match(text, /ACTIVO/);
    assert.match(text, /Tiempo restante: \*3 días y 2 horas\*/);
    assert.equal(botData.economy, undefined);
});

test('premiumtiempo resuelve la identidad LID de una mención a su número telefónico', async () => {
    const expiresAt = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
    const botData = {
        phoneAliases: { '222222222@s.whatsapp.net': '7777777@lid' },
        premiumUsers: { '222222222@s.whatsapp.net': { expiresAt } }
    };
    const text = await runStatus({
        botData,
        contextInfo: { mentionedJid: ['7777777@lid'] }
    });
    assert.match(text, /Jugador ··7777/);
    assert.match(text, /ACTIVO/);
    assert.match(text, /Tiempo restante: \*5 horas/);
});

test('premiumtiempo reconoce acceso permanente', async () => {
    const text = await runStatus({ botData: { premiumUsers: { '111111111@s.whatsapp.net': true } } });
    assert.match(text, /PREMIUM PERMANENTE/);
    assert.match(text, /sin vencimiento/);
});

test('premiumtiempo informa cuando el pase venció', async () => {
    const expiresAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const text = await runStatus({ botData: { premiumUsers: { '111111111@s.whatsapp.net': { expiresAt } } } });
    assert.match(text, /SIN PREMIUM ACTIVO/);
    assert.match(text, /Venció:/);
});

test('los alias de consulta de Premium y de ficha de objetos quedan registrados', () => {
    const aliases = runEconomy.aliases;
    for (const name of ['premiumtiempo', 'premiumtime', 'tiempopremium']) {
        assert.ok(Object.values(aliases).some(values => values.includes(name)), name);
    }
    for (const name of ['objeto', 'item', 'iteminfo']) {
        assert.ok(Object.values(aliases).some(values => values.includes(name)), name);
    }
});
