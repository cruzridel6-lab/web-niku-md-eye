const test = require('node:test');
const assert = require('node:assert/strict');
const runEconomy = require('../commands/economy');

const CHAT = 'premium-shop-tests@g.us';
const PHONE = '15550000031@s.whatsapp.net';
const LID = '27770000031@lid';
const DAY_MS = 24 * 60 * 60 * 1000;

function harness({ coins = 0, phoneAliases = {}, premiumUsers = {}, sender = PHONE, senderAlt } = {}) {
    const user = { coins, bank: 0 };
    const botData = {
        economy: { [CHAT]: { users: { [PHONE]: user } } },
        profiles: {},
        phoneAliases,
        premiumUsers
    };
    const sent = [];
    let saves = 0;
    const sock = { sendMessage: async (_chat, payload) => { sent.push(payload); return { key: { id: `reply-${sent.length}` } }; } };
    const msg = { key: { remoteJid: CHAT, participant: sender, ...(senderAlt ? { participantAlt: senderAlt } : {}) } };
    return { botData, user, sent, sock, msg, get saves() { return saves; }, save: () => { saves += 1; } };
}

async function run(ctx, command, q = '') {
    return runEconomy(ctx.sock, CHAT, ctx.msg, command, q, ctx.botData, ctx.save, '.');
}

function lastText(ctx) { return ctx.sent.at(-1)?.caption || ctx.sent.at(-1)?.text || ''; }

test('la tienda muestra paquetes caros de 1, 2 y 4 días con sus precios', async () => {
    const ctx = harness();
    await run(ctx, 'tiendapremium');

    assert.deepEqual(runEconomy.premiumShopPackages, {
        '1': { days: 1, price: 300000 },
        '2': { days: 2, price: 500000 },
        '4': { days: 4, price: 1000000 }
    });
    assert.match(lastText(ctx), /1 día.*300\.000/s);
    assert.match(lastText(ctx), /2 días.*500\.000/s);
    assert.match(lastText(ctx), /4 días.*1\.000\.000/s);
    assert.match(lastText(ctx), /comprarpremium 1/);
    assert.match(lastText(ctx), /PASE INICIAL/);
    assert.match(lastText(ctx), /PASE DE ÉLITE/);
    assert.match(ctx.sent.at(-1).image.url, /data\/Tienda\.jpg$/);
});

test('`.comprarpremium 1` cobra 300.000 monedas y concede un día', async () => {
    const ctx = harness({ coins: 300000 });
    const before = Date.now();
    await run(ctx, 'comprarpremium', '1');

    assert.equal(ctx.user.coins, 0);
    assert.equal(ctx.botData.premiumUsers[PHONE].source, 'gold_shop');
    assert.ok(Date.parse(ctx.botData.premiumUsers[PHONE].expiresAt) >= before + DAY_MS);
    assert.ok(Date.parse(ctx.botData.premiumUsers[PHONE].expiresAt) <= Date.now() + DAY_MS);
    assert.match(lastText(ctx), /PASE ACTIVADO/);
    assert.equal(ctx.saves, 1);
});

test('`.tiendapremium comprar 2` suma dos días al vencimiento activo', async () => {
    const currentExpiry = Date.now() + 8 * 60 * 60 * 1000;
    const ctx = harness({
        coins: 500000,
        premiumUsers: { [PHONE]: { grantedAt: new Date().toISOString(), expiresAt: new Date(currentExpiry).toISOString(), source: 'token' } }
    });
    await run(ctx, 'tiendapremium', 'comprar 2');

    assert.equal(ctx.user.coins, 0);
    assert.equal(Date.parse(ctx.botData.premiumUsers[PHONE].expiresAt), currentExpiry + 2 * DAY_MS);
    assert.match(lastText(ctx), /se sumó a tu pase activo/i);
});

test('extiende una compra Premium previa aunque esté guardada bajo el LID vinculado', async () => {
    const currentExpiry = Date.now() + DAY_MS;
    const ctx = harness({
        coins: 300000,
        phoneAliases: { '15550000031': LID },
        premiumUsers: { [LID]: { grantedAt: new Date().toISOString(), expiresAt: new Date(currentExpiry).toISOString(), source: 'token' } },
        sender: LID,
        senderAlt: PHONE
    });
    await run(ctx, 'comprarpremium', '1');

    assert.equal(ctx.user.coins, 0);
    assert.equal(Date.parse(ctx.botData.premiumUsers[PHONE].expiresAt), currentExpiry + DAY_MS);
    assert.equal(ctx.botData.premiumUsers[LID], undefined);
});

test('no cobra si faltan monedas ni permite volver a comprar Premium permanente', async () => {
    const poor = harness({ coins: 299999 });
    await run(poor, 'comprarpremium', '1');
    assert.equal(poor.user.coins, 299999);
    assert.equal(Object.keys(poor.botData.premiumUsers).length, 0);
    assert.match(lastText(poor), /ORO INSUFICIENTE/);
    assert.match(lastText(poor), /Te faltan: \*1 moneda de oro/);

    const permanent = harness({ coins: 500000, premiumUsers: { [PHONE]: true } });
    await run(permanent, 'comprarpremium', '2');
    assert.equal(permanent.user.coins, 500000);
    assert.equal(permanent.botData.premiumUsers[PHONE], true);
    assert.match(lastText(permanent), /PREMIUM PERMANENTE/i);
});
