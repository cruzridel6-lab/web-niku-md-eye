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

    const ids = ctx.relayed.flatMap((_, index) => decodedButtons(ctx, index).map(button => button.id));
    assert.ok(ids.includes('cmd_comprar pico'));
    assert.ok(ids.includes('cmd_comprar espada'));
    assert.ok(ids.includes('cmd_comprar cana'));
    for (const id of ['potion', 'pocion_menor', 'pocion_mayor', 'elixir_energia']) assert.ok(ids.includes(`cmd_comprar ${id}`));
    assert.ok(ids.includes('cmd_mercader equipo'));
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
        'm-abc': { id: 'm-abc', chatId: CHAT, item: 'sword_iron', price: 1000, seller: SELLER, status: 'open' }
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

test('la compra del mercado liquida al vendedor y respeta la identidad LID al bloquear la compra propia', async () => {
    const ctx = harness();
    ctx.botData.economy[CHAT].users[SELLER] = { coins: 0, bank: 0, rpg: {} };
    const listing = { id: 'm-sale', chatId: CHAT, item: 'sword_iron', price: 1000, seller: SELLER, status: 'open' };
    ctx.botData.rpgMarket = { [listing.id]: listing };

    await runEconomyCommand(ctx, 'mercado', `comprar ${listing.id}`);
    assert.equal(ctx.user.coins, 19000);
    assert.equal(ctx.botData.economy[CHAT].users[SELLER].coins, 950);
    assert.equal(ctx.user.rpg.inventory.sword_iron, 1);
    assert.equal(listing.status, 'sold');

    const ownListing = { id: 'm-own', chatId: CHAT, item: 'sword_iron', price: 1000, seller: '15559990000@lid', status: 'open' };
    ctx.botData.phoneAliases = { '15550000081': '15559990000@lid' };
    ctx.botData.rpgMarket[ownListing.id] = ownListing;
    const coinsBefore = ctx.user.coins;
    await runEconomyCommand(ctx, 'mercado', `comprar ${ownListing.id}`);
    assert.equal(ctx.user.coins, coinsBefore);
    assert.equal(ownListing.status, 'open');
    assert.match(ctx.sent.at(-1).caption || ctx.sent.at(-1).text, /no puedes comprarte a ti mismo/i);
});

test('el mercado no muestra ni cobra publicaciones de otro chat', async () => {
    const ctx = harness();
    ctx.botData.economy['otro@g.us'] = { users: { [SELLER]: { coins: 0, rpg: {} } } };
    ctx.botData.rpgMarket = {
        'm-other': { id: 'm-other', chatId: 'otro@g.us', item: 'sword_iron', price: 5000, seller: SELLER, status: 'open' }
    };
    await runEconomyCommand(ctx, 'mercado', 'ver');
    assert.ok(decodedButtons(ctx).every(button => button.id !== 'cmd_mercado comprar m-other'));

    const coinsBefore = ctx.user.coins;
    await runEconomyCommand(ctx, 'mercado', 'comprar m-other');
    assert.equal(ctx.user.coins, coinsBefore);
    assert.equal(ctx.user.rpg.inventory.sword_iron, undefined);
    assert.match(ctx.sent.at(-1).caption || ctx.sent.at(-1).text, /no se descontó oro/i);
});

