const test = require('node:test');
const assert = require('node:assert/strict');
const { runAuction, settleAuction } = require('../commands/auction');

function setup(users) {
    const botData = { economy: { room: { users } }, auctions: {} };
    const sent = [];
    let saves = 0;
    const sock = { sendMessage: async (_chatId, payload) => { sent.push(payload); return payload; } };
    const save = () => { saves += 1; };
    const msgFor = jid => ({ key: { participant: jid, remoteJid: 'room', fromMe: false }, pushName: jid.split('@')[0] });
    return { botData, sent, saves: () => saves, sock, save, msgFor };
}

test('subasta y cancelación conservan el botín con rareza', async () => {
    const seller = '111@s.whatsapp.net';
    const ctx = setup({ [seller]: { coins: 0, loot: { 'gema_lunar:legendario': 1 } } });
    await runAuction(ctx.sock, 'room', ctx.msgFor(seller), 'subastar', 'gema_lunar:legendario 9000', ctx.botData, ctx.save);
    const auction = Object.values(ctx.botData.auctions)[0];
    assert.equal(auction.inventoryType, 'loot');
    assert.match(auction.itemName, /Legendario/);
    assert.equal(ctx.botData.economy.room.users[seller].loot['gema_lunar:legendario'], undefined);
    await runAuction(ctx.sock, 'room', ctx.msgFor(seller), 'cancelarsubasta', auction.id, ctx.botData, ctx.save);
    assert.equal(ctx.botData.economy.room.users[seller].loot['gema_lunar:legendario'], 1);
    assert.equal(auction.status, 'cancelled');
});

test('se pueden subastar objetos fabricados y al cancelar vuelven a la bolsa', async () => {
    const seller = '222@s.whatsapp.net';
    const ctx = setup({ [seller]: { coins: 0, rpg: { inventory: { sword_iron: 1 } } } });
    await runAuction(ctx.sock, 'room', ctx.msgFor(seller), 'subastar', 'sword_iron 1500', ctx.botData, ctx.save);
    const auction = Object.values(ctx.botData.auctions)[0];
    assert.equal(auction.inventoryType, 'rpgInventory');
    assert.equal(ctx.botData.economy.room.users[seller].rpg.inventory.sword_iron, undefined);
    await runAuction(ctx.sock, 'room', ctx.msgFor(seller), 'cancelarsubasta', auction.id, ctx.botData, ctx.save);
    assert.equal(ctx.botData.economy.room.users[seller].rpg.inventory.sword_iron, 1);
});

test('se subastan materiales RPG y el ganador los recibe al cerrar', async () => {
    const seller = '333@s.whatsapp.net';
    const buyer = '444@s.whatsapp.net';
    const ctx = setup({
        [seller]: { coins: 0, rpg: { materials: { hierro: 2 } } },
        [buyer]: { coins: 1000 }
    });
    await runAuction(ctx.sock, 'room', ctx.msgFor(seller), 'subastar', 'hierro 100', ctx.botData, ctx.save);
    const auction = Object.values(ctx.botData.auctions)[0];
    assert.equal(ctx.botData.economy.room.users[seller].rpg.materials.hierro, 1);
    await runAuction(ctx.sock, 'room', ctx.msgFor(buyer), 'pujar', `${auction.id} 100`, ctx.botData, ctx.save);
    auction.expiresAt = Date.now() - 1;
    settleAuction(ctx.botData, auction);
    assert.equal(ctx.botData.economy.room.users[buyer].rpg.materials.hierro, 1);
    assert.equal(ctx.botData.economy.room.users[seller].coins, 95);
    assert.equal(auction.status, 'ended_sold');
});

test('las piezas exclusivas se transfieren al comprador de la clase adecuada', async () => {
    const seller = '555@s.whatsapp.net';
    const buyer = '666@s.whatsapp.net';
    const ctx = setup({
        [seller]: { coins: 0, rpg: { class: 'guerrero' }, equipment: { lanza_titan: { source: 'dungeon' } } },
        [buyer]: { coins: 2000, rpg: { class: 'guerrero' } }
    });
    await runAuction(ctx.sock, 'room', ctx.msgFor(seller), 'subastar', 'lanza_titan 1000', ctx.botData, ctx.save);
    const auction = Object.values(ctx.botData.auctions)[0];
    assert.equal(auction.inventoryType, 'classEquipment');
    await runAuction(ctx.sock, 'room', ctx.msgFor(buyer), 'pujar', `${auction.id} 1000`, ctx.botData, ctx.save);
    auction.expiresAt = Date.now() - 1;
    settleAuction(ctx.botData, auction);
    assert.equal(ctx.botData.economy.room.users[buyer].equipment.lanza_titan.source, 'dungeon');
    assert.equal(ctx.botData.economy.room.users[seller].equipment.lanza_titan, undefined);
});

