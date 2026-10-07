const test = require('node:test');
const assert = require('node:assert/strict');
const runEconomy = require('../commands/economy');

const CHAT = 'rpg-economy-limits@g.us';
const PLAYER = '15550000091@s.whatsapp.net';

function harness() {
    const user = {
        coins: 0,
        bank: 0,
        tools: {},
        rpg: {
            class: 'guerrero', level: 1, xp: 0, lastXp: 0,
            hp: 100, maxHp: 100, energy: 50, maxEnergy: 50,
            inventory: {}, equipment: {}, materials: {},
            stats: { commandsUsed: 1 },
            achievements: { first_steps: { unlockedAt: new Date(0).toISOString(), reward: 500 } }
        }
    };
    const botData = { economy: { [CHAT]: { users: { [PLAYER]: user } } }, profiles: {}, phoneAliases: {}, clans: {} };
    const sent = [];
    const sock = {
        sendMessage: async (_chat, payload) => { sent.push(payload); return { key: { id: `response-${sent.length}` } }; },
        relayMessage: async () => ({ status: 200 })
    };
    const msg = { key: { remoteJid: CHAT, participant: PLAYER, participantAlt: PLAYER, fromMe: false } };
    return { user, botData, sent, sock, msg, saveCount: 0 };
}

async function run(ctx, command, q = '') {
    const original = Math.random;
    Math.random = () => 0.99;
    try {
        return await runEconomy(ctx.sock, CHAT, ctx.msg, command, q, ctx.botData, () => { ctx.saveCount += 1; }, '.');
    } finally {
        Math.random = original;
    }
}

test('work tiene un límite diario y al alcanzarlo no concede más oro', async () => {
    const ctx = harness();
    for (let i = 0; i < 8; i += 1) {
        ctx.user.lastWork = 0;
        await run(ctx, 'work');
    }
    const coinsAtLimit = ctx.user.coins;
    assert.equal(ctx.user.rpg.featureState.actions.work, 8);

    ctx.user.lastWork = 0;
    await run(ctx, 'work');
    assert.equal(ctx.user.coins, coinsAtLimit);
    assert.equal(ctx.user.rpg.featureState.actions.work, 8);
    assert.match(ctx.sent.at(-1).text, /8 tareas diarias/i);
});

test('la recompensa diaria escala modestamente y la racha tiene un techo monetario', async () => {
    const ctx = harness();
    await run(ctx, 'daily');
    assert.equal(ctx.user.coins, 500);
    assert.equal(ctx.user.streak, 1);

    const now = new Date();
    ctx.user.lastDaily = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 0, 0, 0);
    ctx.user.streak = 100;
    await run(ctx, 'daily');
    assert.equal(ctx.user.coins, 1450);
    assert.equal(ctx.user.streak, 101);
    assert.match(ctx.sent.at(-1).text, /950 monedas de oro/);

    ctx.user.lastDaily = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 2, 0, 0, 0);
    await run(ctx, 'daily');
    assert.equal(ctx.user.coins, 1950);
    assert.equal(ctx.user.streak, 1);
    assert.match(ctx.sent.at(-1).text, /500 monedas de oro/);
});

test('un oficio sin herramienta no consume cupo ni energía; una herramienta rota no permite cobrar otra vez', async () => {
    const ctx = harness();
    const coinsBefore = ctx.user.coins;
    await run(ctx, 'minar');
    assert.equal(ctx.user.coins, coinsBefore);
    assert.equal(ctx.user.rpg.energy, 50);
    assert.equal(ctx.user.rpg.featureState.actions.mine || 0, 0);

    ctx.user.tools.pico = { durability: 1, maxDurability: 15 };
    await run(ctx, 'minar');
    assert.equal(ctx.user.tools.pico.durability, 0);
    assert.equal(ctx.user.rpg.featureState.actions.mine, 1);
    const coinsAfterSuccess = ctx.user.coins;
    const energyAfterSuccess = ctx.user.rpg.energy;

    ctx.user.lastMine = 0;
    await run(ctx, 'minar');
    assert.equal(ctx.user.coins, coinsAfterSuccess);
    assert.equal(ctx.user.rpg.energy, energyAfterSuccess);
    assert.equal(ctx.user.rpg.featureState.actions.mine, 1);
});

test('einfo muestra los cupos diarios, enfriamientos y energía', async () => {
    const ctx = harness();
    ctx.user.rpg.featureState = { day: new Date().toISOString().slice(0, 10), week: '', actions: { work: 3, mine: 4 }, eventAt: 0 };
    await run(ctx, 'einfo');
    assert.match(ctx.sent.at(-1).text, /TIEMPOS Y CUPOS/);
    assert.match(ctx.sent.at(-1).text, /Energía: \*50\/50\*/);
    assert.match(ctx.sent.at(-1).text, /work: \*3\/8\*/);
    assert.match(ctx.sent.at(-1).text, /mine: \*4\/20\*/);
    assert.match(ctx.sent.at(-1).text, /Mazmorra: \*0\/3\*/);
});

test('la guerra de clanes entrega un premio moderado solo a la tesorería y aplica enfriamiento', async () => {
    const ctx = harness();
    const defender = '15550000092@s.whatsapp.net';
    ctx.botData.economy[CHAT].users[defender] = {
        coins: 0, bank: 0,
        rpg: { class: 'guerrero', level: 1, xp: 0, stats: {}, equipment: {} }
    };
    ctx.botData.clans = {
        alpha: { name: 'Alpha', owner: PLAYER, members: [PLAYER], xp: 0, level: 1, coins: 0, wins: 0, losses: 0 },
        beta: { name: 'Beta', owner: defender, members: [defender], xp: 0, level: 1, coins: 0, wins: 0, losses: 0 }
    };
    ctx.botData.clanWars = {
        'war-1': { id: 'war-1', challenger: 'alpha', defender: 'beta', status: 'accepted' }
    };

    await run(ctx, 'clan', 'guerra combatir');
    const war = ctx.botData.clanWars['war-1'];
    const winner = ctx.botData.clans[war.winner];
    assert.equal(war.status, 'resolved');
    assert.ok(winner.coins >= 1750 && winner.coins <= 4000);
    assert.equal(ctx.user.coins, 0, 'el premio no debe duplicarse en la billetera del líder');
    assert.ok(ctx.botData.clans.alpha.warCooldownUntil > Date.now());
    assert.ok(ctx.botData.clans.beta.warCooldownUntil > Date.now());

    const clanCoinsAfterWin = winner.coins;
    await run(ctx, 'clan', 'guerra combatir');
    await run(ctx, 'clan', 'guerra desafiar Beta');
    assert.equal(winner.coins, clanCoinsAfterWin);
    assert.equal(Object.keys(ctx.botData.clanWars).length, 1, 'no debe crearse otra guerra durante el enfriamiento');
});
