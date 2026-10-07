const test = require('node:test');
const assert = require('node:assert/strict');
const { handleExpansion, ensureRpg } = require('../lib/rpgExpansion');

function harness() {
    const messages = [];
    const sock = { sendMessage: async (_chatId, payload) => { messages.push(payload); return payload; } };
    let saves = 0;
    return { messages, sock, save: () => { saves += 1; }, saves: () => saves };
}

test('migra el equipo legado y elimina duplicados de mazmorra sin borrar drops de recolección', () => {
    const user = { coins: 0, rpg: { inventory: { sword_iron: 1, armor_reinforced: 1 }, equipment: { sword_iron: true, armor_reinforced: true }, loot: { 'gema_lunar:legendario': 1, 'fish-pez globo:epico': 2 } } };
    const rpg = ensureRpg(user);
    assert.equal(rpg.inventory.sword_iron, undefined);
    assert.equal(rpg.inventory.armor_reinforced, undefined);
    assert.equal(rpg.equipment.sword_iron, true);
    assert.equal(rpg.equipment.armor_reinforced, true);
    assert.equal(rpg.loot['gema_lunar:legendario'], undefined);
    assert.equal(rpg.loot['fish-pez globo:epico'], 2);
    ensureRpg(user);
    assert.equal(rpg.inventory.sword_iron, undefined);
});

test('se puede fabricar una espada nueva, equiparla y devolver la anterior a la bolsa', async () => {
    const ctx = harness();
    const user = {
        coins: 10000,
        rpg: {
            class: 'guerrero',
            level: 1,
            hp: 100,
            maxHp: 100,
            energy: 50,
            maxEnergy: 50,
            materials: { hierro: 8, carbon: 4, runa: 2 },
            inventory: { sword_iron: 1 },
            equipment: { sword_iron: true }
        }
    };
    const common = { sock: ctx.sock, chatId: 'room', msg: { key: {} }, user, jid: '123@s.whatsapp.net', botData: {}, save: ctx.save, prefix: '.' };
    await handleExpansion({ ...common, canonical: 'craft', args: ['espada_abismal'] });
    assert.equal(user.rpg.inventory.sword_abyss, 1);
    assert.equal(user.rpg.equipment.sword_iron, true);
    await handleExpansion({ ...common, canonical: 'inventory', args: ['equipar', 'sword_abyss'] });
    assert.equal(user.rpg.equipment.sword_abyss, true);
    assert.equal(user.rpg.equipment.sword_iron, undefined);
    assert.equal(user.rpg.inventory.sword_iron, 1);
    assert.equal(user.rpg.inventory.sword_abyss, undefined);
    await handleExpansion({ ...common, canonical: 'inventory', args: ['quitar', 'sword_abyss'] });
    assert.equal(user.rpg.equipment.sword_abyss, undefined);
    assert.equal(user.rpg.inventory.sword_abyss, 1);
    assert.ok(ctx.saves() >= 3);
});
