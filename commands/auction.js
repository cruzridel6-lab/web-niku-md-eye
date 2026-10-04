const COIN = '🪙 Niku Coins';
const COMMISSION_RATE = 0.05;
const MIN_PRICE = 50;
const MAX_DURATION_MINUTES = 24 * 60;

const LOOT = {
  gema_lunar: { name: '💎 Gema lunar', sellPrice: 4500 },
  colmillo_dragon: { name: '🦷 Colmillo de dragón', sellPrice: 6500 },
  runa_antigua: { name: '🔯 Runa antigua', sellPrice: 8000 },
  corazon_golem: { name: '🪨 Corazón de gólem', sellPrice: 10000 },
  pergamino_perdido: { name: '📜 Pergamino perdido', sellPrice: 12000 }
};

function numberOf(jid) { return String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, ''); }
function normalizeJid(jid) { return String(jid || '').split(':')[0].replace(/[^0-9@.a-z_-]/gi, ''); }
function fmt(value) { return Number(value || 0).toLocaleString('es-ES'); }
function reply(sock, chatId, msg, text) { return sock.sendMessage(chatId, { text }, { quoted: msg }); }
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
function returnLoot(botData, auction) {
  const seller = getUser(botData, auction.sellerChatId, auction.seller);
  seller.user.loot ||= {};
  seller.user.loot[auction.itemId] = (Number(seller.user.loot[auction.itemId]) || 0) + Number(auction.quantity || 1);
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
    returnLoot(botData, auction);
    auction.status = 'ended_no_bids';
    auction.endedAt = new Date(now).toISOString();
    return { auction, winner: null };
  }
  const seller = getUser(botData, auction.sellerChatId, auction.seller);
  seller.user.coins += Math.floor(Number(winner.amount) * (1 - COMMISSION_RATE));
  const buyer = getUser(botData, winner.chatId, winner.bidder);
  buyer.user.loot ||= {};
  buyer.user.loot[auction.itemId] = (Number(buyer.user.loot[auction.itemId]) || 0) + Number(auction.quantity || 1);
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
    `• *${prefix}subastar <objeto> <precio> [minutos]* — Publicar botín\n` +
    `• *${prefix}pujar <id> <cantidad>* — Hacer una puja\n` +
    `• *${prefix}mispujas* — Ver tus pujas\n` +
    `• *${prefix}missubastas* — Ver tus publicaciones\n` +
    `• *${prefix}cancelarsubasta <id>* — Cancelar si no hay pujas\n\n` +
    `📦 Objetos de mazmorra: ${Object.entries(LOOT).map(([id, item]) => `*${id}* (${fmt(item.sellPrice)} ${COIN})`).join(', ')}\n` +
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
  if (['subastaayuda', 'auctionhelp'].includes(canonical)) return reply(sock, chatId, msg, auctionHelp(prefix));
  if (['subastas', 'subasta', 'auction', 'auctions'].includes(canonical) || ['ver', 'lista', 'listar'].includes(String(args[0] || '').toLowerCase())) {
    return reply(sock, chatId, msg, formatListings(activeAuctions(botData), prefix));
  }
  if (['missubastas', 'misubastas'].includes(canonical)) {
    const rows = activeAuctions(botData).filter(item => item.seller === sender);
    return reply(sock, chatId, msg, rows.length ? `📦 *TUS SUBASTAS*\n\n${rows.map(item => `*${item.id}* · ${item.itemName} · ${fmt(item.currentBid || item.startingPrice)} ${COIN} · ${item.bids.length} pujas`).join('\n')}` : '📦 No tienes subastas activas.');
  }
  if (['mispujas', 'mybids'].includes(canonical)) {
    const rows = activeAuctions(botData).filter(item => item.bids?.some(bid => bid.bidder === sender));
    return reply(sock, chatId, msg, rows.length ? `🔨 *TUS PUJAS*\n\n${rows.map(item => { const bid = [...item.bids].reverse().find(b => b.bidder === sender); return `*${item.id}* · ${item.itemName} · Tu puja: *${fmt(bid.amount)} ${COIN}*`; }).join('\n')}` : '🔨 No tienes pujas activas.');
  }
  if (['cancelarsubasta', 'cancelauction'].includes(canonical)) {
    const auction = botData.auctions[args[0]];
    if (!auction || auction.status !== 'active' || auction.seller !== sender) return reply(sock, chatId, msg, '❌ No se encontró tu subasta activa.');
    if (auction.bids?.length) return reply(sock, chatId, msg, '❌ No puedes cancelar una subasta que ya tiene pujas.');
    returnLoot(botData, auction); auction.status = 'cancelled'; auction.endedAt = new Date().toISOString(); saveBotData(); touch(hooks);
    return reply(sock, chatId, msg, `✅ Subasta *${auction.id}* cancelada. El objeto volvió a tu inventario.`);
  }
  if (['pujar', 'bid'].includes(canonical)) {
    const auction = botData.auctions[args[0]];
    const amount = Math.floor(Number(args[1]));
    if (!auction || auction.status !== 'active' || Number(auction.expiresAt) <= now) return reply(sock, chatId, msg, '❌ La subasta no existe o ya terminó. Usa *.subastas*.');
    if (auction.seller === sender) return reply(sock, chatId, msg, '❌ No puedes pujar por tu propia publicación.');
    const minimum = Math.max(Number(auction.startingPrice) || MIN_PRICE, (Number(auction.currentBid) || 0) + 1);
    if (!Number.isFinite(amount) || amount < minimum) return reply(sock, chatId, msg, `❌ La puja mínima es *${fmt(minimum)} ${COIN}*.`);
    if (own.coins < amount) return reply(sock, chatId, msg, `❌ No tienes suficientes ${COIN}. Saldo: *${fmt(own.coins)}*.`);
    const previous = auction.bids?.[auction.bids.length - 1];
    if (previous) refundBid(botData, previous);
    own.coins -= amount;
    auction.bids ||= [];
    auction.bids.push({ bidder: sender, chatId, amount, createdAt: new Date(now).toISOString() });
    auction.currentBid = amount;
    saveBotData(); touch(hooks);
    return reply(sock, chatId, msg, `🔨 *PUJA REGISTRADA*\n\n${auction.itemName}\n💰 Oferta: *${fmt(amount)} ${COIN}*\n🧾 ID: *${auction.id}*\n⏳ La puja queda reservada hasta el cierre.`);
  }
  if (['subastar', 'publicarsubasta', 'sellauction'].includes(canonical)) {
    const itemId = String(args[0] || '').toLowerCase();
    const item = LOOT[itemId];
    const price = Math.floor(Number(args[1]));
    const duration = Math.min(MAX_DURATION_MINUTES, Math.max(5, Math.floor(Number(args[2]) || 60)));
    own.loot ||= {};
    if (!item) return reply(sock, chatId, msg, `❌ Objeto no válido.\n\n${auctionHelp(prefix)}`);
    if ((Number(own.loot[itemId]) || 0) < 1) return reply(sock, chatId, msg, `❌ No tienes *${item.name}*. Consíguelo en *${prefix}mazmorra*.`);
    if (!Number.isFinite(price) || price < MIN_PRICE) return reply(sock, chatId, msg, `❌ El precio inicial mínimo es *${fmt(MIN_PRICE)} ${COIN}*.`);
    const activeMine = activeAuctions(botData).filter(row => row.seller === sender).length;
    if (activeMine >= 5) return reply(sock, chatId, msg, '❌ Solo puedes tener 5 subastas activas al mismo tiempo.');
    own.loot[itemId] -= 1;
    if (own.loot[itemId] <= 0) delete own.loot[itemId];
    const auction = { id: `auc-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`, seller: sender, sellerChatId: chatId, itemId, itemName: item.name, quantity: 1, startingPrice: price, currentBid: 0, bids: [], status: 'active', createdAt: new Date(now).toISOString(), expiresAt: now + duration * 60000 };
    botData.auctions[auction.id] = auction;
    saveBotData(); touch(hooks);
    return reply(sock, chatId, msg, `✅ *SUBASTA PUBLICADA*\n\n📦 ${item.name}\n🧾 ID: *${auction.id}*\n💰 Precio inicial: *${fmt(price)} ${COIN}*\n⏳ Duración: *${duration} minutos*\n\nEl objeto quedó reservado hasta que termine la subasta.`);
  }
  return reply(sock, chatId, msg, auctionHelp(prefix));
}

module.exports = { runAuction, snapshot, settleExpiredAuctions, LOOT, COMMISSION_RATE };
