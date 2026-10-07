const test = require('node:test');
const assert = require('node:assert/strict');
const runEconomy = require('../commands/economy');
const { handleExpansion } = require('../lib/rpgExpansion');
const { CLASS_EQUIPMENT } = require('../lib/rpgCatalog');
const { classImagePath } = require('../lib/rpgMedia');

function economyHarness(jid, user = {}) {
    const botData = { economy: { room: { users: { [jid]: user } } }, profiles: {} };
    const messages = [];
    const sock = { sendMessage: async (_chatId, payload) => { messages.push(payload); return { key: { id: String(messages.length) } }; } };
    return { botData, messages, sock, user };
}

function combatHarness() {
    const user = { coins: 0, rpg: { class: 'paladin', level: 1, xp: 0, hp: 40, maxHp: 100, energy: 50, maxEnergy: 50, inventory: { potion: 0 }, materials: {}, equipment: {} } };
    const messages = [];
    const sock = { sendMessage: async (_chatId, payload) => { messages.push(payload); return { key: { id: String(messages.length) } }; } };
    return { user, messages, sock, botData: {} };
}

test('acepta `.clase paladín`, muestra su ventaja y la ofrece a cuentas nuevas', async () => {
    const jid = '201@s.whatsapp.net';
    const ctx = economyHarness(jid, { coins: 1000, bank: 0 });
    const msg = { key: { participant: jid }, pushName: 'Nuevo paladín' };
    await runEconomy(ctx.sock, 'room', msg, 'clase', 'paladín', ctx.botData, () => {}, '.');
    assert.equal(ctx.user.rpg.class, 'paladin');
    const classMessage = ctx.messages.at(-1);
    assert.ok(classImagePath('paladin'));
    assert.equal(classMessage.image.url, classImagePath('paladin'));
    assert.match(classMessage.caption, /Paladín/);
    assert.match(classMessage.caption, /\+15% de monedas en las mazmorras/);

    const fresh = economyHarness('202@s.whatsapp.net', { coins: 0, bank: 0 });
    await runEconomy(fresh.sock, 'room', { key: { participant: '202@s.whatsapp.net' } }, 'clase', '', fresh.botData, () => {}, '.');
    assert.match(fresh.messages.at(-1).text, /🛡️ Paladín — \*paladin\*/);
    assert.match(fresh.messages.at(-1).text, /\.clase paladin/);
});

test('habilidad Bastión divino cobra una sola vez, cura y reduce el contraataque', async () => {
    const ctx = combatHarness();
    const jid = '203@s.whatsapp.net';
    const common = { sock: ctx.sock, chatId: 'room', msg: { key: { participant: jid } }, user: ctx.user, jid, botData: ctx.botData, save: () => {}, prefix: '.' };
    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
        await handleExpansion({ ...common, canonical: 'combat', args: ['iniciar'] });
        await handleExpansion({ ...common, canonical: 'combat', args: ['habilidad', 'bastion_divino'] });
        assert.equal(ctx.user.rpg.energy, 38, 'solo debe cobrar los 12 puntos indicados para la habilidad');
        assert.equal(ctx.user.rpg.hp, 57, 'cura 25 HP y el escudo reduce el golpe entrante');
        assert.match(ctx.messages.at(-1).text, /Bastión divino/);
        assert.match(ctx.messages.at(-1).text, /mitigará el contraataque/);

        const battle = ctx.botData.rpgBattles.room[jid];
        const enemyHp = battle.enemy.currentHp;
        await handleExpansion({ ...common, canonical: 'combat', args: ['habilidad', 'no_existe'] });
        assert.equal(ctx.user.rpg.energy, 38, 'una habilidad inválida no consume energía');
        assert.equal(battle.enemy.currentHp, enemyHp, 'una habilidad inválida no avanza el combate');

        ctx.user.rpg.energy = 10;
        await handleExpansion({ ...common, canonical: 'combat', args: ['habilidad', 'bastion_divino'] });
        assert.equal(ctx.user.rpg.energy, 10, 'un intento sin energía suficiente no debe descontarla');
    } finally {
        Math.random = originalRandom;
    }
});

test('Paladín obtiene la bonificación correcta en mazmorras y tiene equipo exclusivo', async () => {
    assert.equal(CLASS_EQUIPMENT.paladin.length, 2);
    assert.ok(CLASS_EQUIPMENT.paladin.every(item => item.dungeonDrop));
    const jid = '204@s.whatsapp.net';
    const user = {
        coins: 0,
        bank: 0,
        tools: { espada: { durability: 12 } },
        rpg: { class: 'paladin', level: 1, xp: 0, energy: 50, maxEnergy: 50, hp: 100, maxHp: 100, stats: { commandsUsed: 1 }, achievements: { first_steps: { reward: 500 } } }
    };
    const ctx = economyHarness(jid, user);
    const originalRandom = Math.random;
    Math.random = () => 0.99;
    try {
        await runEconomy(ctx.sock, 'room', { key: { participant: jid }, pushName: 'Paladín' }, 'dungeon', '', ctx.botData, () => {}, '.');
    } finally {
        Math.random = originalRandom;
    }
    assert.equal(user.coins, Math.floor(550 * 1.15));
    assert.match(ctx.messages.at(-1).caption || ctx.messages.at(-1).text, /\+15% de recompensa/);
});
