const test = require('node:test');
const assert = require('node:assert/strict');
const runEconomy = require('../commands/economy');

test('la mazmorra puede soltar equipo de la clase, activar su bonificación y desbloquear el logro', async () => {
    const jid = '123456789@s.whatsapp.net';
    const user = {
        coins: 0,
        bank: 0,
        tools: { espada: { durability: 12 } },
        rpg: { class: 'guerrero', level: 1, xp: 0, energy: 50, maxEnergy: 50, hp: 100, maxHp: 100 },
        dungeon: { day: new Date().toISOString().slice(0, 10), runs: 0, integrity: 100 }
    };
    const botData = { economy: { room: { users: { [jid]: user } } }, profiles: {} };
    const messages = [];
    const sock = { sendMessage: async (_chatId, payload) => { messages.push(payload); return { key: { id: String(messages.length) } }; } };
    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
        await runEconomy(sock, 'room', { key: { participant: jid }, pushName: 'Aventurero' }, 'dungeon', '', botData, () => {}, '.');
    } finally {
        Math.random = originalRandom;
    }
    assert.equal(user.equipment.lanza_titan.source, 'dungeon');
    assert.equal(user.rpg.stats.dungeonGearDrops, 1);
    assert.ok(user.rpg.achievements.dungeon_gear);
    assert.match(messages.at(-1).caption, /subastar lanza_titan/);
    assert.doesNotMatch(messages.at(-1).caption, /Equipamiento activo: \*\+8% de recompensa/);
});
