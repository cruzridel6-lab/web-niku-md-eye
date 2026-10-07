const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const runEconomy = require('../commands/economy');
const { runAuction } = require('../commands/auction');
const { sendActionButtons } = require('../lib/interactiveActions');

const CHAT = 'interactive-tests@g.us';
const BUYER = '15550000081@s.whatsapp.net';
const SELLER = '15550000082@s.whatsapp.net';
const BOT = '15550000000:1@s.whatsapp.net';

function harness({ coins = 20000, classKey = 'guerrero', loot = {} } = {}) {
    const user = {
        coins,
        bank: 0,
        tools: {},
        loot: { ...loot },
        rpg: { class: classKey, level: 1, xp: 0, hp: 100, maxHp: 100, energy: 50, maxEnergy: 50, inventory: {}, equipment: {}, materials: {}, stats: { commandsUsed: 1 }, achievements: { first_steps: { unlockedAt: new Date(0).toISOString(), reward: 500 } } }
    };
    const botData = { economy: { [CHAT]: { users: { [BUYER]: user } } }, profiles: {}, phoneAliases: {}, auctions: {} };
    const sent = [];
    const relayed = [];
    let messageId = 0;
    const sock = {
        user: { id: BOT },
        sendMessage: async (_chat, payload) => {
            sent.push(payload);
            return { key: { id: `reply-${++messageId}` } };
        },
        relayMessage: async (jid, message, options) => {
            relayed.push({ jid, message, options });
            return { status: 200 };
        }
    };
    const msg = { key: { remoteJid: CHAT, participant: BUYER, participantAlt: BUYER, fromMe: false } };
    return { user, botData, sent, relayed, sock, msg, save: () => {} };
}

function decodedButtons(ctx, relayIndex = 0) {
    const interactive = ctx.relayed[relayIndex]?.message?.interactiveMessage;
    return (interactive?.nativeFlowMessage?.buttons || []).map(button => JSON.parse(button.buttonParamsJson));
}

async function withStableRandom(fn) {
    const original = Math.random;
    Math.random = () => 0.99;
    try { return await fn(); }
    finally { Math.random = original; }
}

async function runEconomyCommand(ctx, command, q = '', prefix = '.') {
    return withStableRandom(() => runEconomy(ctx.sock, CHAT, ctx.msg, command, q, ctx.botData, ctx.save, prefix));
}

async function runAuctionCommand(ctx, command, q = '', prefix = '.') {
    return withStableRandom(() => runAuction(ctx.sock, CHAT, ctx.msg, command, q, ctx.botData, ctx.save, prefix));
}

test('el mercader presenta botones para comprar las tres herramientas y abrir el equipo de clase', async () => {
    const ctx = harness();
    await runEconomyCommand(ctx, 'mercader');

    assert.equal(ctx.relayed.length, 2);
    assert.deepEqual(decodedButtons(ctx).map(button => button.id), [
        'cmd_comprar pico',
        'cmd_comprar espada',
        'cmd_comprar cana'
    ]);
    assert.ok(decodedButtons(ctx, 1).some(button => button.id === 'cmd_mercader equipo'));
});

test('el selector del mercader ofrece comprar piezas y navegar las páginas de equipo', async () => {
    const ctx = harness();
    await runEconomyCommand(ctx, 'mercader', 'equipo');

    const ids = decodedButtons(ctx).map(button => button.id);
    assert.ok(ids.includes('cmd_comprar mandoble_dragon'));
    assert.ok(ids.includes('cmd_comprar armadura_coloso'));
    assert.ok(ids.includes('cmd_mercader equipo 2'));

    ctx.relayed.length = 0;
    await runEconomyCommand(ctx, 'mercader', 'equipo 2');
    const secondPageIds = decodedButtons(ctx).map(button => button.id);
    assert.ok(secondPageIds.includes('cmd_comprar lanza_titan'));
    assert.ok(secondPageIds.includes('cmd_comprar escudo_abismal'));
    assert.ok(secondPageIds.includes('cmd_mercader equipo 1'));
});

test('el mercado da botones para comprar publicaciones visibles y publicar un objeto', async () => {
    const ctx = harness();
    ctx.botData.economy[CHAT].users[SELLER] = { coins: 0, bank: 0, rpg: {} };
    ctx.botData.rpgMarket = {
        'm-abc': { id: 'm-abc', item: 'sword_iron', price: 1000, seller: SELLER, status: 'open' }
    };
    await runEconomyCommand(ctx, 'mercado', 'ver');

    const ids = decodedButtons(ctx).map(button => button.id);
    assert.ok(ids.includes('cmd_mercado comprar m-abc'));
    assert.equal(ids.length, 1);

    ctx.relayed.length = 0;
    ctx.botData.rpgMarket = {};
    await runEconomyCommand(ctx, 'mercado', 'ver');
    assert.ok(decodedButtons(ctx).some(button => button.id === 'cmd_mercado publicar'));
});

