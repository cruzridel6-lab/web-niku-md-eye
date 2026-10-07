const { commandImagePath, sendImageCaption } = require('../lib/rpgMedia');
const { CLASS_EQUIPMENT, DUNGEON_LOOT, RPG_ITEMS, RPG_MATERIALS, RPG_GATHERING_LOOT, MERCHANT_ITEMS } = require('../lib/rpgCatalog');
const { rarityInfo } = require('../lib/rpgFeatures');
const COIN = '🪙 monedas de oro';
const COMMISSION_RATE = 0.05;
const MIN_PRICE = 50;
const MAX_DURATION_MINUTES = 24 * 60;

const LOOT = Object.fromEntries(DUNGEON_LOOT.map(item => [item.id, item]));
const RARITY_KEYS = new Set(['comun', 'poco_comun', 'raro', 'epico', 'legendario']);
const CLASS_GEAR = Object.fromEntries(Object.entries(CLASS_EQUIPMENT).flatMap(([classId, items]) => items.map(item => [item.id, { ...item, classId }])));

function numberOf(jid) { return String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, ''); }
function normalizeJid(jid) { return String(jid || '').split(':')[0].replace(/[^0-9@.a-z_-]/gi, ''); }
function fmt(value) { return Number(value || 0).toLocaleString('es-ES'); }
function reply(sock, chatId, msg, text) { return sock.sendMessage(chatId, { text }, { quoted: msg }); }
function imageReply(sock, chatId, msg, text, extra = {}) { return sendImageCaption(sock, chatId, msg, commandImagePath('auction'), text, extra); }
function senderOf(msg, chatId) { return normalizeJid(msg?.key?.participant || (msg?.key?.fromMe ? msg?.key?.remoteJid : chatId)); }
function ensureUser(botData, chatId, jid) {
  botData.economy ||= {};
  botData.economy[chatId] ||= { users: {} };
  const state = botData.economy[chatId];
  state.users ||= {};
  const key = normalizeJid(jid);
  state.users[key] ||= { coins: 0, bank: 0, lastSeen: Date.now() };
  const user = state.users[key];
  user.coins = Math.max(0, Number(user.coins) || 0);
  user.bank = Math.max(0, Number(user.bank) || 0);
  user.lastSeen = Date.now();
  return { state, key, user };
}
function getUser(botData, chatId, jid) { return ensureUser(botData, chatId, jid); }
function parseArgs(q) { return String(q || '').trim().split(/\s+/).filter(Boolean); }
function activeAuctions(botData) { return Object.values(botData.auctions || {}).filter(item => item.status === 'active'); }
function publicAuction(item) {
  return {
    id: item.id,
    itemId: item.itemId,
    itemName: item.itemName,
    quantity: item.quantity,
    seller: `Jugador ${numberOf(item.seller).slice(-4) || 'RPG'}`,
    startingPrice: item.startingPrice,
    currentBid: item.currentBid || 0,
    bidCount: item.bids?.length || 0,
    expiresAt: item.expiresAt,
    createdAt: item.createdAt,
    status: item.status
  };
}
function snapshot(botData) {
  return activeAuctions(botData).sort((a, b) => Number(a.expiresAt) - Number(b.expiresAt)).map(publicAuction);
}
function touch(hooks) { if (typeof hooks.onChanged === 'function') hooks.onChanged(); }
function auctionItemFrom(user, itemId) {
  const [baseId, rarity, ...extra] = String(itemId || '').toLowerCase().split(':');
  const loot = LOOT[baseId];
  if (!extra.length && loot && (!rarity || RARITY_KEYS.has(rarity)) && Number(user.loot?.[itemId]) > 0) {
    const info = rarityInfo(rarity || 'comun');
    return { inventoryType: 'loot', itemId, itemName: `${info.icon} ${info.label} ${loot.name}` };
  }
  const gatheredLoot = RPG_GATHERING_LOOT[baseId];
  if (!extra.length && !loot && gatheredLoot && (!rarity || RARITY_KEYS.has(rarity)) && Number(user.rpg?.loot?.[itemId]) > 0) {
    const info = rarityInfo(rarity || 'comun');
    return { inventoryType: 'rpgLoot', itemId, itemName: `${info.icon} ${info.label} ${gatheredLoot.name}` };
  }
  const gear = CLASS_GEAR[itemId];
  if (gear && user.equipment?.[itemId]) return { inventoryType: 'classEquipment', itemId, itemName: gear.name, requiredClass: gear.classId, equipmentData: { ...user.equipment[itemId] } };
  const item = RPG_ITEMS[itemId];
  if (item && Number(user.rpg?.inventory?.[itemId]) > 0) return { inventoryType: 'rpgInventory', itemId, itemName: item.name };
  const material = RPG_MATERIALS[itemId];
  if (material && Number(user.rpg?.materials?.[itemId]) > 0) return { inventoryType: 'material', itemId, itemName: material.name };
  const tool = MERCHANT_ITEMS[itemId];
  if (tool && Number(user.tools?.[itemId]?.durability) > 0) return { inventoryType: 'tool', itemId, itemName: `${tool.name} · ${user.tools[itemId].durability}/${tool.durability} usos`, toolData: { ...user.tools[itemId] } };
  return null;
}
function takeAuctionItem(user, item) {
  switch (item.inventoryType) {
    case 'loot': user.loot[item.itemId] -= 1; if (user.loot[item.itemId] <= 0) delete user.loot[item.itemId]; break;
    case 'classEquipment': delete user.equipment[item.itemId]; break;
    case 'rpgInventory': user.rpg.inventory[item.itemId] -= 1; if (user.rpg.inventory[item.itemId] <= 0) delete user.rpg.inventory[item.itemId]; break;
    case 'rpgLoot': user.rpg.loot[item.itemId] -= 1; if (user.rpg.loot[item.itemId] <= 0) delete user.rpg.loot[item.itemId]; break;
    case 'material': user.rpg.materials[item.itemId] -= 1; if (user.rpg.materials[item.itemId] <= 0) delete user.rpg.materials[item.itemId]; break;
    case 'tool': delete user.tools[item.itemId]; break;
  }
}
function giveAuctionItem(user, auction) {
  const quantity = Number(auction.quantity || 1);
  switch (auction.inventoryType || 'loot') {
    case 'loot': user.loot ||= {}; user.loot[auction.itemId] = (Number(user.loot[auction.itemId]) || 0) + quantity; break;
    case 'classEquipment': user.equipment ||= {}; user.equipment[auction.itemId] = auction.equipmentData || { acquiredAt: new Date().toISOString(), source: 'auction' }; break;
    case 'rpgInventory': user.rpg ||= {}; user.rpg.inventory ||= {}; user.rpg.inventory[auction.itemId] = (Number(user.rpg.inventory[auction.itemId]) || 0) + quantity; break;
    case 'rpgLoot': user.rpg ||= {}; user.rpg.loot ||= {}; user.rpg.loot[auction.itemId] = (Number(user.rpg.loot[auction.itemId]) || 0) + quantity; break;
    case 'material': user.rpg ||= {}; user.rpg.materials ||= {}; user.rpg.materials[auction.itemId] = (Number(user.rpg.materials[auction.itemId]) || 0) + quantity; break;
    case 'tool': user.tools ||= {}; user.tools[auction.itemId] = auction.toolData || { durability: MERCHANT_ITEMS[auction.itemId]?.durability || 1 }; break;
    default: user.loot ||= {}; user.loot[auction.itemId] = (Number(user.loot[auction.itemId]) || 0) + quantity;
  }
}
function returnAuctionItem(botData, auction) {
  const seller = getUser(botData, auction.sellerChatId, auction.seller);
  giveAuctionItem(seller.user, auction);
}
function refundBid(botData, bid) {
  const buyer = getUser(botData, bid.chatId, bid.bidder);
  buyer.user.coins += Number(bid.amount) || 0;
}
function settleAuction(botData, auction, now = Date.now()) {
  if (!auction || auction.status !== 'active' || Number(auction.expiresAt) > now) return null;
  const bids = Array.isArray(auction.bids) ? auction.bids : [];
  const winner = bids.length ? bids[bids.length - 1] : null;
  if (!winner) {
    returnAuctionItem(botData, auction);
    auction.status = 'ended_no_bids';
    auction.endedAt = new Date(now).toISOString();
    return { auction, winner: null };
  }
  const buyer = getUser(botData, winner.chatId, winner.bidder);
  if (auction.inventoryType === 'classEquipment' && buyer.user.rpg?.class !== auction.requiredClass) {
    refundBid(botData, winner);
    returnAuctionItem(botData, auction);
    auction.status = 'ended_no_bids';
    auction.endedAt = new Date(now).toISOString();
    auction.invalidatedWinner = winner.bidder;
    return { auction, winner: null };
  }
  const seller = getUser(botData, auction.sellerChatId, auction.seller);
  seller.user.coins += Math.floor(Number(winner.amount) * (1 - COMMISSION_RATE));
  giveAuctionItem(buyer.user, auction);
  auction.status = 'ended_sold';
  auction.winner = winner.bidder;
  auction.finalPrice = Number(winner.amount);
  auction.endedAt = new Date(now).toISOString();
  auction.commission = Math.floor(Number(winner.amount) * COMMISSION_RATE);
  return { auction, winner };
}
function settleExpiredAuctions(botData, now = Date.now()) {
  const settled = activeAuctions(botData).map(item => settleAuction(botData, item, now)).filter(Boolean);
  if (settled.length) return settled;
  return [];
}
function auctionHelp(prefix) {
  return `🏛️ *CASA DE SUBASTAS NIKU MD*\n\n` +
    `• *${prefix}subastas* — Ver publicaciones activas\n` +
    `• *${prefix}subastar <id> <precio> [minutos]* — Publicar botín, material o equipo\n` +
    `• *${prefix}pujar <id> <cantidad>* — Hacer una puja\n` +
    `• *${prefix}mispujas* — Ver tus pujas\n` +
    `• *${prefix}missubastas* — Ver tus publicaciones\n` +
    `• *${prefix}cancelarsubasta <id>* — Cancelar si no hay pujas\n\n` +
    `📦 Drops: *gema_lunar*, *fragmento_abisal*, *escama_prismatica*, *mine-diamante*, *fish-tesoro* y variantes de rareza\n` +
    `⚔️ Equipo: armas/armaduras de clase, fabricados, herramientas (*espada*, *pico*) y materiales RPG (*hierro*, *runa*)\n` +
    `Ejemplos: *${prefix}subastar gema_lunar:legendario 9000* · *${prefix}subastar sword_iron 1500* · *${prefix}subastar espada 1500*\n` +
    `💸 Comisión de venta: *${Math.round(COMMISSION_RATE * 100)}%*`;
}
function formatListings(items, prefix) {
  if (!items.length) return `🏛️ No hay subastas activas. Publica un drop con *${prefix}subastar gema_lunar 5000*.`;
  return `🏛️ *SUBASTAS ACTIVAS*\n\n${items.slice(0, 15).map((item, i) => `${i + 1}. *${item.id}* · ${item.itemName} x${item.quantity}\n   💰 ${fmt(item.currentBid || item.startingPrice)} ${COIN} · 🔨 ${item.bids?.length || 0} pujas\n   ⏳ ${Math.max(1, Math.ceil((Number(item.expiresAt) - Date.now()) / 60000))} min · Vendedor: Jugador ${numberOf(item.seller).slice(-4)}`).join('\n\n')}`;
}
async function runAuction(sock, chatId, msg, command, q, botData, saveBotData, prefix = '.', hooks = {}) {
  botData.auctions ||= {};
  const now = Date.now();
  const expired = settleExpiredAuctions(botData, now);
  if (expired.length) { saveBotData(); touch(hooks); }
  const canonical = String(command || '').toLowerCase();
  const args = parseArgs(q);
  const sender = senderOf(msg, chatId);
  const own = getUser(botData, chatId, sender).user;
  if (['subastaayuda', 'auctionhelp'].includes(canonical)) return imageReply(sock, chatId, msg, auctionHelp(prefix));
  if (['subastas', 'subasta', 'auction', 'auctions'].includes(canonical) || ['ver', 'lista', 'listar'].includes(String(args[0] || '').toLowerCase())) {
    return imageReply(sock, chatId, msg, formatListings(activeAuctions(botData), prefix));
  }
  if (['missubastas', 'misubastas'].includes(canonical)) {
    const rows = activeAuctions(botData).filter(item => item.seller === sender);
    return imageReply(sock, chatId, msg, rows.length ? `📦 *TUS SUBASTAS*\n\n${rows.map(item => `*${item.id}* · ${item.itemName} · ${fmt(item.currentBid || item.startingPrice)} ${COIN} · ${item.bids.length} pujas`).join('\n')}` : '📦 No tienes subastas activas.');
  }
  if (['mispujas', 'mybids'].includes(canonical)) {
    const rows = activeAuctions(botData).filter(item => item.bids?.some(bid => bid.bidder === sender));
    return imageReply(sock, chatId, msg, rows.length ? `🔨 *TUS PUJAS*\n\n${rows.map(item => { const bid = [...item.bids].reverse().find(b => b.bidder === sender); return `*${item.id}* · ${item.itemName} · Tu puja: *${fmt(bid.amount)} ${COIN}*`; }).join('\n')}` : '🔨 No tienes pujas activas.');
  }
  if (['cancelarsubasta', 'cancelauction'].includes(canonical)) {
    const auction = botData.auctions[args[0]];
    if (!auction || auction.status !== 'active' || auction.seller !== sender) return imageReply(sock, chatId, msg, '❌ No se encontró tu subasta activa.');
    if (auction.bids?.length) return imageReply(sock, chatId, msg, '❌ No puedes cancelar una subasta que ya tiene pujas.');
    returnAuctionItem(botData, auction); auction.status = 'cancelled'; auction.endedAt = new Date().toISOString(); saveBotData(); touch(hooks);
    return imageReply(sock, chatId, msg, `✅ Subasta *${auction.id}* cancelada. El objeto volvió a tu inventario.`);
  }
  if (['pujar', 'bid'].includes(canonical)) {
    const auction = botData.auctions[args[0]];
    const amount = Math.floor(Number(args[1]));
    if (!auction || auction.status !== 'active' || Number(auction.expiresAt) <= now) return imageReply(sock, chatId, msg, '❌ La subasta no existe o ya terminó. Usa *.subastas*.');
    if (auction.seller === sender) return imageReply(sock, chatId, msg, '❌ No puedes pujar por tu propia publicación.');
    if (auction.requiredClass && own.rpg?.class !== auction.requiredClass) return imageReply(sock, chatId, msg, `❌ Esta pieza es exclusiva de la clase *${auction.requiredClass}*. Solo esa clase puede pujar.`);
    const minimum = Math.max(Number(auction.startingPrice) || MIN_PRICE, (Number(auction.currentBid) || 0) + 1);
    if (!Number.isFinite(amount) || amount < minimum) return imageReply(sock, chatId, msg, `❌ La puja mínima es *${fmt(minimum)} ${COIN}*.`);
    if (own.coins < amount) return imageReply(sock, chatId, msg, `❌ No tienes suficientes ${COIN}. Saldo: *${fmt(own.coins)}*.`);
    const previous = auction.bids?.[auction.bids.length - 1];
    if (previous) refundBid(botData, previous);
    own.coins -= amount;
    auction.bids ||= [];
    auction.bids.push({ bidder: sender, chatId, amount, createdAt: new Date(now).toISOString() });
    auction.currentBid = amount;
    saveBotData(); touch(hooks);
    return imageReply(sock, chatId, msg, `🔨 *PUJA REGISTRADA*\n\n${auction.itemName}\n💰 Oferta: *${fmt(amount)} ${COIN}*\n🧾 ID: *${auction.id}*\n⏳ La puja queda reservada hasta el cierre.`);
  }
  if (['subastar', 'publicarsubasta', 'sellauction'].includes(canonical)) {
    const listingArgs = [...args];
    let duration = 60;
    if (listingArgs.length >= 3 && /^\d+$/.test(listingArgs.at(-1)) && /^\d+$/.test(listingArgs.at(-2))) duration = Math.min(MAX_DURATION_MINUTES, Math.max(5, Number(listingArgs.pop())));
    const price = Math.floor(Number(listingArgs.pop()));
    const itemId = listingArgs.join(' ').toLowerCase();
    duration = Math.min(MAX_DURATION_MINUTES, Math.max(5, duration));
    const item = auctionItemFrom(own, itemId);
    if (!item) return imageReply(sock, chatId, msg, `❌ Objeto no válido o no disponible en tu inventario.\n\n${auctionHelp(prefix)}`);
    if (!Number.isFinite(price) || price < MIN_PRICE) return imageReply(sock, chatId, msg, `❌ El precio inicial mínimo es *${fmt(MIN_PRICE)} ${COIN}*.`);
    const activeMine = activeAuctions(botData).filter(row => row.seller === sender).length;
    if (activeMine >= 5) return imageReply(sock, chatId, msg, '❌ Solo puedes tener 5 subastas activas al mismo tiempo.');
    takeAuctionItem(own, item);
    const auction = { id: `auc-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`, seller: sender, sellerChatId: chatId, itemId, itemName: item.itemName, inventoryType: item.inventoryType, requiredClass: item.requiredClass, equipmentData: item.equipmentData, toolData: item.toolData, quantity: 1, startingPrice: price, currentBid: 0, bids: [], status: 'active', createdAt: new Date(now).toISOString(), expiresAt: now + duration * 60000 };
    botData.auctions[auction.id] = auction;
    saveBotData(); touch(hooks);
    return imageReply(sock, chatId, msg, `✅ *SUBASTA PUBLICADA*\n\n📦 ${item.itemName}\n🧾 ID: *${auction.id}*\n💰 Precio inicial: *${fmt(price)} ${COIN}*\n⏳ Duración: *${duration} minutos*\n\nEl objeto quedó reservado hasta que termine la subasta.`);
  }
  return imageReply(sock, chatId, msg, auctionHelp(prefix));
}

module.exports = { runAuction, snapshot, settleAuction, settleExpiredAuctions, LOOT, COMMISSION_RATE, MIN_PRICE, MAX_DURATION_MINUTES };