test('publicar en el mercado ofrece cancelar y devuelve el objeto reservado', async () => {
    const ctx = harness();
    ctx.user.rpg.inventory.sword_iron = 1;
    await runEconomyCommand(ctx, 'mercado', 'publicar sword_iron 500');
    const listing = Object.values(ctx.botData.rpgMarket)[0];
    assert.equal(listing.chatId, CHAT);
    assert.equal(ctx.user.rpg.inventory.sword_iron, undefined);
    assert.ok(decodedButtons(ctx).some(button => button.id === `cmd_mercado cancelar ${listing.id}`));

    await runEconomyCommand(ctx, 'mercado', `cancelar ${listing.id}`);
    assert.equal(listing.status, 'cancelled');
    assert.equal(ctx.user.rpg.inventory.sword_iron, 1);
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

test('el menú RPG incluye todos los oficios, mazmorra, clase y consumibles', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
    for (const command of ['clase', 'usar', 'work', 'crime', 'slut', 'daily', 'minar', 'pescar', 'cazar', 'explorar', 'recolectar', 'patrullar', 'mazmorra', 'raid', 'fabricar', 'mercader', 'mercado', 'subastas', 'invertir']) {
        assert.match(source, new RegExp(`\\['${command}',`), `falta el acceso interactivo .${command}`);
    }
    assert.match(source, /const commandPrefix = String\(settings\.prefix \|\| '\.'\)/);
    assert.match(source, /text\.toLowerCase\(\)\.startsWith\(commandPrefix\.toLowerCase\(\)\)/);
});

test('las pantallas de nivel y logros ofrecen navegación a progreso, habilidades y menú', async () => {
    const ctx = harness();
    await runEconomyCommand(ctx, 'nivel');
    assert.deepEqual(decodedButtons(ctx).map(button => button.id), [
        'cmd_misiones', 'cmd_habilidades', 'cmd_rpgmenu'
    ]);

    ctx.relayed.length = 0;
    await runEconomyCommand(ctx, 'logros');
    assert.deepEqual(decodedButtons(ctx).map(button => button.id), [
        'cmd_misiones', 'cmd_nivel', 'cmd_rpgmenu'
    ]);
});

test('el combate muestra botones válidos y rechaza acciones no reconocidas sin gastar energía', async () => {
    const ctx = harness();
    await runEconomyCommand(ctx, 'combate', 'iniciar');
    const startIds = decodedButtons(ctx).map(button => button.id);
    assert.ok(startIds.includes('cmd_combate atacar'));
    assert.ok(startIds.some(id => id.startsWith('cmd_combate habilidad ')));
    assert.ok(startIds.includes('cmd_combate defender'));

    const energyBefore = ctx.user.rpg.energy;
    ctx.relayed.length = 0;
    await runEconomyCommand(ctx, 'combate', 'accion-inexistente');
    assert.equal(ctx.user.rpg.energy, energyBefore);
    assert.match(ctx.sent.at(-1).text, /esa acción no existe/i);
});

test('los botones de consumibles usan el ítem correcto y no consumen una poción con HP completo', async () => {
    const ctx = harness();
    ctx.user.rpg.hp = 40;
    ctx.user.rpg.inventory = { pocion_menor: 1, pocion_mayor: 1, elixir_energia: 1 };
    await runEconomyCommand(ctx, 'usar');
    assert.deepEqual(decodedButtons(ctx).map(button => button.id), [
        'cmd_usar pocion_menor', 'cmd_usar pocion_mayor', 'cmd_usar elixir_energia'
    ]);

    ctx.relayed.length = 0;
    await runEconomyCommand(ctx, 'usar', 'pocion_menor');
    assert.equal(ctx.user.rpg.hp, 65);
    assert.equal(ctx.user.rpg.inventory.pocion_menor, undefined);

    ctx.user.rpg.hp = ctx.user.rpg.maxHp;
    ctx.user.rpg.inventory.pocion_mayor = 1;
    await runEconomyCommand(ctx, 'usar', 'pocion_mayor');
    assert.equal(ctx.user.rpg.inventory.pocion_mayor, 1);
    assert.match(ctx.sent.at(-1).text, /vida completa/i);
});

test('el taller pagina los botones de todas las recetas sin exceder tres por mensaje', async () => {
    const ctx = harness();
    await runEconomyCommand(ctx, 'fabricar');
    assert.ok(ctx.relayed.length >= 3, 'las recetas deben repartirse en varios mensajes de botones');
    for (let index = 0; index < ctx.relayed.length; index += 1) {
        const buttons = decodedButtons(ctx, index);
        assert.ok(buttons.length <= 3);
        assert.ok(buttons.every(button => button.id.startsWith('cmd_fabricar ')));
    }
    const ids = ctx.relayed.flatMap((_, index) => decodedButtons(ctx, index).map(button => button.id));
    for (const recipe of ['pocion', 'pocion_menor', 'pocion_mayor', 'elixir_energia', 'espada_hierro', 'armadura', 'espada_abismal', 'armadura_escamas', 'amuleto_lunar']) {
        assert.ok(ids.includes(`cmd_fabricar ${recipe}`));
    }
});

test('las raids cooperativas muestran botones para lista, creación e inicio de lobby', async () => {
    const ctx = harness();
    await runEconomyCommand(ctx, 'raid', 'ayuda');
    assert.ok(decodedButtons(ctx).some(button => button.id === 'cmd_raid lista'));
    assert.ok(decodedButtons(ctx).some(button => button.id === 'cmd_raid crear dragon'));

    ctx.user.rpg.level = 3;
    ctx.relayed.length = 0;
    await runEconomyCommand(ctx, 'raid', 'crear dragon');
    const raid = Object.values(ctx.botData.rpgRaids)[0];
    assert.ok(raid);
    assert.ok(decodedButtons(ctx).some(button => button.id === `cmd_raid unirse ${raid.id}`));
    assert.ok(decodedButtons(ctx).some(button => button.id === 'cmd_raid lista'));
});

test('una raid reconoce el teléfono vinculado a un miembro LID y conserva el límite de un turno', async () => {
    const ctx = harness();
    const lid = '991122334455@lid';
    ctx.botData.phoneAliases = { '15550000081': lid };
    ctx.botData.economy[CHAT].users[SELLER] = {
        coins: 0, bank: 0,
        rpg: { class: 'guerrero', level: 1, xp: 0, hp: 100, maxHp: 100, energy: 50, maxEnergy: 50, inventory: {}, equipment: {}, materials: {}, stats: {} }
    };
    const raid = {
        id: 'raid-lid-legacy', chatId: CHAT, creator: lid, status: 'active', round: 1, maxPlayers: 2,
        boss: { name: 'Jefe LID', hp: 99999, currentHp: 99999, attack: 1, reward: 1000, xp: 10, drop: 'runa' },
        participants: {
            [SELLER]: { jid: SELLER, name: 'Compañero', damage: 0 },
            [lid]: { jid: lid, name: 'Aventurero LID', damage: 0 }
        },
        actions: {}
    };
    ctx.botData.rpgRaids = { [raid.id]: raid };

    await runEconomyCommand(ctx, 'raid', 'atacar');
    const firstDamage = raid.participants[lid].damage;
    assert.ok(firstDamage > 0);
    assert.equal(raid.actions[lid], 1);
    assert.ok(ctx.user.rpg.hp < 100, 'el contraataque a la identidad LID debe afectar el perfil telefónico vinculado');
    await runEconomyCommand(ctx, 'raid', 'atacar');
    assert.equal(raid.participants[lid].damage, firstDamage);
    assert.match(ctx.sent.at(-1).text || ctx.sent.at(-1).caption, /ya atacaste en esta ronda/i);
});

test('una victoria de raid reparte como máximo el oro del jefe y no vuelve a pagar al repetir el botón', async () => {
    const ctx = harness();
    ctx.user.coins = 0;
    const secondPlayer = {
        coins: 0, bank: 0,
        rpg: { level: 1, xp: 0, lastXp: 0, stats: {}, inventory: {}, materials: {}, equipment: {} }
    };
    ctx.botData.economy[CHAT].users[SELLER] = secondPlayer;
    ctx.botData.rpgRaids = {
        'raid-one-shot': {
            id: 'raid-one-shot', chatId: CHAT, creator: BUYER, status: 'active', round: 1,
            boss: { name: 'Jefe de prueba', hp: 1, currentHp: 1, attack: 1, reward: 1000, xp: 25, drop: 'runa' },
            participants: {
                [BUYER]: { jid: BUYER, name: 'Aventurero 1', damage: 0 },
                [SELLER]: { jid: SELLER, name: 'Aventurero 2', damage: 0 }
            },
            actions: {}
        }
    };

    await runEconomyCommand(ctx, 'raid', 'atacar');
    const firstPayout = ctx.user.coins + secondPlayer.coins;
    assert.equal(firstPayout, 1000, 'la suma del grupo debe respetar el fondo del jefe');
    assert.equal(ctx.user.rpg.stats.raidsWon, 1);

    await runEconomyCommand(ctx, 'raid', 'atacar');
    assert.equal(ctx.user.coins + secondPlayer.coins, firstPayout);
    assert.equal(ctx.user.rpg.stats.raidsWon, 1);
});
