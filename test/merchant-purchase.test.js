const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const runEconomy = require('../commands/economy');

const CHAT = 'merchant-tests@g.us';
const BUYER = '15550000071@s.whatsapp.net';
const SELLER = '15550000072@s.whatsapp.net';

function harness({ coins = 10000, classKey = 'guerrero' } = {}) {
    const user = {
        coins,
        bank: 0,
        tools: {},
        rpg: { class: classKey, level: 1, xp: 0, hp: 100, maxHp: 100, energy: 50, maxEnergy: 50, inventory: {}, equipment: {}, materials: {}, stats: { commandsUsed: 1 }, achievements: { first_steps: { unlockedAt: new Date(0).toISOString(), reward: 500 } } }
    };
    const botData = {
        economy: { [CHAT]: { users: { [BUYER]: user } } },
        profiles: {},
        phoneAliases: {}
    };
    const sent = [];
    let saves = 0;
    const sock = { sendMessage: async (_chat, payload) => { sent.push(payload); return { key: { id: `reply-${sent.length}` } }; } };
    const msg = { key: { remoteJid: CHAT, participant: BUYER, participantAlt: BUYER } };
    return { user, botData, sent, sock, msg, get saves() { return saves; }, save: () => { saves += 1; } };
}

async function run(ctx, command, q = '') {
    const originalRandom = Math.random;
    Math.random = () => 0.99;
    try {
        return await runEconomy(ctx.sock, CHAT, ctx.msg, command, q, ctx.botData, ctx.save, '.');
    } finally {
        Math.random = originalRandom;
    }
}

function lastText(ctx) {
    const payload = ctx.sent.at(-1) || {};
    return payload.caption || payload.text || '';
}

test('`.mercader comprar pico` compra la herramienta, descuenta oro y confirma su uso', async () => {
    const ctx = harness({ coins: 5000 });
    await run(ctx, 'mercader', 'comprar pico');

    assert.equal(ctx.user.coins, 2500);
    assert.equal(ctx.user.tools.pico.durability, 15);
    assert.ok(ctx.saves >= 1);
    assert.match(lastText(ctx), /COMPRA COMPLETADA/);
    assert.match(lastText(ctx), /minar/);
});

test('el atajo anterior `.mercader pico` sigue funcionando', async () => {
    const ctx = harness({ coins: 5000 });
    await run(ctx, 'mercader', 'pico minero');

    assert.equal(ctx.user.coins, 2500);
    assert.equal(ctx.user.tools.pico.durability, 15);
});

test('`.comprar` acepta nombres completos con tildes y espacios', async () => {
    const ctx = harness({ coins: 5000 });
    await run(ctx, 'comprar', 'Caña de pescar');

    assert.equal(ctx.user.coins, 2800);
    assert.equal(ctx.user.tools.cana.durability, 15);
    assert.match(lastText(ctx), /Caña de pescar/);
    assert.match(lastText(ctx), /pescar/);
});

test('`.buy pickaxe` funciona como alias en inglés', async () => {
    const ctx = harness({ coins: 5000 });
    await run(ctx, 'buy', 'pickaxe');

    assert.equal(ctx.user.coins, 2500);
    assert.equal(ctx.user.tools.pico.durability, 15);
});

test('compra equipo por nombre aunque tenga tildes y lo activa', async () => {
    const ctx = harness({ coins: 40000, classKey: 'guerrero' });
    await run(ctx, 'comprar', 'Mandoble del Dragón');

    assert.equal(ctx.user.coins, 12000);
    assert.ok(ctx.user.equipment.mandoble_dragon);
    assert.match(lastText(ctx), /COMPRA COMPLETADA/);
    assert.match(lastText(ctx), /Equipo activado/);
    assert.match(lastText(ctx), /trabajo/);
});

test('`.mercado comprar` sigue comprando una publicación de otro jugador', async () => {
    const ctx = harness({ coins: 5000 });
    const seller = { coins: 0, bank: 0, rpg: {} };
    ctx.botData.economy[CHAT].users[SELLER] = seller;
    ctx.botData.rpgMarket = {
        'm-abc': { id: 'm-abc', chatId: CHAT, item: 'sword_iron', price: 1000, seller: SELLER, status: 'open' }
    };
    await run(ctx, 'mercado', 'comprar m-abc');

    assert.equal(ctx.user.coins, 4000);
    assert.equal(ctx.user.rpg.inventory.sword_iron, 1);
    assert.equal(seller.coins, 950);
    assert.equal(ctx.botData.rpgMarket['m-abc'].status, 'sold');
    assert.match(lastText(ctx), /Compraste/);
});

test('el catálogo del mercader organiza herramientas y equipo e indica cómo comprar', async () => {
    const ctx = harness();
    await run(ctx, 'mercader');
    const text = lastText(ctx);

    assert.match(text, /HERRAMIENTAS/);
    assert.match(text, /EQUIPO DE/);
    assert.match(text, /\.comprar <nombre o ID>/);
    assert.match(text, /\.mercado ver\/publicar\/comprar/);
    assert.match(text, /mandoble_dragon/);
    assert.ok(Buffer.byteLength(text) < 1024, 'el pie de foto debe mantenerse dentro del límite de WhatsApp');
});

test('si falta oro, explica cuánto cuesta y no cobra el artículo', async () => {
    const ctx = harness({ coins: 100 });
    await run(ctx, 'comprar', 'espada de herramienta');

    assert.equal(ctx.user.coins, 100);
    assert.match(lastText(ctx), /ORO INSUFICIENTE/);
    assert.match(lastText(ctx), /Te faltan: \*2900\*/);
});

test('un objeto fabricable no se cobra por error y responde con su receta', async () => {
    const ctx = harness({ coins: 5000 });
    await run(ctx, 'comprar', 'Espada de hierro');

    assert.equal(ctx.user.coins, 5000);
    assert.match(lastText(ctx), /se fabrica/i);
    assert.match(lastText(ctx), /\.fabricar espada_hierro/);
});

test('un objeto no disponible da respuesta útil y no queda sin contestación', async () => {
    const ctx = harness({ coins: 5000 });
    await run(ctx, 'comprar', 'objeto inventado');

    assert.equal(ctx.user.coins, 5000);
    assert.match(lastText(ctx), /No reconocí/);
    assert.match(lastText(ctx), /\.mercader/);
});

test('index.js enruta .comprar y el catálogo .objeto al módulo de economía', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
    assert.match(source, /case 'comprar': case 'buy':/);
    assert.match(source, /case 'objeto': case 'item': case 'iteminfo':/);
});