test('invertir sin monto muestra ejemplos válidos según el saldo', async () => {
    const ctx = harness({ coins: 20000 });
    await runEconomyCommand(ctx, 'invertir');

    assert.deepEqual(decodedButtons(ctx).map(button => button.id), [
        'cmd_invertir 500',
        'cmd_invertir 5000',
        'cmd_invertir 10000'
    ]);
    assert.match(ctx.sent.at(-1).text, /ganancia o pérdida/);
});

test('subastar permite elegir objeto, confirmar precio y ofrece acciones tras publicar', async () => {
    const ctx = harness({ loot: { gema_lunar: 1 } });
    await runAuctionCommand(ctx, 'subastar');
    assert.ok(decodedButtons(ctx).some(button => button.id === 'cmd_subastar gema_lunar'));

    ctx.relayed.length = 0;
    await runAuctionCommand(ctx, 'subastar', 'gema_lunar');
    assert.deepEqual(decodedButtons(ctx).map(button => button.id), [
        'cmd_subastar gema_lunar 50',
        'cmd_subastar gema_lunar 500',
        'cmd_subastar gema_lunar 1000'
    ]);

    ctx.relayed.length = 0;
    await runAuctionCommand(ctx, 'subastar', 'gema_lunar 500');
    const auction = Object.values(ctx.botData.auctions)[0];
    assert.equal(auction.startingPrice, 500);
    assert.equal(ctx.user.loot.gema_lunar, undefined);
    const afterPublication = decodedButtons(ctx).map(button => button.id);
    assert.ok(afterPublication.includes('cmd_subastas'));
    assert.ok(afterPublication.includes('cmd_missubastas'));
    assert.ok(afterPublication.includes(`cmd_cancelarsubasta ${auction.id}`));
});

test('la lista de subastas incluye puja rápida con el mínimo vigente', async () => {
    const ctx = harness();
    ctx.botData.auctions['auc-live'] = {
        id: 'auc-live', seller: SELLER, sellerChatId: CHAT, itemId: 'gema_lunar', itemName: 'Gema lunar',
        quantity: 1, startingPrice: 500, currentBid: 900, bids: [], status: 'active', expiresAt: Date.now() + 60000
    };
    await runAuctionCommand(ctx, 'subastas');

    const ids = decodedButtons(ctx).map(button => button.id);
    assert.ok(ids.includes('cmd_pujar auc-live 901'));
    assert.ok(ids.includes('cmd_subastar'));
});

test('las respuestas rápidas conservan el comando aunque el prefijo configurado no sea un punto', async () => {
    const relayed = [];
    const sock = { user: { id: BOT }, relayMessage: async (_jid, message) => relayed.push(message) };
    assert.equal(await sendActionButtons(sock, CHAT, 'Prueba', [{ label: 'Invertir', command: '!invertir 500' }]), true);
    const button = JSON.parse(relayed[0].interactiveMessage.nativeFlowMessage.buttons[0].buttonParamsJson);
    assert.equal(button.id, 'cmd_invertir 500');

    const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
    assert.match(source, /settings\.prefix \|\| '\.'/);
});


test('el selector de clase muestra botones para las cinco clases y permite elegir Paladín', async () => {
    const ctx = harness({ classKey: '' });
    await runEconomyCommand(ctx, 'clase');

    const ids = ctx.relayed.flatMap((_, index) => decodedButtons(ctx, index)).map(button => button.id);
    assert.deepEqual(ids, [
        'cmd_clase guerrero',
        'cmd_clase mago',
        'cmd_clase picaro',
        'cmd_clase tirador',
        'cmd_clase paladin'
    ]);

    await runEconomyCommand(ctx, 'clase', 'paladin');
    assert.equal(ctx.user.rpg.class, 'paladin');
});

test('la bienvenida de vinculación tiene tema RPG y elimina el texto de canción no seleccionada', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
    assert.match(source, /NIKU MD · REINO RPG/);
    assert.match(source, /Accesos rápidos para comenzar la aventura/);
    assert.doesNotMatch(source, /Sin canción seleccionada/i);
    assert.match(source, /classChoices\.slice\(0, 3\)/);
    assert.match(source, /classChoices\.slice\(3\)/);
});