test('no se permite pujar por equipo de otra clase ni se bloquea el saldo', async () => {
    const seller = '777@s.whatsapp.net';
    const buyer = '888@s.whatsapp.net';
    const ctx = setup({
        [seller]: { coins: 0, rpg: { class: 'mago' }, equipment: { baston_cometa: { source: 'dungeon' } } },
        [buyer]: { coins: 2000, rpg: { class: 'guerrero' } }
    });
    await runAuction(ctx.sock, 'room', ctx.msgFor(seller), 'subastar', 'baston_cometa 1000', ctx.botData, ctx.save);
    const auction = Object.values(ctx.botData.auctions)[0];
    await runAuction(ctx.sock, 'room', ctx.msgFor(buyer), 'pujar', `${auction.id} 1000`, ctx.botData, ctx.save);
    assert.equal(ctx.botData.economy.room.users[buyer].coins, 2000);
    assert.equal(auction.bids.length, 0);
    assert.match(ctx.sent.at(-1).text || ctx.sent.at(-1).caption, /exclusiva de la clase/);
});

test('permite subastar botín raro de pesca cuyo identificador contiene espacios', async () => {
    const seller = '999@s.whatsapp.net';
    const ctx = setup({ [seller]: { coins: 0, rpg: { loot: { 'fish-pez globo:legendario': 1 } } } });
    await runAuction(ctx.sock, 'room', ctx.msgFor(seller), 'subastar', 'fish-pez globo:legendario 5000 15', ctx.botData, ctx.save);
    const auction = Object.values(ctx.botData.auctions)[0];
    assert.equal(auction.itemId, 'fish-pez globo:legendario');
    assert.equal(auction.inventoryType, 'rpgLoot');
    assert.equal(auction.expiresAt - Date.parse(auction.createdAt), 15 * 60000);
    assert.match(auction.itemName, /Pez globo/);
    assert.equal(ctx.botData.economy.room.users[seller].rpg.loot['fish-pez globo:legendario'], undefined);
    await runAuction(ctx.sock, 'room', ctx.msgFor(seller), 'cancelarsubasta', auction.id, ctx.botData, ctx.save);
    assert.equal(ctx.botData.economy.room.users[seller].rpg.loot['fish-pez globo:legendario'], 1);
});

test('las herramientas transferidas conservan los usos restantes', async () => {
    const seller = '1010@s.whatsapp.net';
    const buyer = '1111@s.whatsapp.net';
    const ctx = setup({
        [seller]: { coins: 0, tools: { espada: { durability: 4, acquiredAt: '2026-01-01' } } },
        [buyer]: { coins: 1000 }
    });
    await runAuction(ctx.sock, 'room', ctx.msgFor(seller), 'subastar', 'espada 500', ctx.botData, ctx.save);
    const auction = Object.values(ctx.botData.auctions)[0];
    assert.equal(auction.inventoryType, 'tool');
    assert.equal(ctx.botData.economy.room.users[seller].tools.espada, undefined);
    await runAuction(ctx.sock, 'room', ctx.msgFor(buyer), 'pujar', `${auction.id} 500`, ctx.botData, ctx.save);
    auction.expiresAt = Date.now() - 1;
    settleAuction(ctx.botData, auction);
    assert.equal(ctx.botData.economy.room.users[buyer].tools.espada.durability, 4);
});

test('devuelve y reembolsa una pieza si la clase del mejor postor cambia antes del cierre', async () => {
    const seller = '1212@s.whatsapp.net';
    const buyer = '1313@s.whatsapp.net';
    const ctx = setup({
        [seller]: { coins: 0, rpg: { class: 'mago' }, equipment: { baston_cometa: { source: 'dungeon' } } },
        [buyer]: { coins: 1500, rpg: { class: 'mago' } }
    });
    await runAuction(ctx.sock, 'room', ctx.msgFor(seller), 'subastar', 'baston_cometa 1000', ctx.botData, ctx.save);
    const auction = Object.values(ctx.botData.auctions)[0];
    await runAuction(ctx.sock, 'room', ctx.msgFor(buyer), 'pujar', `${auction.id} 1000`, ctx.botData, ctx.save);
    ctx.botData.economy.room.users[buyer].rpg.class = 'guerrero';
    auction.expiresAt = Date.now() - 1;
    settleAuction(ctx.botData, auction);
    assert.equal(auction.status, 'ended_no_bids');
    assert.equal(ctx.botData.economy.room.users[buyer].coins, 1500);
    assert.equal(ctx.botData.economy.room.users[seller].equipment.baston_cometa.source, 'dungeon');
    assert.equal(ctx.botData.economy.room.users[seller].coins, 0);
});
