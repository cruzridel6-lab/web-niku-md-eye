const profileCommand = require('./profile');
const { handleExpansion, ensureRpg, updateTitles, activateWelcomeMission, RECIPES } = require('../lib/rpgExpansion');
const { classImagePath, commandImagePath, itemImagePath, shopImagePath, dungeonImagePath, sendImageCaption, sendItemCaption } = require('../lib/rpgMedia');
const { showItemDetails } = require('../lib/rpgItemDetails');
const { ensureFeatureState, consumeEnergy, consumeAction, rareDrop, rarityInfo, ensureMissions, recordMissionEvent, missionText, recommendedNextStep, maybeRandomEvent, levelUpText } = require('../lib/rpgFeatures');
const { CLASS_EQUIPMENT, DUNGEON_LOOT, MERCHANT_ITEMS, RPG_ITEMS } = require('../lib/rpgCatalog');
const { sendActionButtons } = require('../lib/interactiveActions');
const COIN = 'monedas de oro 🪙';
const MIN_BET = 200;
const INVESTMENT_DURATION = 5 * 60 * 1000;
const MIN_INVESTMENT = 500;
const MAX_INVESTMENT = 20000;
const TRANSFER_TAX_RATE = 0.05;
const MIN_TRANSFER_TAX = 25;
const PREMIUM_SHOP_PACKAGES = Object.freeze({
    '1': Object.freeze({ days: 1, price: 300000 }),
    '2': Object.freeze({ days: 2, price: 500000 }),
    '4': Object.freeze({ days: 4, price: 1000000 })
});
const ECONOMY_LIMITS = {
    transferCoins: 50000,
    transferCount: 10,
    duelStake: 20000,
    gamblingStake: 10000,
    sameRecipient: 8
};
const DAILY_ACTIVITY_LIMITS = Object.freeze({ work: 8, crime: 4, slut: 4, explore: 6, gather: 6, patrol: 2, mine: 20, fish: 15, hunt: 15 });
const CLAN_WAR_COOLDOWN = 6 * 60 * 60 * 1000;
const MAX_DUEL_STAKE = ECONOMY_LIMITS.duelStake;
const RPG_LEVEL_XP = level => Math.max(0, (level - 1) * (level - 1) * 100);
const MINING_REWARDS = [15, 25, 40, 60, 90, 130, 200];
const FISHING_REWARDS = [15, 25, 40, 55, 75, 110, 175];
const HUNTING_REWARDS = [20, 30, 50, 80, 110, 160, 240];
const DUNGEON_REWARDS = [150, 225, 300, 400, 550];
const EXPLORATION_REWARDS = [40, 75, 110, 150, 200];
const GATHERING_REWARDS = [30, 45, 65, 90, 125];
const CHARACTER_CLASSES = {
    guerrero: { label: '⚔️ Guerrero', description: 'Resistente y experto en combate cuerpo a cuerpo.', advantage: 'obtiene +25% de monedas en las misiones de .work.' },
    mago: { label: '🔮 Mago', description: 'Dominador de hechizos, sabiduría y poder arcano.', advantage: 'recibe +15% de monedas al completar trabajos mágicos.' },
    picaro: { label: '🗡️ Pícaro', description: 'Ágil, sigiloso y experto en golpes precisos.', advantage: 'obtiene +30% de botín en .crime y +10% en .work.' },
    tirador: { label: '🏹 Tirador', description: 'Especialista en ataques a distancia, puntería y cacería.', advantage: 'obtiene +30% de recompensa al .cazar y +15% en encargos.' },
    paladin: { label: '🛡️ Paladín', description: 'Defensor sagrado que protege al grupo y mantiene el frente.', advantage: 'obtiene +15% de monedas en las mazmorras y +10% en .work.' }
};
const ALIASES = {
    rpg: ['rpg', 'rpgmenu', 'economiarpg', 'economyrpg'],
    characterClass: ['clase', 'class', 'job'],
    balance: ['balance', 'bal', 'coins'],
    baltop: ['baltop', 'eboard', 'economytop'],
    coinflip: ['coinflip', 'cf', 'flip'],
    duel: ['duel', 'duelo', 'pvp', 'desafio', 'desafío'],
    raid: ['raid', 'raids', 'incursion', 'incursión', 'jefemundial'],
    combat: ['combat', 'combate', 'batalla', 'arena'],
    inventory: ['inventory', 'inventario', 'mochila', 'bolsaequipamiento'],
    craft: ['craft', 'fabricar', 'forjar'],
    quest: ['quest', 'campaña', 'campana', 'historia'],
    title: ['title', 'titulo', 'título', 'titulos', 'títulos'],
    market: ['market', 'mercado', 'mercadojugadores', 'subasta'],
    season: ['season', 'temporada', 'rankingtemporada'],
    skills: ['skills', 'habilidades', 'talentos'],
    potion: ['potion', 'pocion', 'poción', 'curar'],
    useItem: ['usar', 'use', 'consumir'],
    rpgstatus: ['rpgstatus', 'estadisticas', 'estadística', 'poder'],
    tutorial: ['tutorial', 'guia', 'guía', 'guiaaventura'],
    crime: ['crime'],
    daily: ['daily'],
    deposit: ['deposit', 'dep', 'd'],
    einfo: ['einfo', 'economyinfo', 'cooldowns'],
    pay: ['pay', 'transfer', 'give'],
    roulette: ['roulette', 'rt', 'ruleta', 'rtl'],
    reward: ['reward', 'regalo', 'premio'],
    level: ['level', 'nivel', 'xp', 'experiencia'],
    mine: ['mine', 'minar', 'mineria'],
    fish: ['fish', 'pescar', 'pesca'],
    hunt: ['hunt', 'cazar', 'caza'],
    merchant: ['mercader', 'comprar', 'buy'],
    repair: ['reparar', 'repair'],
    explore: ['explore', 'explorar', 'exploracion'],
    gather: ['gather', 'recolectar', 'recoleccion'],
    patrol: ['patrol', 'patrullar', 'patrulla'],
    dungeon: ['dungeon', 'mazmorra', 'mazmorras'],
    raid: ['raid', 'raids', 'incursion', 'incursiones'],
    mission: ['mission', 'mision', 'misiones'],
    achievements: ['achievement', 'achievements', 'logro', 'logros'],
    clan: ['clan', 'clanes'],
    coinTop: ['nekotop', 'nikutop', 'topcoins', 'coinstop', 'goldtop', 'orotop', 'toporo', 'riqueza'],
    slut: ['slut'],
    steal: ['steal', 'rob', 'robar'],
    withdraw: ['withdraw', 'with', 'retirar', 'wd'],
    work: ['work', 'w'],
    investment: ['invertir', 'inversion', 'inversión'],
    loan: ['prestamo', 'préstamo', 'loan'],
    premiumShop: ['tiendapremium', 'premiumshop', 'comprarpremium'],
    premiumStatus: ['premiumtiempo', 'premiumtime', 'tiempopremium'],
    itemInfo: ['objeto', 'item', 'iteminfo']
};
const PROFILE_RPG_COMMANDS = new Set(['registrarse', 'registrar', 'register', 'registro', 'profile', 'perfil', 'user', 'marry', 'casar', 'divorce', 'divorciar', 'history', 'historial', 'historialmatrimonial', 'marryhistory', 'pfp', 'getpfp', 'foto', 'avatar', 'setbio', 'setdescription', 'setdescperfil', 'setbirth', 'setcumple', 'setbirthday', 'setgenre', 'setgenero']);

const HELP = {
    balance: 'balance | bal', baltop: 'baltop [página]', coinflip: 'cf <cantidad>', crime: 'crime · encargo clandestino',
    daily: 'daily · recompensa del gremio', deposit: 'deposit <cantidad|all> · guardar en el cofre', einfo: 'einfo', pay: 'pay <cantidad> @usuario',
    roulette: 'rt <cantidad> <rojo|negro>', reward: 'regalo <token>', level: 'nivel', mine: 'minar', fish: 'pescar', hunt: 'cazar', merchant: 'mercader [comprar <nombre o ID>] · herramientas y equipo de clase', repair: 'reparar', explore: 'explorar', gather: 'recolectar', patrol: 'patrullar', dungeon: 'mazmorra', mission: 'misiones [nueva]', achievements: 'logros', clan: 'clan <crear|unirse|salir|info|guerra>', coinTop: 'nikutop', slut: 'slut', steal: 'rob @usuario', duel: 'duelo @usuario <apuesta> · aceptar · rechazar · cancelar',
    withdraw: 'with <cantidad|all> · sacar del cofre', work: 'work · misión del gremio', investment: 'invertir <cantidad> · inversión de 5 minutos', loan: 'prestamo <cantidad|estado|pagar> · préstamo RPG', characterClass: 'clase <guerrero|mago|picaro|tirador|paladin>', raid: 'raid <crear|unirse|atacar|estado>', combat: 'combate <iniciar|atacar|habilidad|defender|huir>', inventory: 'inventario', craft: 'fabricar [pocion|pocion_menor|pocion_mayor|elixir_energia]', quest: 'campaña [nueva|reclamar]', title: 'titulos', market: 'mercado <ver|publicar|comprar>', season: 'temporada', skills: 'habilidades', potion: 'pocion [ID]', useItem: 'usar <ID del consumible>', rpgstatus: 'estadisticas', premiumStatus: 'premiumtiempo [@jugador]', itemInfo: 'objeto [nombre o ID]'
};

function fmt(value) { return Number(value || 0).toLocaleString('es-ES'); }
function reply(sock, chatId, msg, text, extra = {}) {
    return sock.sendMessage(chatId, { text, ...extra }, { quoted: msg });
}
function commandReply(sock, chatId, msg, command, text, extra = {}) {
    return sendImageCaption(sock, chatId, msg, commandImagePath(command), text, extra);
}
function getSender(msg, chatId) {
    return msg?.key?.participantAlt || msg?.key?.senderPn || msg?.key?.participant || (msg?.key?.fromMe ? msg?.key?.remoteJid : chatId);
}
function normalizeJid(jid) {
    return String(jid || '').split(':')[0].replace(/[^0-9@.a-z_-]/gi, '');
}
function numberOf(jid) { return normalizeJid(jid).split('@')[0]; }
function premiumIdentityKeys(botData, jid) {
    const raw = normalizeJid(jid);
    const identities = new Set(raw ? [raw] : []);
    const number = numberOf(raw);
    const isLid = /@lid$/i.test(raw);
    for (const [phone, lid] of Object.entries(botData.phoneAliases || {})) {
        if (isLid && normalizeJid(lid).toLowerCase() === raw.toLowerCase()) identities.add(`${numberOf(phone)}@s.whatsapp.net`);
        else if (!isLid && numberOf(phone) === number && lid) identities.add(normalizeJid(lid));
    }
    return [...identities].filter(Boolean);
}
function sameIdentity(botData, left, right) {
    const a = numberOf(left); const b = numberOf(right);
    if (!a || !b) return false;
    if (a === b) return true;
    const aliases = botData?.phoneAliases || {};
    const linked = value => {
        const key = numberOf(value);
        const result = new Set([key]);
        for (const [phone, lid] of Object.entries(aliases)) {
            if (numberOf(phone) === key || numberOf(lid) === key) {
                result.add(numberOf(phone));
                result.add(numberOf(lid));
            }
        }
        for (const [profileKey, profile] of Object.entries(botData?.profiles || {})) {
            const profileIds = [numberOf(profileKey), numberOf(profile?.phoneNumber)].filter(Boolean);
            if (profileIds.includes(key)) for (const id of profileIds) result.add(id);
        }
        return result;
    };
    const leftIds = linked(left); const rightIds = linked(right);
    return [...leftIds].some(value => rightIds.has(value));
}
function syncClassToRegisteredProfile(botData, jid, user) {
    botData.profiles ||= {};
    botData.phoneAliases ||= {};
    const wanted = numberOf(jid);
    const identities = new Set([wanted]);
    const add = value => { const n = numberOf(value); if (n) identities.add(n); };
    for (const [phone, lid] of Object.entries(botData.phoneAliases)) {
        if (identities.has(numberOf(phone))) add(lid);
        if (identities.has(numberOf(lid))) add(phone);
    }
    let found = false;
    for (const [key, profile] of Object.entries(botData.profiles)) {
        const profileNumbers = [numberOf(key), numberOf(profile?.phoneNumber)].filter(Boolean);
        if (!profileNumbers.some(value => identities.has(value))) continue;
        profile.rpg ||= {};
        profile.rpg.class = user.rpg?.class || '';
        profile.rpg.level = Number(user.rpg?.level) || 1;
        profile.rpg.xp = Number(user.rpg?.xp) || 0;
        profile.classKey = profile.rpg.class;
        found = true;
    }
    return found;
}
function syncClassFromRegisteredProfile(botData, jid, user) {
    botData.profiles ||= {};
    botData.phoneAliases ||= {};
    user.rpg ||= {};
    const identities = new Set([numberOf(jid)]);
    const add = value => { const n = numberOf(value); if (n) identities.add(n); };
    for (const [phone, lid] of Object.entries(botData.phoneAliases)) {
        if (identities.has(numberOf(phone))) add(lid);
        if (identities.has(numberOf(lid))) add(phone);
    }
    const found = Object.entries(botData.profiles).find(([key, profile]) => [numberOf(key), numberOf(profile?.phoneNumber)].some(value => identities.has(value)));
    const profileClass = found?.[1]?.rpg?.class || found?.[1]?.rpg?.classKey || found?.[1]?.classKey;
    if (profileClass && CHARACTER_CLASSES[profileClass]) {
        user.rpg.class ||= profileClass;
        user.classKey ||= profileClass;
        if (!user.rpg.level && found[1].rpg?.level) user.rpg.level = Number(found[1].rpg.level) || 1;
        if (!user.rpg.xp && found[1].rpg?.xp) user.rpg.xp = Number(found[1].rpg.xp) || 0;
    }
    return user.rpg.class || user.classKey || '';
}
function getContext(msg) {
    const context = msg?.message?.extendedTextMessage?.contextInfo || {};
    return {
        mentioned: context.mentionedJid?.[0] || null,
        quoted: context.participant || context.quotedMessage?.key?.participant || context.quotedMessage?.key?.sender || null
    };
}
function ensureState(botData, chatId, sender) {
    botData.economy ||= {};
    botData.economy[chatId] ||= { users: {} };
    const state = botData.economy[chatId];
    state.users ||= {};
    state.raids ||= { active: null, history: [] };
    const rawJid = normalizeJid(sender);
    const jid = Object.keys(state.users).find(key => sameIdentity(botData, key, rawJid)) || rawJid;
    state.users[jid] ||= { coins: 0, bank: 0, lastSeen: 0 };
    const user = state.users[jid];
    user.coins = Math.max(0, Number(user.coins) || 0);
    user.bank = Math.max(0, Number(user.bank) || 0);
    user.lastSeen = Date.now();
    return { state, user, jid };
}
function findUser(state, jid, botData = {}) {
    const wanted = numberOf(jid);
    const key = Object.keys(state.users || {}).find(k => sameIdentity(botData, k, jid));
    return key ? { key, user: state.users[key] } : null;
}
function targetJidFromMessage(msg, q) {
    const context = getContext(msg);
    const raw = context.mentioned || context.quoted || (String(q || '').match(/@?\d{7,20}/)?.[0]);
    if (!raw) return null;
    const candidate = normalizeJid(String(raw).replace(/^@/, ''));
    const number = numberOf(candidate);
    if (!/^\d{7,20}$/.test(number)) return null;
    return candidate.includes('@') ? candidate : `${number}@s.whatsapp.net`;
}
function getTarget(msg, q, state, botData = {}) {
    const targetJid = targetJidFromMessage(msg, q);
    return targetJid ? findUser(state, targetJid, botData) : null;
}
function getDuelTarget(msg, q, state, botData = {}) {
    const targetJid = targetJidFromMessage(msg, q);
    if (!targetJid) return null;
    // Un jugador puede recibir un reto antes de usar la economía. Se conserva
    // el JID original (incluido @lid) y se reutiliza su cuenta si ya existe.
    return findUser(state, targetJid, botData) || { key: targetJid, user: null };
}
function cooldown(user, key, ms) {
    const remaining = Math.max(0, ms - (Date.now() - (Number(user[key]) || 0)));
    return remaining;
}
function timeLeft(ms) {
    const sec = Math.ceil(ms / 1000);
    if (sec < 60) return `${sec} segundos`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} minutos`;
    return `${Math.floor(min / 60)} horas ${min % 60} minutos`;
}
function random(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function classRewardMultiplier(user, activity) {
    const classKey = user.rpg?.class;
    const bonuses = {
        guerrero: { work: 1.25 },
        mago: { work: 1.15 },
        picaro: { work: 1.10, crime: 1.30 },
        tirador: { work: 1.15, crime: 1.15, hunt: 1.30 },
        paladin: { work: 1.10, dungeon: 1.15 }
    };
    return bonuses[classKey]?.[activity] || 1;
}
function classAdvantageText(user, activity) {
    const multiplier = classRewardMultiplier(user, activity);
    if (multiplier <= 1) return '';
    const percent = Math.round((multiplier - 1) * 100);
    return `\n🛡️ Ventaja de ${CHARACTER_CLASSES[user.rpg.class].label}: *+${percent}% de recompensa*`;
}
function classEquipment(user) { return CLASS_EQUIPMENT[user.rpg?.class] || []; }
function normalizeShopItem(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
function equipmentForUser(user, value) {
    const wanted = normalizeShopItem(value);
    return classEquipment(user).find(item => [item.id, item.name].some(alias => normalizeShopItem(alias) === wanted)) || null;
}
function activityText(activities = []) {
    const labels = { work: 'trabajo', dungeon: 'mazmorra', raid: 'raid', explore: 'exploración', crime: 'encargos', hunt: 'caza', gather: 'recolección', patrol: 'patrulla' };
    return activities.map(activity => labels[activity] || activity).join(', ');
}
function equipmentRewardMultiplier(user, activity) {
    const owned = user.equipment || {};
    return classEquipment(user).reduce((total, item) => total + (owned[item.id] && item.activities.includes(activity) ? item.bonus : 0), 1);
}
function equipmentAdvantageText(user, activity) {
    const percent = Math.round((equipmentRewardMultiplier(user, activity) - 1) * 100);
    return percent > 0 ? `\n⚔️ Equipamiento activo: *+${percent}% de recompensa*` : '';
}
function lootById(id) {
    const raw = String(id || '').toLowerCase();
    const [baseId, rarity] = raw.split(':');
    const item = DUNGEON_LOOT.find(entry => entry.id === baseId);
    if (!item) return null;
    const info = rarityInfo(rarity);
    return { ...item, id: raw, name: `${info.icon} ${info.label} ${item.name}`, sellPrice: Math.floor(item.sellPrice * info.multiplier) };
}
function addXp(user, amount = 5) {
    user.rpg ||= { xp: 0, level: 1, lastXp: 0 };
    const now = Date.now();
    if (now - (Number(user.rpg.lastXp) || 0) < 30000) return { gained: 0, levelUp: false };
    const before = Number(user.rpg.level) || 1;
    user.rpg.xp = Math.max(0, Number(user.rpg.xp) || 0) + Math.max(1, Math.floor(amount));
    user.rpg.level = Math.max(1, Math.floor(Math.sqrt(user.rpg.xp / 100)) + 1);
    user.rpg.lastXp = now;
    return { gained: amount, levelUp: user.rpg.level > before, level: user.rpg.level };
}
const ACHIEVEMENTS = [
    { id: 'first_steps', title: '🌱 Primeros pasos', test: s => s.commandsUsed >= 1, reward: 100 },
    { id: 'level_five', title: '⭐ Aventurero nivel 5', test: (s, u) => u.rpg.level >= 5, reward: 500 },
    { id: 'miner', title: '⛏️ Minero incansable', test: s => s.mined >= 10, reward: 250 },
    { id: 'angler', title: '🎣 Maestro pescador', test: s => s.fished >= 10, reward: 250 },
    { id: 'hunter', title: '🏹 Cazador experto', test: s => s.hunted >= 10, reward: 300 },
    { id: 'dungeon', title: '🏰 Explorador de mazmorras', test: s => s.dungeonKills >= 50, reward: 500 },
    { id: 'mission', title: '📜 Cumplidor de misiones', test: s => s.missionsCompleted >= 1, reward: 400 },
    { id: 'clan', title: '⚔️ Fundador de clan', test: s => s.clansCreated >= 1, reward: 400 },
    { id: 'raid_dragon_ancestral', title: '🐉 Caída del Dragón Ancestral', test: s => Number(s.raidBosses?.dragon_ancestral) >= 1, reward: 1500 },
    { id: 'raid_titan_abismal', title: '🗿 El Titán se arrodilla', test: s => Number(s.raidBosses?.titan_abismal) >= 1, reward: 2000 },
    { id: 'raid_reina_nigromante', title: '👑 Silencio de la Reina Nigromante', test: s => Number(s.raidBosses?.reina_nigromante) >= 1, reward: 1800 },
    { id: 'dungeon_veteran_100', title: '🏰 Leyenda de las profundidades', test: s => s.dungeonKills >= 100, reward: 1000 },
    { id: 'treasure_hunter', title: '📦 Saqueador de mazmorras', test: s => s.dungeonDrops >= 10, reward: 600 },
    { id: 'rare_hunter', title: '🔷 Coleccionista de rarezas', test: s => s.rareDungeonDrops >= 5, reward: 750 },
    { id: 'legendary_hunter', title: '🌟 Reliquia legendaria', test: s => s.legendaryDungeonDrops >= 1, reward: 1200 },
    { id: 'dungeon_gear', title: '⚔️ Reliquia del aventurero', test: s => s.dungeonGearDrops >= 1, reward: 1000 },
    { id: 'armorer', title: '🛡️ Arsenal de élite', test: s => s.gearBought >= 4, reward: 700 }
];
function unlockAchievements(user) {
    user.rpg ||= { xp: 0, level: 1, lastXp: 0 };
    user.rpg.stats ||= {};
    user.rpg.achievements ||= {};
    const unlocked = [];
    for (const achievement of ACHIEVEMENTS) {
        if (!user.rpg.achievements[achievement.id] && achievement.test(user.rpg.stats, user)) {
            user.rpg.achievements[achievement.id] = { unlockedAt: new Date().toISOString(), reward: achievement.reward };
            user.coins = (Number(user.coins) || 0) + achievement.reward;
            unlocked.push(`🏆 ${achievement.title} (+${fmt(achievement.reward)} monedas de oro)`);
        }
    }
    return unlocked;
}
function addStat(user, key, amount = 1) {
    user.rpg ||= { xp: 0, level: 1, lastXp: 0 };
    user.rpg.stats ||= {};
    user.rpg.stats[key] = (Number(user.rpg.stats[key]) || 0) + amount;
    return unlockAchievements(user);
}
function achievementText(unlocked) { return unlocked?.length ? `\n\n${unlocked.join('\n')}` : ''; }
function levelBar(user) {
    user.rpg ||= { xp: 0, level: 1, lastXp: 0 };
    const level = Math.max(1, Number(user.rpg.level) || 1);
    const current = Math.max(0, Number(user.rpg.xp) || 0) - RPG_LEVEL_XP(level);
    const need = Math.max(100, RPG_LEVEL_XP(level + 1) - RPG_LEVEL_XP(level));
    const filled = Math.min(10, Math.floor((current / need) * 10));
    return `${'▰'.repeat(filled)}${'▱'.repeat(10 - filled)} ${Math.max(0, current)}/${need} XP`;
}
function clanKey(name) { return String(name || '').trim().toLowerCase().replace(/[^a-z0-9áéíóúüñ_-]/gi, '').slice(0, 20); }
function findClan(clans, name) { const key = clanKey(name); return key ? clans[key] : null; }
function getUserClan(clans, jid) { return Object.values(clans || {}).find(clan => clan.members?.includes(jid)); }
function clanList(clans) { return Object.values(clans || {}).sort((a, b) => (b.members?.length || 0) - (a.members?.length || 0)); }
function clanLevel(clan) { return Math.max(1, Math.floor(Math.sqrt((Number(clan?.xp) || 0) / 100)) + 1); }
function clanPower(clan) { return (clan.members?.length || 0) * 100 + (Number(clan.xp) || 0) + (Number(clan.wins) || 0) * 250 + Math.floor(Math.random() * 101); }
function clanWarList(wars) { return Object.values(wars || {}).filter(war => ['pending', 'accepted'].includes(war.status)); }
function toolFor(value) {
    const wanted = normalizeShopItem(value);
    return Object.entries(MERCHANT_ITEMS).find(([id, item]) => [id, item.name, ...(item.aliases || [])].some(alias => normalizeShopItem(alias) === wanted))?.[0] || null;
}
function consumableFor(value) {
    const wanted = normalizeShopItem(value);
    return Object.entries(RPG_ITEMS).find(([id, item]) => item.type === 'consumible' && [id, item.name, ...(item.aliases || [])].some(alias => normalizeShopItem(alias) === wanted))?.[0] || null;
}
function merchantShopText(user, prefix = '.') {
    const tools = Object.entries(MERCHANT_ITEMS).map(([id, item]) => {
        const current = user.tools?.[id];
        const durability = current?.durability > 0 ? ` · ${current.durability}/${item.durability} tuyos` : '';
        return `• ${item.name} (\`${id}\`) · ${fmt(item.price)} oro · ${item.durability} usos${durability}`;
    });
    const gear = classEquipment(user).map(item => `• ${item.name} (\`${item.id}\`) · ${fmt(item.price)} oro · +${Math.round(item.bonus * 100)}%`);
    const consumables = Object.entries(RPG_ITEMS).filter(([, item]) => item.type === 'consumible').map(([id, item]) => `• ${item.name} (\`${id}\`) · ${fmt(item.price)} oro`);
    const classLabel = CHARACTER_CLASSES[user.rpg?.class]?.label || 'tu clase';
    return [
        '🧑‍🌾 *MERCADER RPG*',
        '🛠️ *HERRAMIENTAS*',
        ...tools,
        '🧪 *CONSUMIBLES*',
        ...consumables,
        `⚔️ *EQUIPO DE ${classLabel.toUpperCase()}*`,
        ...(gear.length ? gear : [`• Elige una clase con *${prefix}clase* para ver su equipo exclusivo.`]),
        `🛒 *${prefix}comprar <nombre o ID>* · Ej.: *${prefix}comprar pico*`,
        `📦 *${prefix}mercader vender* · 🏪 *${prefix}mercado ver/publicar/comprar*`,
        `🔎 Efectos: *${prefix}objeto <ID>* · recetas: *${prefix}fabricar*`
    ].join('\n');
}
async function sendMerchantQuickActions(sock, chatId, msg, user, prefix, quoted) {
    const tools = Object.entries(MERCHANT_ITEMS).map(([id, item]) => ({ label: `Comprar ${item.name.replace(/^[^\p{L}\p{N}]+/u, '')}`, command: `${prefix}comprar ${id}` }));
    await sendActionButtons(sock, chatId, '🛠️ Compra rápida de herramientas:', tools, quoted || msg);
    const consumables = Object.entries(RPG_ITEMS).filter(([, item]) => item.type === 'consumible');
    for (let index = 0; index < consumables.length; index += 3) {
        await sendActionButtons(sock, chatId, '🧪 Compra rápida de consumibles:', consumables.slice(index, index + 3).map(([id, item]) => ({ label: `🧪 ${item.name.replace(/^[^\p{L}\p{N}]+/u, '')} · ${fmt(item.price)}`, command: `${prefix}comprar ${id}` })), quoted || msg);
    }
    const categoryButtons = classEquipment(user).length
        ? [
            { label: '⚔️ Ver equipo', command: `${prefix}mercader equipo` },
            { label: '🎒 Inventario', command: `${prefix}inventario` },
            { label: '🏪 Mercado', command: `${prefix}mercado` }
        ]
        : [
            { label: '🧙 Elegir clase', command: `${prefix}clase` },
            { label: '🎒 Inventario', command: `${prefix}inventario` },
            { label: '🏪 Mercado', command: `${prefix}mercado` }
        ];
    await sendActionButtons(sock, chatId, '⚔️ Equipo y otras opciones:', categoryButtons, quoted || msg);
}
async function sendMerchantGearPage(sock, chatId, msg, user, prefix, page = 1) {
    const gear = classEquipment(user);
    if (!gear.length) return reply(sock, chatId, msg, `🔒 Primero elige una clase con *${prefix}clase*. Después podrás abrir *${prefix}mercader equipo* para comprar su equipamiento exclusivo.`);
    const pageSize = 2;
    const pageCount = Math.ceil(gear.length / pageSize);
    const currentPage = Math.max(1, Math.min(pageCount, Number(page) || 1));
    const items = gear.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const body = `⚔️ *EQUIPO DE ${CHARACTER_CLASSES[user.rpg?.class]?.label || 'TU CLASE'}* · Página ${currentPage}/${pageCount}\n\n${items.map(item => `• *${item.name}* (\`${item.id}\`)\n  ${fmt(item.price)} ${COIN} · +${Math.round(item.bonus * 100)}% en ${activityText(item.activities)}`).join('\n\n')}\n\nAl pulsar comprar, se cobrará el oro y el equipo quedará activo. También puedes usar *${prefix}comprar <ID>*.`;
    const buttons = items.map(item => ({ label: `🛡️ Comprar ${item.id}`, command: `${prefix}comprar ${item.id}` }));
    if (currentPage < pageCount) buttons.push({ label: '➡️ Más equipo', command: `${prefix}mercader equipo ${currentPage + 1}` });
    else if (currentPage > 1) buttons.push({ label: '⬅️ Equipo anterior', command: `${prefix}mercader equipo ${currentPage - 1}` });
    const sent = await sendImageCaption(sock, chatId, msg, shopImagePath(), body);
    await sendActionButtons(sock, chatId, 'Elige una pieza para comprar y equipar:', buttons, sent || msg);
    return sent;
}
function investmentQuickAmounts(balance) {
    const available = Math.min(MAX_INVESTMENT, Math.floor(Number(balance) || 0));
    return [...new Set([MIN_INVESTMENT, Math.floor(available / 4), Math.floor(available / 2)])]
        .filter(value => value >= MIN_INVESTMENT && value <= available);
}
async function sendClassChoiceButtons(sock, chatId, msg, prefix, quoted) {
    const choices = Object.entries(CHARACTER_CLASSES).map(([key, value]) => ({ label: value.label, command: `${prefix}clase ${key}` }));
    const groups = [choices.slice(0, 3), choices.slice(3, 6)];
    for (let index = 0; index < groups.length; index++) {
        const group = groups[index];
        if (!group.length) continue;
        await sendActionButtons(sock, chatId, index === 0 ? '🧭 Toca una clase para elegir tu camino:' : '🧭 Otras clases disponibles:', group, quoted || msg);
    }
}
function toolState(user, key) {
    user.tools ||= {};
    const item = MERCHANT_ITEMS[key];
    const tool = user.tools[key];
    return tool && Number(tool.durability) > 0 ? tool : null;
}
function consumeTool(user, key) {
    const tool = toolState(user, key);
    if (!tool) return { ok: false, broken: false };
    tool.durability = Math.max(0, Number(tool.durability) - 1);
    const broken = tool.durability === 0;
    return { ok: true, broken, durability: tool.durability };
}
function dayKey() { return new Date().toISOString().slice(0, 10); }
function ensureDungeonState(user) {
    user.dungeon ||= { day: dayKey(), runs: 0, integrity: 100 };
    if (user.dungeon.day !== dayKey()) user.dungeon = { day: dayKey(), runs: 0 };
    if (!Number.isFinite(Number(user.dungeon.integrity))) user.dungeon.integrity = 100;
    user.dungeon.integrity = Math.max(0, Math.min(100, Number(user.dungeon.integrity)));
    return user.dungeon;
}
function ensureMission(user, forceNew = false) {
    if (forceNew || !user.mission || user.mission.completed) {
        const target = 15 + Math.floor(Math.random() * 6);
        user.mission = { type: 'dungeon', target, progress: 0, reward: 1500 + Math.floor(Math.random() * 1001), createdAt: new Date().toISOString(), completed: false };
    }
    return user.mission;
}
async function animate(sock, chatId, msg, frames) {
    let sent = await reply(sock, chatId, msg, frames[0]);
    for (const frame of frames.slice(1)) {
        await new Promise(resolve => setTimeout(resolve, 650));
        try { sent = await sock.sendMessage(chatId, { text: frame, edit: sent.key }); } catch (e) { /* Compatibilidad */ }
    }
    return sent;
}
const JOB_MESSAGES = {
    work: {
        gain: ['Completaste una misión del gremio y recibiste', 'Escoltaste una caravana por el bosque y ganaste', 'Forjaste equipo en la herrería y cobraste', 'Ayudaste al posadero y recibiste', 'Reparaste las murallas de la aldea y ganaste', 'Entregaste un pergamino urgente y juntaste'],
        loss: ['La misión del gremio fracasó y perdiste', 'Una criatura emboscó la caravana y perdiste', 'La herrería explotó y pagaste', 'El posadero descontó los daños y perdiste', 'Te perdiste en el bosque y perdiste', 'Un duende te cobró peaje y perdiste']
    },
    crime: {
        gain: ['Asaltaste el tesoro de un mercader oscuro y escapaste con', 'Infiltraste la torre del hechicero y encontraste', 'Venciste a los guardias del castillo y tomaste', 'Robaste un cofre del gremio rival y ganaste', 'Engañaste a un dragón y saliste con', 'Completaste un encargo de la hermandad y recibiste'],
        loss: ['Los guardias del reino te atraparon y pagaste', 'El hechicero activó una trampa y perdiste', 'El gremio rival te descubrió y te quitó', 'Un dragón incendió tu botín y perdiste', 'La misión clandestina salió mal y perdiste', 'El juez del reino te impuso una multa de']
    },
    slut: {
        gain: ['Actuaste en la taberna del gremio y recibiste', 'Animaste la fiesta de la aldea y ganaste', 'Cantaste una balada de héroes y juntaste', 'Diste un espectáculo de trovador y cobraste', 'Conseguiste una generosa propina en la plaza y recibiste'],
        loss: ['El público abucheó tu actuación y perdiste', 'El bardo rival te robó la propina y perdiste', 'La taberna canceló el espectáculo y perdiste', 'Tu disfraz de aventurero se rompió y perdiste', 'El posadero cobró los daños del show y perdiste']
    }
};
function randomJob(user, command, outcome) {
    user.jobHistory ||= {};
    const key = `${command}:${outcome}`;
    const history = user.jobHistory[key] || [];
    const candidates = JOB_MESSAGES[command][outcome].filter(text => !history.includes(text));
    const phrase = random(candidates.length ? candidates : JOB_MESSAGES[command][outcome]);
    user.jobHistory[key] = [...history, phrase].slice(-10);
    return phrase;
}
function amount(value) {
    const input = String(value || '').toLowerCase().trim();
    if (!input) return null;
    if (input === 'all' || input === 'todo') return 'all';
    const clean = input.replace(/[^0-9]/g, '');
    const parsed = Number(clean);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
function premiumRemaining(ms) {
    let minutes = Math.max(1, Math.ceil(ms / 60000));
    const days = Math.floor(minutes / 1440); minutes %= 1440;
    const hours = Math.floor(minutes / 60); minutes %= 60;
    const parts = [];
    if (days) parts.push(`${days} día${days === 1 ? '' : 's'}`);
    if (hours) parts.push(`${hours} hora${hours === 1 ? '' : 's'}`);
    if (minutes || !parts.length) parts.push(`${minutes} minuto${minutes === 1 ? '' : 's'}`);
    return parts.join(' y ');
}
function premiumStatusCommand(sock, chatId, msg, q, botData, sender, prefix) {
    const requested = targetJidFromMessage(msg, q);
    if (String(q || '').trim() && !requested) return reply(sock, chatId, msg, `ℹ️ Usa *${prefix}premiumtiempo* para consultar tu cuenta, o menciona/responde al jugador: *${prefix}premiumtiempo @jugador*.`);
    const target = requested || normalizeJid(sender);
    const keys = premiumIdentityKeys(botData, target);
    const store = botData.premiumUsers && !Array.isArray(botData.premiumUsers) ? botData.premiumUsers : {};
    const entries = keys.map(key => store[key]).filter(entry => entry !== undefined && entry !== null);
    const viewerKeys = premiumIdentityKeys(botData, sender);
    const sameAccount = keys.some(key => viewerKeys.includes(key));
    const label = sameAccount ? 'Tu cuenta' : `Jugador ··${numberOf(target).slice(-4) || '????'}`;
    if (entries.some(entry => entry === true || (entry && typeof entry === 'object' && !entry.expiresAt))) {
        return reply(sock, chatId, msg, `╭━━〔 👑 PREMIUM PERMANENTE 〕━━╮\n│ Cuenta: *${label}*\n│ Estado: *ACTIVO · sin vencimiento*\n╰━━━━━━━━━━━━━━━━━━━━━━╯`);
    }
    const expiries = entries.map(entry => new Date(entry?.expiresAt).getTime()).filter(Number.isFinite);
    const activeExpiry = Math.max(0, ...expiries.filter(expiry => expiry > Date.now()));
    if (activeExpiry) {
        const remaining = premiumRemaining(activeExpiry - Date.now());
        const date = new Date(activeExpiry).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
        return reply(sock, chatId, msg, `╭━━〔 👑 ESTADO PREMIUM 〕━━╮\n│ Cuenta: *${label}*\n│ Estado: *ACTIVO*\n│ Tiempo restante: *${remaining}*\n│ Vence: *${date}*\n╰━━━━━━━━━━━━━━━━━━━━━━╯`);
    }
    const lastExpiry = Math.max(0, ...expiries);
    const expiredText = lastExpiry ? `\n│ Venció: *${new Date(lastExpiry).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}*` : '';
    return reply(sock, chatId, msg, `╭━━〔 👑 ESTADO PREMIUM 〕━━╮\n│ Cuenta: *${label}*\n│ Estado: *SIN PREMIUM ACTIVO*${expiredText}\n╰━━━━━━━━━━━━━━━━━━━━━━╯\n\nConsulta los pases con *${prefix}tiendapremium*.`);
}
function premiumShopText(prefix = '.') {
    const styles = {
        '1': { icon: '🥉', title: 'PASE INICIAL' },
        '2': { icon: '🥈', title: 'PASE DE AVENTURERO' },
        '4': { icon: '👑', title: 'PASE DE ÉLITE' }
    };
    const packages = Object.entries(PREMIUM_SHOP_PACKAGES).map(([id, offer]) => {
        const style = styles[id];
        const duration = offer.days * 24;
        return `╭━━〔 ${style.icon} *${style.title}* 〕━━╮\n│ ⏳ *${offer.days} día${offer.days === 1 ? '' : 's'}* · ${duration} horas\n│ 🪙 Precio: *${fmt(offer.price)} de oro*\n│ 🛒 Comprar: *${prefix}comprarpremium ${id}*\n╰━━━━━━━━━━━━━━━━━━╯`;
    }).join('\n\n');
    return `╭━━━〔 👑 *NIKU MD · PREMIUM* 〕━━━╮\n│\n│ ✨ *Tu aventura, a otro nivel*\n│ Desbloquea las funciones Premium\n│ con el oro que ganaste jugando.\n│\n╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n📜 *ELIGE TU PASE*\n\n${packages}\n\n💎 *¿Ya tienes Premium?*\nLos días comprados se añaden a tu vencimiento actual.\nConsulta el tiempo restante con *${prefix}premiumtiempo [@jugador]*.\n\n💰 Se cobra solo de las monedas de tu *bolsa*; revisarás el precio antes de cada compra.\n\nEscribe el comando del pase que quieras para activarlo.`;
}
function duelStakeFromArgs(args, target) {
    const raw = String(args?.[args.length - 1] || '').trim();
    if (!raw || /^@/.test(raw)) return null;
    const digits = numberOf(target?.key);
    if (target && /^\d{7,20}$/.test(raw.replace(/^@/, '')) && raw.replace(/^@/, '') === digits) return null;
    if (!/^\d+$/.test(raw)) return null;
    const stake = Number(raw);
    return Number.isSafeInteger(stake) && stake > 0 ? stake : null;
}
function dailyGuard(user) {
    const today = new Date().toISOString().slice(0, 10);
    user.economyGuard ||= { day: today, transferCoins: 0, transferCount: 0, duelStake: 0, gamblingStake: 0, recipients: {} };
    if (user.economyGuard.day !== today) user.economyGuard = { day: today, transferCoins: 0, transferCount: 0, duelStake: 0, gamblingStake: 0, recipients: {} };
    user.economyGuard.recipients ||= {};
    return user.economyGuard;
}
function economyAlert(botData, type, jid, details = {}) {
    botData.economyAbuseAlerts ||= [];
    botData.economyStats ||= { transferTaxes: 0, transferCount: 0 };
    botData.economyStats.abuseBlocked = (Number(botData.economyStats.abuseBlocked) || 0) + 1;
    botData.economyAbuseAlerts.unshift({ id: `eco-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, jid, details, createdAt: new Date().toISOString() });
    if (botData.economyAbuseAlerts.length > 300) botData.economyAbuseAlerts.length = 300;
}
function consumeDailyLimit(botData, user, jid, field, amountValue, limit, type, details = {}) {
    const guard = dailyGuard(user);
    const current = Number(guard[field]) || 0;
    if (current + amountValue > limit) {
        economyAlert(botData, type, jid, { ...details, attempted: amountValue, used: current, limit });
        return false;
    }
    guard[field] = current + amountValue;
    return true;
}
function menu(prefix = '.') {
    return `╭───〔 ⚔️ ECONOMÍA RPG 〕───╮\n│\n│ 🧙 ${prefix}perfil · Ficha del aventurero\n│ 📝 ${prefix}registrarse nombre · Crear personaje\n│ 🖼️ ${prefix}pfp · Foto de perfil\n│ ✍️ ${prefix}setbio · Descripción del perfil\n│ 🎂 ${prefix}setbirth · Cumpleaños\n│ ⚧️ ${prefix}setgenre · Género\n│ 💍 ${prefix}marry · Forjar vínculo\n│ 💔 ${prefix}divorce · Divorciarse\n│ 📜 ${prefix}historial · Historial matrimonial\n│ 💰 ${prefix}balance · Bolsa del aventurero\n│ 🏆 ${prefix}baltop · Ranking de aventureros\n│ 🌍 ${prefix}nekotop · Top global de monedas de oro\n│ ⭐ ${prefix}nivel · Ver XP y nivel\n│ 📊 ${prefix}estadisticas · Estadísticas RPG\n│ ⚔️ ${prefix}combate · Luchar contra enemigos\n│ 🐉 ${prefix}raid · Raid cooperativa contra jefes\n│ 🎒 ${prefix}inventario · Ver mochila y equipo\n│ ✨ ${prefix}habilidades · Habilidades de clase\n│ 🔨 ${prefix}fabricar · Crear objetos\n│ 📜 ${prefix}campaña · Misiones de historia\n│ 🛒 ${prefix}mercado · Mercado entre jugadores\n│ 🏛️ ${prefix}subastas · Casa de subastas RPG\n│ 🏷️ ${prefix}titulos · Títulos del aventurero\n│ 🏆 ${prefix}temporada · Ranking de temporada\n│ 🏆 ${prefix}logros · Ver logros\n│ 🧑‍🌾 ${prefix}mercader · Comprar herramientas\n│ 👑 ${prefix}tiendapremium · Comprar Premium con oro\n│ ⏱️ ${prefix}premiumtiempo · Consultar vencimiento\n│ 🖼️ ${prefix}objeto · Fotos y fichas de objetos\n│ 🧭 ${prefix}explorar · Explorar regiones\n│ 🌿 ${prefix}recolectar · Recolectar recursos\n│ 🛡️ ${prefix}patrullar · Patrullar el clan\n│ ⛏️ ${prefix}minar · Minería RPG\n│ 🎣 ${prefix}pescar · Pesca RPG\n│ 🏹 ${prefix}cazar · Caza RPG\n│ 🏰 ${prefix}mazmorra · Mazmorra diaria\n│ 🔧 ${prefix}reparar · Reparar mazmorra\n│ 📜 ${prefix}misiones · Ver misión\n│ ⚔️ ${prefix}clan · Clanes y guerras\n│ 🎁 ${prefix}daily · Recompensa del gremio\n│ 💼 ${prefix}work · Misión del gremio\n│ 🏦 ${prefix}deposit · Guardar en el cofre\n│ 💳 ${prefix}withdraw · Sacar del cofre\n│ 🏦 ${prefix}prestamo · Préstamo RPG\n│ 💸 ${prefix}pay · Entregar monedas\n│ 📈 ${prefix}invertir · Inversión de 5 minutos\n│ 🎰 ${prefix}coinflip · Fortuna de la taberna\n│ 🎡 ${prefix}roulette · Ruleta del reino\n│ 🕵️ ${prefix}crime · Encargo clandestino\n│ 🦹 ${prefix}rob · Golpe de pícaro\n│ 🎭 ${prefix}slut · Actuación del trovador\n│ 🧪 ${prefix}pocion · Curar al aventurero\n│ 🎁 ${prefix}premio · Reclamar regalo\n│ ⏱️ ${prefix}einfo · Tiempos de aventura\n│\n╰────────────────────────╯`;
}
function tutorialText(user, prefix = '.') {
    const mission = user.rpg?.welcomeMission;
    const missionLine = mission
        ? `${mission.claimed ? '✅' : '📍'} ${mission.title}: *${Math.min(Number(mission.progress) || 0, Number(mission.target) || 1)}/${mission.target}*${mission.claimed ? ' — completada' : `\n   ${mission.objective}`}`
        : '📍 Misión de bienvenida: elige una clase para activarla.';
    return `🧭 *TUTORIAL DEL AVENTURERO*\n\n1️⃣ *Completa tu personaje*\nUsa *${prefix}perfil* y elige tu clase con *${prefix}clase*.\n\n2️⃣ *Haz tu primer combate*\nUsa *${prefix}combate iniciar* y después *${prefix}combate atacar*.\n\n3️⃣ *Revisa tu progreso*\nConsulta *${prefix}nivel*, *${prefix}inventario* y *${prefix}logros*.\n\n4️⃣ *Explora el reino*\nPrueba *${prefix}misiones*, *${prefix}raid* y *${prefix}mercado*.\n\n🎯 *MISIÓN DE BIENVENIDA*\n${missionLine}\n🎁 Recompensa: *500 monedas de oro + 40 XP*\n\n${recommendedNextStep(user, prefix)}\n\nEscribe *${prefix}tutorial* cuando necesites volver a esta guía.`;
}

const investmentTimers = new Map();
function investmentForUser(botData, chatId, jid) {
    return Object.values(botData.investments || {}).find(item => item.status === 'pending' && item.chatId === chatId && numberOf(item.jid) === numberOf(jid));
}
function clearInvestmentTimer(id) {
    const timers = investmentTimers.get(id) || [];
    timers.forEach(timer => clearTimeout(timer));
    investmentTimers.delete(id);
}
async function sendInvestmentMessage(sock, investment, text, messageRef = null) {
    try {
        if (messageRef?.key) return await sock.sendMessage(investment.chatId, { text, edit: messageRef.key });
        return await sock.sendMessage(investment.chatId, { text });
    } catch (error) {
        try { return await sock.sendMessage(investment.chatId, { text }); } catch (ignored) { return messageRef; }
    }
}
async function resolveInvestment(sock, investment, botData, saveBotData, messageRef = null) {
    if (!investment || investment.status !== 'pending') return;
    clearInvestmentTimer(investment.id);
    const state = botData.economy?.[investment.chatId];
    const found = state ? findUser(state, investment.jid) : null;
    const wallet = found?.user;
    const stake = Math.max(0, Number(investment.amount) || 0);
    const won = Math.random() < 0.5;
    const profit = won ? Math.floor(stake * 0.5) : 0;
    if (wallet && won) wallet.coins = Math.max(0, Number(wallet.coins) || 0) + stake + profit;
    investment.status = won ? 'won' : 'lost';
    investment.result = won ? profit : -stake;
    investment.returned = won ? stake + profit : 0;
    investment.resolvedAt = new Date().toISOString();
    saveBotData();
    const text = won
        ? `✅ *INVERSIÓN COMPLETADA*\n\n📈 Resultado: *GANANDO DINERO*\n🪙 Inversión devuelta: *${fmt(stake)} ${COIN}*\n💰 Ganancia: *+${fmt(profit)} ${COIN}*\n💼 Saldo actual: *${fmt(wallet?.coins || 0)} ${COIN}*`
        : `📉 *INVERSIÓN COMPLETADA*\n\n💸 Resultado: *PERDIENDO*\n🪙 Perdiste: *${fmt(stake)} ${COIN}*\n💼 Saldo actual: *${fmt(wallet?.coins || 0)} ${COIN}*`;
    await sendInvestmentMessage(sock, investment, text, messageRef);
}
function scheduleInvestment(sock, investment, botData, saveBotData, messageRef = null) {
    if (!investment || investment.status !== 'pending' || investmentTimers.has(investment.id)) return;
    const remaining = Math.max(0, Number(investment.resolvesAt) - Date.now());
    const frames = [
        [60e3, '📈 *INVERSIÓN EN CURSO*\n\n💹 El mercado está *GANANDO DINERO*...\n⏳ Faltan aproximadamente 4 minutos.'],
        [120e3, '📉 *INVERSIÓN EN CURSO*\n\n⚠️ El mercado está *PERDIENDO*...\n⏳ La operación todavía puede recuperarse.'],
        [180e3, '📈 *INVERSIÓN EN CURSO*\n\n💰 Las cotizaciones están *GANANDO* fuerza...\n⏳ Falta aproximadamente 2 minutos.'],
        [240e3, '📊 *INVERSIÓN EN CURSO*\n\n🔄 Última revisión del mercado...\n⏳ El resultado llegará en aproximadamente 1 minuto.']
    ];
    let currentMessage = messageRef;
    const timers = [];
    for (const [offset, text] of frames) {
        const delay = Math.max(0, remaining - (INVESTMENT_DURATION - offset));
        timers.push(setTimeout(async () => { currentMessage = await sendInvestmentMessage(sock, investment, text, currentMessage); }, delay));
    }
    timers.push(setTimeout(() => resolveInvestment(sock, investment, botData, saveBotData, currentMessage), remaining));
    investmentTimers.set(investment.id, timers);
}
async function resumeInvestmentsForChat(sock, chatId, botData, saveBotData) {
    botData.investments ||= {};
    const pending = Object.values(botData.investments).filter(item => item.status === 'pending' && item.chatId === chatId);
    for (const investment of pending) {
        if (Number(investment.resolvesAt) <= Date.now()) await resolveInvestment(sock, investment, botData, saveBotData);
        else scheduleInvestment(sock, investment, botData, saveBotData);
    }
}

async function runEconomy(sock, chatId, msg, command, q = '', botData, saveBotData, prefix = '.') {
    if (command === 'economy' || command === 'economymenu' || command === 'rpg' || command === 'rpgmenu' || command === 'economiarpg' || command === 'economyrpg') return reply(sock, chatId, msg, `${menu(prefix)}\n\n🛒 Compra al mercader con *${prefix}comprar <nombre o ID>*; abre *${prefix}mercader* para ver el catálogo.`);
    if (PROFILE_RPG_COMMANDS.has(String(command || '').toLowerCase())) return profileCommand(sock, chatId, msg, command, q, botData, saveBotData, prefix);
    const canonical = Object.keys(ALIASES).find(key => ALIASES[key].includes(command)) || command;
    if (!ALIASES[canonical]) return reply(sock, chatId, msg, menu(prefix));
    if (canonical === 'itemInfo') return showItemDetails(sock, chatId, msg, q, prefix);
    if (canonical === 'premiumStatus') return premiumStatusCommand(sock, chatId, msg, q, botData, getSender(msg, chatId), prefix);
    const sender = getSender(msg, chatId);
    const { state, user, jid } = ensureState(botData, chatId, sender);
    syncClassFromRegisteredProfile(botData, jid, user);
    ensureRpg(user);
    ensureFeatureState(user);
    const args = String(q || '').trim().split(/\s+/).filter(Boolean);
    const save = () => saveBotData();
    const grantActivityProgress = (activity, xpAmount = 5, triggerEvent = true) => {
        const achievements = addStat(user, 'commandsUsed', 1);
        const xpEvent = addXp(user, xpAmount);
        const completedMissions = recordMissionEvent(user, activity, 1);
        completedMissions.forEach(mission => addXp(user, mission.xp));
        const randomEvent = triggerEvent ? maybeRandomEvent(user) : null;
        const eventXp = randomEvent ? addXp(user, randomEvent.xp) : null;
        const lines = [];
        if (xpEvent.gained) lines.push(`✨ +${xpEvent.gained} XP${levelUpText(xpEvent)}`);
        for (const mission of completedMissions) lines.push(`📜 Misión completada: *${mission.title}* · +${fmt(mission.reward)} ${COIN}`);
        if (randomEvent) lines.push(`${randomEvent.title} · +${fmt(randomEvent.coins)} ${COIN}${eventXp?.gained ? ` · +${fmt(eventXp.gained)} XP` : ''}`);
        if (achievements.length) lines.push(...achievements);
        return { xpEvent, extraText: lines.length ? `\n\n${lines.join('\n')}` : '' };
    };
    const withRpgActions = async (sent, buttons, prompt = '⚔️ Continúa tu aventura:') => {
        await sendActionButtons(sock, chatId, prompt, buttons, sent || msg);
        return sent;
    };
    if (canonical === 'premiumShop') {
        const buyAlias = String(command || '').toLowerCase() === 'comprarpremium';
        const action = String(args[0] || '').toLowerCase();
        const requestedPackage = buyAlias ? args[0] : (['comprar', 'buy'].includes(action) ? args[1] : '');
        if (!requestedPackage) return sendImageCaption(sock, chatId, msg, shopImagePath(), premiumShopText(prefix));
        const offer = PREMIUM_SHOP_PACKAGES[String(requestedPackage)];
        if (!offer) return sendImageCaption(sock, chatId, msg, shopImagePath(), `❌ *Ese pase no existe.* Elige 1, 2 o 4 días.\n\n${premiumShopText(prefix)}`);

        botData.premiumUsers ||= {};
        if (Array.isArray(botData.premiumUsers) || typeof botData.premiumUsers !== 'object') botData.premiumUsers = {};
        const identityKeys = premiumIdentityKeys(botData, jid);
        const currentEntries = identityKeys.map(key => [key, botData.premiumUsers[key]]).filter(([, entry]) => entry !== undefined && entry !== null);
        const hasPermanentPremium = currentEntries.some(([, entry]) => entry === true || (entry && typeof entry === 'object' && !entry.expiresAt));
        if (hasPermanentPremium) return reply(sock, chatId, msg, '╭━━〔 👑 PREMIUM PERMANENTE 〕━━╮\n│ Tu cuenta ya tiene acceso Premium sin vencimiento.\n│ No se descontaron monedas.\n╰━━━━━━━━━━━━━━━━━━━━╯');

        const now = Date.now();
        const activeExpiries = currentEntries.map(([, entry]) => new Date(entry?.expiresAt).getTime()).filter(expiry => Number.isFinite(expiry) && expiry > now);
        const baseTime = activeExpiries.length ? Math.max(...activeExpiries) : now;
        const coins = Math.max(0, Math.floor(Number(user.coins) || 0));
        if (coins < offer.price) {
            const missing = offer.price - coins;
            const missingText = `${fmt(missing)} moneda${missing === 1 ? '' : 's'} de oro 🪙`;
            return reply(sock, chatId, msg, `╭━━〔 🪙 ORO INSUFICIENTE 〕━━╮\n│ 💰 Precio: *${fmt(offer.price)} ${COIN}*\n│ 👜 Tu bolsa: *${fmt(coins)} ${COIN}*\n│ Te faltan: *${missingText}*\n╰━━━━━━━━━━━━━━━━━━━━╯\n\nConsulta los pases con *${prefix}tiendapremium*.`);
        }

        const premiumKey = identityKeys.find(key => /@s\.whatsapp\.net$/i.test(key)) || identityKeys[0] || normalizeJid(jid);
        const expiresAt = new Date(baseTime + offer.days * 24 * 60 * 60 * 1000).toISOString();
        user.coins = coins - offer.price;
        for (const key of identityKeys) if (key !== premiumKey) delete botData.premiumUsers[key];
        botData.premiumUsers[premiumKey] = { grantedAt: new Date(now).toISOString(), expiresAt, source: 'gold_shop' };
        save();
        const expiryText = new Date(expiresAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
        return reply(sock, chatId, msg, `╭━━━〔 ✅ *PASE ACTIVADO* 〕━━━╮\n│\n│ 👑 *NIKU MD · PREMIUM*\n│ 📦 Duración: *${offer.days} día${offer.days === 1 ? '' : 's'}*\n│ 🪙 Pagaste: *${fmt(offer.price)} ${COIN}*\n│ 💰 Saldo: *${fmt(user.coins)} ${COIN}*\n│ 📅 Vence: *${expiryText}*\n│${activeExpiries.length ? '\n│ ⏳ El tiempo se sumó a tu pase activo.\n│' : ''}\n╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n✨ ¡Disfruta tus funciones Premium!`);
    }
    await resumeInvestmentsForChat(sock, chatId, botData, saveBotData);
    if (canonical === 'tutorial') {
        return reply(sock, chatId, msg, tutorialText(user, prefix));
    }
    const expansionResult = await handleExpansion({ sock, chatId, msg, canonical, args, user, jid, botData, save, prefix, sameIdentity });
    if (expansionResult) {
        if (canonical === 'market' && ['ver', 'listado'].includes(String(args[0] || 'ver').toLowerCase())) {
            const listings = Object.values(botData.rpgMarket || {}).filter(item => item.status === 'open' && item.chatId === chatId && !sameIdentity(botData, item.seller, jid)).slice(0, 3);
            const buttons = listings.map(item => ({ label: `🛒 ${String(item.id).slice(-18)}`, command: `${prefix}mercado comprar ${item.id}` }));
            if (!listings.length) buttons.push(
                { label: '📤 Publicar objeto', command: `${prefix}mercado publicar` },
                { label: '🏛️ Ver subastas', command: `${prefix}subastas` },
                { label: '🧑‍🌾 Mercader', command: `${prefix}mercader` }
            );
            await sendActionButtons(sock, chatId, 'Compra una publicación al precio indicado o publica un objeto:', buttons, expansionResult || msg);
        }
        return expansionResult;
    }
    if (canonical === 'investment') {
        botData.investments ||= {};
        const active = investmentForUser(botData, chatId, jid);
        if (active) return reply(sock, chatId, msg, `📈 Ya tienes una inversión en curso por *${fmt(active.amount)} ${COIN}*.\n⏳ Termina en aproximadamente *${timeLeft(Math.max(0, Number(active.resolvesAt) - Date.now()))}*.`);
        const requested = amount(args[0]);
        if (requested === 'all' || !requested) {
            const examples = investmentQuickAmounts(user.coins);
            const sent = await reply(sock, chatId, msg, `📈 *ELIGE TU INVERSIÓN*\n\nPulsa un ejemplo o escribe *${prefix}invertir <cantidad>*.\nMínimo: *${fmt(MIN_INVESTMENT)} ${COIN}* · Máximo: *${fmt(MAX_INVESTMENT)} ${COIN}*.\n⏱️ Dura 5 minutos; el resultado puede ser ganancia o pérdida.${examples.length ? '' : `\n🪙 Tu saldo (${fmt(user.coins)}) no alcanza el mínimo.`}`);
            await sendActionButtons(sock, chatId, 'Selecciona cuánto oro deseas invertir:', examples.map(value => ({ label: `📈 ${fmt(value)} oro`, command: `${prefix}invertir ${value}` })), sent || msg);
            return sent;
        }
        if (requested < MIN_INVESTMENT || requested > MAX_INVESTMENT) return reply(sock, chatId, msg, `❌ La inversión debe estar entre *${fmt(MIN_INVESTMENT)}* y *${fmt(MAX_INVESTMENT)} ${COIN}*.`);
        if (requested > user.coins) return reply(sock, chatId, msg, `❌ No tienes suficiente oro.\nNecesitas: *${fmt(requested)} ${COIN}*\nTienes: *${fmt(user.coins)} ${COIN}*.`);
        const now = Date.now();
        const investment = { id: `investment-${now}-${Math.random().toString(36).slice(2, 8)}`, chatId, jid, amount: requested, status: 'pending', createdAt: new Date(now).toISOString(), resolvesAt: now + INVESTMENT_DURATION };
        user.coins -= requested;
        botData.investments[investment.id] = investment;
        save();
        const sent = await reply(sock, chatId, msg, `📈 *INVERSIÓN INICIADA*\n\n🪙 Capital invertido: *${fmt(requested)} ${COIN}*\n⏱️ Duración: *5 minutos*\n\n📊 El mercado está *GANANDO DINERO*...\n📉 Puede terminar ganando o perdiendo.\n\n⚠️ No puedes retirar este capital hasta que termine la inversión.`);
        scheduleInvestment(sock, investment, botData, saveBotData, sent);
        return;
    }

    if (canonical === 'duel') {
        botData.pvpDuels ||= {};
        const duels = botData.pvpDuels[chatId] ||= {};
        botData.pvpDuelHistory ||= {};
        const history = botData.pvpDuelHistory[chatId] ||= [];
        const now = Date.now();
        let changed = false;
        for (const [id, duel] of Object.entries(duels)) {
            const challengerAccount = findUser(state, duel.challenger, botData);
            const targetAccount = findUser(state, duel.target, botData);
            if (challengerAccount && duel.challenger !== challengerAccount.key) { duel.challenger = challengerAccount.key; changed = true; }
            if (targetAccount && duel.target !== targetAccount.key) { duel.target = targetAccount.key; changed = true; }
            if (duel.status !== 'pending' || now - Number(duel.createdAt) <= 10 * 60e3) continue;
            const challenger = findUser(state, duel.challenger, botData);
            if (challenger) challenger.user.coins = (Number(challenger.user.coins) || 0) + Number(duel.stake || 0);
            delete duels[id];
            changed = true;
        }
        if (changed) save();
        const action = String(args[0] || '').toLowerCase();
        if (!action) return commandReply(sock, chatId, msg, 'duel', `⚔️ *CÓMO USAR LOS DUELOS*\n\n1️⃣ Reta a alguien: *${prefix}duelo @usuario 1000*\n2️⃣ El usuario acepta: *${prefix}duelo aceptar*\n3️⃣ El bot sortea el ganador y entrega un pozo equivalente al doble de la apuesta\n\nMínimo: *${fmt(MIN_BET)} ${COIN}*\nVer pendientes: *${prefix}duelo estado*\nRechazar: *${prefix}duelo rechazar*\nCancelar tu reto: *${prefix}duelo cancelar*\nHistorial: *${prefix}duelo historial*`);
        if (['historial', 'history', 'hist'].includes(action)) {
            if (!history.length) return commandReply(sock, chatId, msg, 'duel', '📜 Todavía no hay duelos PvP registrados en este chat.');
            const rows = history.slice(0, 10).map((duel, index) => `${index + 1}. 🏆 @${numberOf(duel.winner)} venció a @${numberOf(duel.loser)} · *${fmt(duel.stake)} ${COIN}* · ${new Date(duel.resolvedAt).toLocaleDateString('es-ES')}`).join('\n');
            return commandReply(sock, chatId, msg, 'duel', `📜 *HISTORIAL DE DUELOS PvP*\n\n${rows}\n\nMostrando los últimos ${Math.min(10, history.length)} duelos.`, { mentions: history.slice(0, 10).flatMap(duel => [duel.winner, duel.loser]) });
        }
        if (['ranking', 'rank', 'top', 'mejores'].includes(action)) {
            if (!history.length) return commandReply(sock, chatId, msg, 'duel', '🏆 Todavía no hay resultados para crear un ranking.');
            const stats = new Map();
            for (const duel of history) {
                const stake = Number(duel.stake) || 0;
                for (const player of [duel.winner, duel.loser]) {
                    const item = stats.get(player) || { player, played: 0, wins: 0, losses: 0, profit: 0 };
                    item.played += 1;
                    if (player === duel.winner) { item.wins += 1; item.profit += stake; }
                    else { item.losses += 1; item.profit -= stake; }
                    stats.set(player, item);
                }
            }
            const rows = [...stats.values()].sort((a, b) => b.wins - a.wins || (b.wins / b.played) - (a.wins / a.played) || b.profit - a.profit).slice(0, 10);
            const text = rows.map((item, index) => `${index + 1}. @${numberOf(item.player)} · *${item.wins}V-${item.losses}D* · ${Math.round(item.wins / item.played * 100)}% · ${item.profit >= 0 ? '+' : ''}${fmt(item.profit)} ${COIN}`).join('\n');
            return commandReply(sock, chatId, msg, 'duel', `🏆 *RANKING PvP DEL CHAT*\n\n${text}\n\n_Ordenado por victorias, porcentaje y saldo neto._`, { mentions: rows.map(item => item.player) });
        }
        if (['aceptar', 'accept'].includes(action)) {
            const requestedChallenger = getTarget(msg, args.slice(1).join(' '), state, botData);
            const pending = Object.values(duels).filter(duel => duel.status === 'pending' && sameIdentity(botData, duel.target, jid))
                .filter(duel => !requestedChallenger || sameIdentity(botData, duel.challenger, requestedChallenger.key))
                .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))[0];
            if (!pending) return commandReply(sock, chatId, msg, 'duel', `❌ No tienes duelos pendientes. Usa *${prefix}duelo @usuario <cantidad>* para retar a alguien.`);
            const challenger = findUser(state, pending.challenger, botData);
            const stake = Number(pending.stake) || 0;
            if (!challenger || !Number.isSafeInteger(stake) || stake < MIN_BET || stake > MAX_DUEL_STAKE) {
                if (challenger && Number.isSafeInteger(stake) && stake >= MIN_BET && stake <= MAX_DUEL_STAKE) challenger.user.coins = (Number(challenger.user.coins) || 0) + stake;
                delete duels[pending.id]; save();
                return commandReply(sock, chatId, msg, 'duel', `❌ Ese duelo tenía una apuesta inválida y fue cancelado. Límite actual: *${fmt(MAX_DUEL_STAKE)} ${COIN}*.`);
            }
            if (user.coins < stake) return commandReply(sock, chatId, msg, 'duel', `❌ Necesitas *${fmt(stake)} ${COIN}* para aceptar el duelo. Tienes *${fmt(user.coins)}*.`);
            if (!consumeDailyLimit(botData, user, jid, 'duelStake', stake, ECONOMY_LIMITS.duelStake, 'duel_limit', { stake, challenger: pending.challenger })) {
                save();
                return commandReply(sock, chatId, msg, 'duel', `🛡️ Alcanzaste el límite diario de apuestas PvP (*${fmt(ECONOMY_LIMITS.duelStake)} ${COIN}*). Vuelve mañana.`);
            }
            user.coins -= stake;
            const winner = Math.random() < 0.5 ? { key: pending.challenger, account: challenger.user } : { key: jid, account: user };
            const loser = winner.key === jid ? pending.challenger : jid;
            winner.account.coins += stake * 2;
            const winnerRpg = ensureRpg(winner.account);
            const loserRpg = ensureRpg(winner.key === jid ? challenger.user : user);
            const expected = 1 / (1 + Math.pow(10, (Number(loserRpg.pvp.elo) - Number(winnerRpg.pvp.elo)) / 400));
            const eloGain = Math.max(12, Math.round(32 * (1 - expected)));
            winnerRpg.pvp.wins += 1; winnerRpg.pvp.streak += 1; winnerRpg.pvp.elo = Math.min(3000, winnerRpg.pvp.elo + eloGain);
            loserRpg.pvp.losses += 1; loserRpg.pvp.streak = 0; loserRpg.pvp.elo = Math.max(400, loserRpg.pvp.elo - eloGain);
            updateTitles(winner.account); updateTitles(winner.key === jid ? challenger.user : user);
            history.unshift({ id: pending.id, challenger: pending.challenger, target: pending.target, winner: winner.key, loser, stake, eloGain, resolvedAt: new Date().toISOString() });
            if (history.length > 100) history.length = 100;
            delete duels[pending.id];
            save();
            return commandReply(sock, chatId, msg, 'duel', `⚔️ *DUELO PvP RESUELTO*\n\n🏆 Ganador: @${numberOf(winner.key)}\n💥 Derrotado: @${numberOf(loser)}\n🪙 Pozo ganado: *${fmt(stake * 2)} ${COIN}*\n📈 ELO del ganador: *${winnerRpg.pvp.elo}* (+${eloGain})\n🔥 Racha: *${winnerRpg.pvp.streak}*\n\n💰 Saldo del ganador: *${fmt(winner.account.coins)} ${COIN}*`, { mentions: [winner.key, loser] });
        }
        if (['rechazar', 'reject'].includes(action)) {
            const pending = Object.values(duels).find(duel => duel.status === 'pending' && sameIdentity(botData, duel.target, jid));
            if (!pending) return commandReply(sock, chatId, msg, 'duel', '❌ No tienes un duelo pendiente que rechazar.');
            const challenger = findUser(state, pending.challenger, botData);
            if (challenger) challenger.user.coins = (Number(challenger.user.coins) || 0) + Number(pending.stake || 0);
            delete duels[pending.id]; save();
            return commandReply(sock, chatId, msg, 'duel', `↩️ Rechazaste el duelo. Se devolvieron *${fmt(pending.stake)} ${COIN}* al retador.`);
        }
        if (['cancelar', 'cancel'].includes(action)) {
            const pending = Object.values(duels).find(duel => duel.status === 'pending' && sameIdentity(botData, duel.challenger, jid));
            if (!pending) return commandReply(sock, chatId, msg, 'duel', '❌ No tienes un duelo pendiente que cancelar.');
            user.coins += Number(pending.stake) || 0;
            delete duels[pending.id]; save();
            return commandReply(sock, chatId, msg, 'duel', `↩️ Duelo cancelado. Se te devolvieron *${fmt(pending.stake)} ${COIN}*.`);
        }
        if (['estado', 'status', 'lista'].includes(action)) {
            const pending = Object.values(duels).filter(duel => duel.status === 'pending' && (sameIdentity(botData, duel.challenger, jid) || sameIdentity(botData, duel.target, jid)));
            if (!pending.length) return commandReply(sock, chatId, msg, 'duel', '⚔️ No tienes duelos pendientes.');
            const text = pending.map(duel => `${sameIdentity(botData, duel.challenger, jid) ? '📤 Retaste a' : '📥 Te retó'} @${numberOf(sameIdentity(botData, duel.challenger, jid) ? duel.target : duel.challenger)} · *${fmt(duel.stake)} ${COIN}*`).join('\n');
            return commandReply(sock, chatId, msg, 'duel', `⚔️ *DUELOS PENDIENTES*\n\n${text}\n\nAceptar: *${prefix}duelo aceptar*\nCancelar: *${prefix}duelo cancelar*`, { mentions: pending.flatMap(duel => [duel.challenger, duel.target]) });
        }
        const target = getDuelTarget(msg, q, state, botData);
        const stake = duelStakeFromArgs(args, target);
        if (!target || !stake || stake < MIN_BET) return commandReply(sock, chatId, msg, 'duel', `ℹ️ Uso: *${prefix}${HELP.duel}*\nMínimo: *${fmt(MIN_BET)} ${COIN}* · Máximo: *${fmt(MAX_DUEL_STAKE)} ${COIN}*\nEscribe la apuesta como un número independiente, por ejemplo: *.duelo @usuario 500*.`);
        if (stake > MAX_DUEL_STAKE) return commandReply(sock, chatId, msg, 'duel', `❌ La apuesta máxima es de *${fmt(MAX_DUEL_STAKE)} ${COIN}*. No se aceptan cantidades astronómicas ni formatos ambiguos.`);
        if (sameIdentity(botData, target.key, jid)) return commandReply(sock, chatId, msg, 'duel', '❌ No puedes retarte a ti mismo.');
        if (user.coins < stake) return commandReply(sock, chatId, msg, 'duel', `❌ No tienes suficientes ${COIN}. Necesitas *${fmt(stake)}* y tienes *${fmt(user.coins)}*.`);
        if (Object.values(duels).some(duel => duel.status === 'pending' && (sameIdentity(botData, duel.challenger, jid) || sameIdentity(botData, duel.target, jid) || sameIdentity(botData, duel.target, target.key)))) return commandReply(sock, chatId, msg, 'duel', '⚔️ Tú o ese jugador ya tienen un duelo pendiente.');
        if (!consumeDailyLimit(botData, user, jid, 'duelStake', stake, ECONOMY_LIMITS.duelStake, 'duel_limit', { stake, target: target.key })) {
            save();
            return commandReply(sock, chatId, msg, 'duel', `🛡️ Alcanzaste el límite diario de apuestas PvP (*${fmt(ECONOMY_LIMITS.duelStake)} ${COIN}*). Vuelve mañana.`);
        }
        const id = `duel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        user.coins -= stake;
        duels[id] = { id, challenger: jid, target: target.key, stake, status: 'pending', createdAt: now };
        save();
        const challengeText = `⚔️ *DESAFÍO PvP ENVIADO*\n\n📤 @${numberOf(jid)} retó a @${numberOf(target.key)}\n🪙 Apuesta: *${fmt(stake)} ${COIN}*\n⏳ Expira en 10 minutos\n\n@${numberOf(target.key)}, acepta con *${prefix}duelo aceptar*.\nEl retador puede cancelar con *${prefix}duelo cancelar*.`;
        const sent = await commandReply(sock, chatId, msg, 'duel', challengeText, { mentions: [jid, target.key] });
        await sendActionButtons(sock, chatId, '⚔️ ¿Qué deseas hacer con este duelo?', [
            { label: '✅ Aceptar', command: `${prefix}duelo aceptar` },
            { label: '❌ Rechazar', command: `${prefix}duelo rechazar` },
            { label: '↩️ Cancelar', command: `${prefix}duelo cancelar` }
        ], sent || msg);
        return sent;
    }
    if (canonical === 'characterClass') {
        const requested = String(args[0] || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (!requested || !CHARACTER_CLASSES[requested]) {
            const options = Object.entries(CHARACTER_CLASSES).map(([key, value]) => `${value.label} — *${key}*\n${value.description}\n✨ Ventaja: ${value.advantage}`).join('\n\n');
            const sent = await reply(sock, chatId, msg, `🧙 *ELECCIÓN DE CLASE*\n\n${options}\n\nToca un botón para elegir o escribe uno de estos comandos:\n*${prefix}clase guerrero* · *${prefix}clase mago* · *${prefix}clase picaro* · *${prefix}clase tirador* · *${prefix}clase paladin*.`);
            await sendClassChoiceButtons(sock, chatId, msg, prefix, sent || msg);
            return sent;
        }
        if (user.rpg.class) return reply(sock, chatId, msg, `🛡️ Tu personaje ya pertenece a la clase *${CHARACTER_CLASSES[user.rpg.class]?.label || user.rpg.class}*. La clase se elige una sola vez.`);
        user.rpg.class = requested;
        syncClassToRegisteredProfile(botData, jid, user);
        activateWelcomeMission(user);
        save();
        const selected = CHARACTER_CLASSES[requested];
        return sendImageCaption(sock, chatId, msg, classImagePath(requested), `🎉 *CLASE ELEGIDA*\n\n${selected.label}\n${selected.description}\n✨ Ventaja: ${selected.advantage}\n\n⭐ Nivel inicial: *${user.rpg.level}*\n✨ Experiencia: *${fmt(user.rpg.xp)} XP*\n\nTu clase aparecerá en *${prefix}perfil*.`);
    }

    if (canonical === 'raid') return reply(sock, chatId, msg, `🐉 Usa *${prefix}raid ayuda* para entrar a la raid cooperativa del grupo.`);

    if (canonical === 'merchant') {
        const merchantAction = String(args[0] || '').toLowerCase();
        if (['vender', 'sell', 'botin', 'botín'].includes(merchantAction)) {
            user.loot ||= {};
            const lootRows = Object.entries(user.loot).filter(([, quantity]) => Number(quantity) > 0);
            if (!args[1]) {
                const listing = lootRows.length ? lootRows.map(([id, quantity]) => { const loot = lootById(id); return loot ? `📦 *${loot.name}* · ${quantity} unidad(es) · *${fmt(loot.sellPrice)} ${COIN}* c/u\nVender: *${prefix}mercader vender ${id}*` : ''; }).filter(Boolean).join('\n') : 'No tienes botín de mazmorra para vender.';
                return reply(sock, chatId, msg, `💰 *BOTÍN PARA VENDER*\n\n${listing}`);
            }
            const loot = lootById(String(args[1]).toLowerCase());
            const quantity = Number(user.loot[loot?.id] || 0);
            if (!loot || quantity < 1) return reply(sock, chatId, msg, '❌ No tienes ese objeto en tu bolsa de botín. Usa *.mercader vender* para ver tus drops.');
            const amountToSell = args[2] === 'todo' || args[2] === 'all' ? quantity : 1;
            user.loot[loot.id] -= amountToSell;
            if (user.loot[loot.id] <= 0) delete user.loot[loot.id];
            const payout = loot.sellPrice * amountToSell;
            user.coins += payout;
            save();
            return reply(sock, chatId, msg, `✅ El mercader compró *${amountToSell}x ${loot.name}* por *${fmt(payout)} ${COIN}*.\n🪙 Bolsa: *${fmt(user.coins)} ${COIN}*`);
        }
        if (['equipo', 'equipamiento'].includes(merchantAction)) return sendMerchantGearPage(sock, chatId, msg, user, prefix, args[1]);
        if (merchantAction === 'publicar') return reply(sock, chatId, msg, `🏪 El mercado entre jugadores está separado del mercader. Usa *${prefix}mercado publicar <objeto> <precio>* o *${prefix}mercado ver*.`);
        const requestedItem = ['comprar', 'buy'].includes(merchantAction) ? args.slice(1).join(' ') : args.join(' ');
        if (!requestedItem || ['ver', 'listado', 'catalogo', 'catálogo', 'shop'].includes(merchantAction)) {
            const sent = await sendImageCaption(sock, chatId, msg, shopImagePath(), merchantShopText(user, prefix));
            await sendMerchantQuickActions(sock, chatId, msg, user, prefix, sent || msg);
            return sent;
        }
        const selected = toolFor(requestedItem);
        const gear = equipmentForUser(user, requestedItem);
        if (gear) {
            user.equipment ||= {};
            if (user.equipment[gear.id]) return reply(sock, chatId, msg, `✅ Ya tienes equipado ${gear.name}. Su bonificación está activa.`);
            if (user.coins < gear.price) return reply(sock, chatId, msg, `╭━━〔 🪙 ORO INSUFICIENTE 〕━━╮\n│ ${gear.name}\n│ Precio: *${fmt(gear.price)} ${COIN}*\n│ Tu saldo: *${fmt(user.coins)} ${COIN}*\n│ Te faltan: *${fmt(gear.price - user.coins)}*\n╰━━━━━━━━━━━━━━━━━━━━━━╯`);
            user.coins -= gear.price;
            user.equipment[gear.id] = { purchasedAt: new Date().toISOString(), price: gear.price };
            const gearAchievements = addStat(user, 'gearBought', 1);
            save();
            return sendItemCaption(sock, chatId, msg, gear.id, `✅ *COMPRA COMPLETADA*\n\n${gear.name}\n💸 Precio: *${fmt(gear.price)} ${COIN}*\n⚔️ Equipo activado: *+${Math.round(gear.bonus * 100)}%* en ${activityText(gear.activities)}\n🪙 Saldo: *${fmt(user.coins)} ${COIN}*${achievementText(gearAchievements)}`);
        }
        const consumableId = consumableFor(requestedItem);
        if (consumableId) {
            const item = RPG_ITEMS[consumableId];
            if (user.coins < item.price) return reply(sock, chatId, msg, `╭━━〔 🪙 ORO INSUFICIENTE 〕━━╮\n│ ${item.name}\n│ Precio: *${fmt(item.price)} ${COIN}*\n│ Tu saldo: *${fmt(user.coins)} ${COIN}*\n│ Te faltan: *${fmt(item.price - user.coins)}*\n╰━━━━━━━━━━━━━━━━━━━━━━╯`);
            user.coins -= item.price;
            user.rpg.inventory[consumableId] = (Number(user.rpg.inventory[consumableId]) || 0) + 1;
            save();
            const effect = item.heal ? `❤️ Recupera hasta *${item.heal} HP*` : `⚡ Recupera hasta *${item.energy} energía*`;
            return sendItemCaption(sock, chatId, msg, consumableId, `✅ *CONSUMIBLE COMPRADO*\n\n${item.name}\n💸 Precio: *${fmt(item.price)} ${COIN}*\n${effect}\n🎒 Cantidad: *${user.rpg.inventory[consumableId]}*\n💰 Saldo: *${fmt(user.coins)} ${COIN}*\n\nÚsalo con *${prefix}usar ${consumableId}* o *${prefix}pocion ${consumableId}*.`);
        }
        if (!selected) {
            const wanted = normalizeShopItem(requestedItem);
            const recipe = Object.entries(RECIPES).find(([id, item]) => [id, item.name].some(alias => normalizeShopItem(alias) === wanted));
            if (recipe) return reply(sock, chatId, msg, `🔨 *${recipe[1].name}* no se compra en el mercader; se fabrica.\nUsa: *${prefix}fabricar ${recipe[0]}*\nConsulta todas las recetas con *${prefix}fabricar*.`);
            const otherClassGear = Object.entries(CLASS_EQUIPMENT).flatMap(([classId, items]) => items.map(item => ({ ...item, classId }))).find(item => [item.id, item.name].some(alias => normalizeShopItem(alias) === wanted));
            if (otherClassGear) return reply(sock, chatId, msg, `🔒 *${otherClassGear.name}* es exclusivo de la clase *${CHARACTER_CLASSES[otherClassGear.classId]?.label || otherClassGear.classId}*. Tu clase actual es *${CHARACTER_CLASSES[user.rpg.class]?.label || 'sin elegir'}*.`);
            return reply(sock, chatId, msg, `❌ No reconocí *${requestedItem}* en la tienda.\nUsa *${prefix}mercader* para ver herramientas y equipo de tu clase. Compra con *${prefix}comprar <nombre o ID>*.\nEl equipo básico se fabrica con *${prefix}fabricar*; el mercado entre jugadores es *${prefix}mercado*.`);
        }
        const item = MERCHANT_ITEMS[selected];
        if (user.coins < item.price) return reply(sock, chatId, msg, `╭━━〔 🪙 ORO INSUFICIENTE 〕━━╮\n│ ${item.name}\n│ Precio: *${fmt(item.price)} ${COIN}*\n│ Tu saldo: *${fmt(user.coins)} ${COIN}*\n│ Te faltan: *${fmt(item.price - user.coins)}*\n╰━━━━━━━━━━━━━━━━━━━━━━╯`);
        user.tools ||= {};
        user.coins -= item.price;
        user.tools[selected] = { durability: item.durability, maxDurability: item.durability, boughtAt: new Date().toISOString() };
        save();
        return sendItemCaption(sock, chatId, msg, selected, `✅ *COMPRA COMPLETADA*\n\n${item.name}\n💸 Precio: *${fmt(item.price)} ${COIN}*\n🔧 Durabilidad: *${item.durability}/${item.durability} usos*\n💰 Saldo: *${fmt(user.coins)} ${COIN}*\nÚsala con *${prefix}${selected === 'pico' ? 'minar' : selected === 'cana' ? 'pescar' : 'cazar'}*.`);
    }

    if (canonical === 'repair') {
        const dungeon = ensureDungeonState(user);
        const repairCost = 1500;
        if (dungeon.integrity >= 100) return reply(sock, chatId, msg, '✅ Tu mazmorra ya está completamente reparada (*100/100*).');
        if (user.coins < repairCost) return reply(sock, chatId, msg, `❌ Reparar la mazmorra cuesta *${fmt(repairCost)} ${COIN}*.\nTienes: *${fmt(user.coins)}*.`);
        user.coins -= repairCost;
        dungeon.integrity = 100;
        save();
        return reply(sock, chatId, msg, `🔧 *MAZMORRA REPARADA*\n\n🏰 Integridad: *100/100*\n💸 Costo: *${fmt(repairCost)} ${COIN}*\n💰 Saldo: *${fmt(user.coins)} ${COIN}*`);
    }

    if (canonical === 'explore') {
        const wait = cooldown(user, 'lastExplore', 75e3);
        if (wait) return commandReply(sock, chatId, msg, 'explore', `⏳ Ya estás explorando. Regresa en *${timeLeft(wait)}*.`);
        const dailyLimit = consumeAction(user, 'explore', DAILY_ACTIVITY_LIMITS.explore);
        if (!dailyLimit.ok) return commandReply(sock, chatId, msg, 'explore', `🛡️ Ya completaste tus *${dailyLimit.limit} expediciones* de hoy. Vuelve mañana para que el reino renueve tus fuerzas.`);
        const reward = random(EXPLORATION_REWARDS);
        const discovery = random(['un santuario antiguo', 'una aldea escondida', 'un mapa misterioso', 'una cueva cristalina', 'un campamento abandonado']);
        const clan = getUserClan(botData.clans, jid);
        user.coins += reward;
        user.lastExplore = Date.now();
        let clanText = '';
        if (clan) {
            clan.xp = (Number(clan.xp) || 0) + 35;
            clan.level = clanLevel(clan);
            clanText = `\n⭐ ${clan.name}: *+35 XP de clan* · Nivel *${clan.level}*`;
        }
        const activityProgress = grantActivityProgress('explore', 5);
        save();
        await animate(sock, chatId, msg, ['🧭 Preparando la expedición...', '🗺️ Atravesando el bosque... ▰▱▱▱▱▱▱▱▱▱', '🗺️ Siguiendo un camino desconocido... ▰▰▰▰▰▰▱▱▱▱', `✨ Descubriste ${discovery}!`]);
        const sent = await commandReply(sock, chatId, msg, 'explore', `✅ Exploración completada\n\n🪙 Recompensa: *${fmt(reward)} ${COIN}*\n💰 Saldo: *${fmt(user.coins)} ${COIN}*${clanText}${activityProgress.extraText}`);
        return withRpgActions(sent, [
            { label: '📜 Misiones', command: `${prefix}misiones` },
            { label: '🏰 Mazmorra', command: `${prefix}mazmorra` },
            { label: '🗂️ Menú RPG', command: `${prefix}rpgmenu` }
        ]);
    }

    if (canonical === 'gather') {
        const wait = cooldown(user, 'lastGather', 60e3);
        if (wait) return commandReply(sock, chatId, msg, 'gather', `⏳ Ya recolectaste recursos recientemente. Vuelve en *${timeLeft(wait)}*.`);
        const tool = toolState(user, 'pico');
        if (!tool) return commandReply(sock, chatId, msg, 'gather', `❌ Necesitas un ⛏️ *pico* para recolectar recursos.\nUsa *${prefix}mercader pico*.`);
        const dailyLimit = consumeAction(user, 'gather', DAILY_ACTIVITY_LIMITS.gather);
        if (!dailyLimit.ok) return commandReply(sock, chatId, msg, 'gather', `🛡️ Ya recolectaste el máximo de *${dailyLimit.limit} veces* hoy. Vuelve mañana.`);
        const reward = random(GATHERING_REWARDS);
        const resource = random(['cristales', 'hierbas raras', 'madera encantada', 'semillas mágicas', 'fragmentos de mineral']);
        const used = consumeTool(user, 'pico');
        user.coins += reward;
        user.lastGather = Date.now();
        const activityProgress = grantActivityProgress('gather', 5);
        save();
        await animate(sock, chatId, msg, ['🌿 Buscando recursos...', '🌿 Recolectando materiales... ▰▱▱▱▱▱▱▱▱▱', '🌿 La bolsa empieza a llenarse... ▰▰▰▰▰▰▰▱▱▱', `📦 Encontraste ${resource}!`]);
        const sent = await commandReply(sock, chatId, msg, 'gather', `✅ Recolección completada\n\n📦 Recurso: *${resource}*\n🪙 Recompensa: *${fmt(reward)} ${COIN}*\n🔧 Pico: *${used.durability}/${MERCHANT_ITEMS.pico.durability} usos*${used.broken ? `\n💥 Tu pico se rompió. Compra otro en *${prefix}mercader*.` : ''}${activityProgress.extraText}`);
        return withRpgActions(sent, [
            { label: '📜 Misiones', command: `${prefix}misiones` },
            { label: '⛏️ Minar', command: `${prefix}minar` },
            { label: '🗂️ Menú RPG', command: `${prefix}rpgmenu` }
        ]);
    }

    if (canonical === 'patrol') {
        const clan = getUserClan(botData.clans, jid);
        if (!clan) return commandReply(sock, chatId, msg, 'patrol', `❌ Debes pertenecer a un clan para patrullar. Usa *${prefix}clan* para unirte a uno.`);
        const wait = cooldown(user, 'lastPatrol', 120e3);
        if (wait) return commandReply(sock, chatId, msg, 'patrol', `⏳ El clan ya fue patrullado. Vuelve en *${timeLeft(wait)}*.`);
        const dailyLimit = consumeAction(user, 'patrol', DAILY_ACTIVITY_LIMITS.patrol);
        if (!dailyLimit.ok) return commandReply(sock, chatId, msg, 'patrol', `🛡️ El clan ya completó sus *${dailyLimit.limit} patrullas* diarias. Vuelve mañana.`);
        const reward = random([400, 550, 700, 900]);
        const clanXp = random([80, 100, 120, 150]);
        user.coins += reward;
        user.lastPatrol = Date.now();
        clan.xp = (Number(clan.xp) || 0) + clanXp;
        clan.level = clanLevel(clan);
        const activityProgress = grantActivityProgress('patrol', 5);
        save();
        await animate(sock, chatId, msg, ['🛡️ Reuniendo a la guardia del clan...', '🛡️ Revisando las fronteras... ▰▱▱▱▱▱▱▱▱▱', '🛡️ Detectando huellas enemigas... ▰▰▰▰▰▰▰▰▱▱', '✅ ¡La frontera está segura!']);
        const sent = await commandReply(sock, chatId, msg, 'patrol', `🛡️ *PATRULLA DEL CLAN*\n\n🏰 Clan: *${clan.name}*\n🪙 Recompensa: *${fmt(reward)} ${COIN}*\n⭐ XP del clan: *+${clanXp}*\n📈 Nivel del clan: *${clan.level}*${activityProgress.extraText}`);
        return withRpgActions(sent, [
            { label: '⚔️ Clan', command: `${prefix}clan` },
            { label: '📜 Misiones', command: `${prefix}misiones` },
            { label: '🗂️ Menú RPG', command: `${prefix}rpgmenu` }
        ]);
    }

    if (canonical === 'mission') {
        const action = String(args[0] || '').toLowerCase();
        if (action === 'diarias' || action === 'diaria' || action === 'semanales' || action === 'semanal' || !action) {
            const sent = await commandReply(sock, chatId, msg, 'mission', `📜 *MISIONES DEL AVENTURERO*\n\n${missionText(user, prefix)}`);
            await sendActionButtons(sock, chatId, '💼 Empleos y encargos:', [
                { label: '💼 Trabajar', command: `${prefix}work` },
                { label: '🕵️ Encargo', command: `${prefix}crime` },
                { label: '🎭 Actuar', command: `${prefix}slut` }
            ], sent || msg);
            await sendActionButtons(sock, chatId, '⛏️ Oficios del aventurero:', [
                { label: '⛏️ Minar', command: `${prefix}minar` },
                { label: '🎣 Pescar', command: `${prefix}pescar` },
                { label: '🏹 Cazar', command: `${prefix}cazar` }
            ], sent || msg);
            await sendActionButtons(sock, chatId, '🧭 Exploración y mazmorras:', [
                { label: '🧭 Explorar', command: `${prefix}explorar` },
                { label: '🌿 Recolectar', command: `${prefix}recolectar` },
                { label: '🏰 Mazmorra', command: `${prefix}mazmorra` }
            ], sent || msg);
            await sendActionButtons(sock, chatId, '🗂️ Más opciones RPG:', [
                { label: '🎁 Recompensa diaria', command: `${prefix}daily` },
                { label: '🛡️ Patrullar clan', command: `${prefix}patrullar` },
                { label: '⚔️ Menú RPG completo', command: `${prefix}rpgmenu` }
            ], sent || msg);
            return sent;
        }
        const welcome = user.rpg?.welcomeMission;
        const welcomeText = welcome ? `🎯 *MISIÓN DE BIENVENIDA*\n${welcome.title}\n${welcome.objective}\nProgreso: *${Math.min(Number(welcome.progress) || 0, Number(welcome.target) || 1)}/${welcome.target}*\n${welcome.claimed ? '✅ Recompensa entregada: 500 monedas de oro + 40 XP' : '🎁 Completa tu primer combate para recibir 500 monedas de oro + 40 XP.'}` : '';
        if (action === 'nueva' && user.mission && !user.mission.completed) return commandReply(sock, chatId, msg, 'mission', '📜 Ya tienes una misión activa. Complétala antes de pedir otra.');
        const hadMission = Boolean(user.mission);
        const current = action === 'nueva' ? ensureMission(user, true) : (user.mission || ensureMission(user));
        if (action === 'nueva' || !hadMission) save();
        const dungeon = ensureDungeonState(user);
        if (current.completed) return commandReply(sock, chatId, msg, 'mission', `${welcomeText ? `${welcomeText}\n\n` : ''}📜 *MISIÓN COMPLETADA*\n\n🏰 Mata *${current.target} monstruos* en la mazmorra.\n🎁 Recompensa recibida: *${fmt(current.reward)} ${COIN}*\n\nEscribe *${prefix}misiones nueva* para obtener otra misión.`);
        return commandReply(sock, chatId, msg, 'mission', `${welcomeText ? `${welcomeText}\n\n` : ''}📜 *MISIÓN DE MAZMORRA*\n\n🏰 Derrota monstruos: *${current.progress}/${current.target}*\n🎁 Recompensa: *${fmt(current.reward)} ${COIN}*\n🚪 Entradas hoy: *${dungeon.runs}/3*\n\nUsa *${prefix}mazmorra* para avanzar.`);
    }

    if (canonical === 'dungeon') {
        const dungeon = ensureDungeonState(user);
        const mission = ensureMission(user);
        if (dungeon.runs >= 3) return commandReply(sock, chatId, msg, 'dungeon', `🚪 Ya bajaste a la mazmorra *3/3 veces* hoy.\nVuelve mañana para continuar la misión.`);
        if (dungeon.integrity < 25) return commandReply(sock, chatId, msg, 'dungeon', `🏚️ Tu mazmorra está demasiado dañada (*${dungeon.integrity}/100*).\nUsa *${prefix}reparar* para restaurarla por *1.500 ${COIN}*.`);
        const sword = toolState(user, 'espada');
        if (!sword) return commandReply(sock, chatId, msg, 'dungeon', `❌ Necesitas una ⚔️ *espada* para entrar a la mazmorra.\nUsa *${prefix}mercader espada* para comprar una.`);
        if (user.rpg.energy < 18) return commandReply(sock, chatId, msg, `dungeon`, `⚡ No tienes suficiente energía. Necesitas *18* y tienes *${user.rpg.energy}/${user.rpg.maxEnergy}*.`);
        const actionLimit = consumeAction(user, 'dungeon', 3);
        if (!actionLimit.ok) return commandReply(sock, chatId, msg, 'dungeon', '🚪 Ya alcanzaste el límite diario de 3 expediciones. Vuelve mañana.');
        const energy = consumeEnergy(user, 18);
        if (!energy.ok) return commandReply(sock, chatId, msg, 'dungeon', `⚡ No tienes suficiente energía. Necesitas *18* y tienes *${energy.energy}/${energy.maxEnergy}*. Descansa o espera a que se recupere.`);
        const remaining = Math.max(0, mission.target - mission.progress);
        const runsLeft = 3 - dungeon.runs;
        const kills = runsLeft === 1 ? remaining : Math.min(remaining, 5 + Math.floor(Math.random() * 8));
        const used = consumeTool(user, 'espada');
        dungeon.runs += 1;
        dungeon.integrity = Math.max(0, dungeon.integrity - 35);
        mission.progress += kills;
        const dungeonAchievements = addStat(user, 'dungeonKills', kills);
        const dungeonClassMultiplier = classRewardMultiplier(user, 'dungeon');
        const dungeonMultiplier = equipmentRewardMultiplier(user, 'dungeon');
        const rewardClassText = classAdvantageText(user, 'dungeon');
        const rewardEquipmentText = equipmentAdvantageText(user, 'dungeon');
        const reward = Math.floor(random(DUNGEON_REWARDS) * dungeonClassMultiplier * dungeonMultiplier);
        user.coins += reward;
        const gearPool = classEquipment(user).filter(item => item.dungeonDrop && !user.equipment?.[item.id]);
        const droppedGear = gearPool.length && Math.random() < 0.04 ? random(gearPool) : null;
        const droppedLoot = !droppedGear && Math.random() < 0.35 ? random(DUNGEON_LOOT) : null;
        const lootAchievements = [];
        if (droppedLoot) {
            user.loot ||= {};
            const rare = rareDrop(user, droppedLoot.id, droppedLoot.name, droppedLoot.sellPrice);
            if (user.rpg.loot?.[rare.id]) {
                user.rpg.loot[rare.id] -= 1;
                if (user.rpg.loot[rare.id] <= 0) delete user.rpg.loot[rare.id];
            }
            user.loot[rare.id] = (Number(user.loot[rare.id]) || 0) + 1;
            droppedLoot._rare = rare;
            lootAchievements.push(...addStat(user, 'dungeonDrops', 1));
            if (['raro', 'epico', 'legendario'].includes(rare.rarity)) lootAchievements.push(...addStat(user, 'rareDungeonDrops', 1));
            if (rare.rarity === 'legendario') lootAchievements.push(...addStat(user, 'legendaryDungeonDrops', 1));
        }
        if (droppedGear) {
            user.equipment ||= {};
            user.equipment[droppedGear.id] = { acquiredAt: new Date().toISOString(), source: 'dungeon' };
            lootAchievements.push(...addStat(user, 'dungeonGearDrops', 1));
        }
        let completion = '';
        let missionAchievements = [];
        if (mission.progress >= mission.target) {
            mission.progress = mission.target;
            mission.completed = true;
            user.coins += mission.reward;
            missionAchievements = addStat(user, 'missionsCompleted', 1);
            user.missionHistory ||= [];
            user.missionHistory.push({ target: mission.target, completedAt: new Date().toISOString(), reward: mission.reward });
            const completedTarget = mission.target;
            const nextMission = ensureMission(user, true);
            completion = `\n\n🎉 *¡Misión completada!*\n🎁 Bonus: *${fmt(mission.reward)} ${COIN}*\n📜 Nueva misión: derrota *${nextMission.target} monstruos*.`;
            user.lastCompletedMission = completedTarget;
        }
        const activityProgress = grantActivityProgress('dungeon', 5);
        const unlocked = [...dungeonAchievements, ...missionAchievements, ...lootAchievements];
        save();
        await animate(sock, chatId, msg, ['🏰 Las puertas de la mazmorra se abren...', '👾 Monstruos detectados... ▰▱▱▱▱▱▱▱▱▱', `⚔️ Derrotando monstruos... *${kills} eliminados*`, '🏆 ¡Has sobrevivido a la expedición!']);
        const dropText = droppedGear
            ? `⚔️ *DROP DE EQUIPO:* ${droppedGear.name}\n✨ Bonificación activa: +${Math.round(droppedGear.bonus * 100)}% en ${droppedGear.activities.join(', ')}\n🔨 Puedes venderlo en *${prefix}subastar ${droppedGear.id} <precio>*`
            : droppedLoot
                ? `📦 *DROP:* ${droppedLoot._rare.label}\n💰 Puedes venderlo con *${prefix}mercader vender ${droppedLoot._rare.id}* o subastarlo con *${prefix}subastar ${droppedLoot._rare.id} <precio>*`
                : '🔍 No encontraste un drop vendible esta vez.';
        const sent = await sendImageCaption(sock, chatId, msg, droppedGear ? itemImagePath(droppedGear.id) : dungeonImagePath(), `✅ Expedición completada\n\n👾 Monstruos derrotados: *${kills}*\n🪙 Recompensa: *${fmt(reward)} ${COIN}*${rewardClassText}${rewardEquipmentText}\n${dropText}\n📜 Misión: *${mission.progress}/${mission.target}*\n🚪 Entradas hoy: *${dungeon.runs}/3*\n🏚️ Integridad de mazmorra: *${dungeon.integrity}/100*\n⚡ Energía: *${user.rpg.energy}/${user.rpg.maxEnergy}*\n🔧 Espada: *${used.durability}/12 usos*${used.broken ? '\n💥 Tu espada se rompió. Compra otra en el mercader.' : ''}${completion}${achievementText(unlocked)}${activityProgress.extraText}`);
        const canRunAgain = dungeon.runs < 3 && dungeon.integrity >= 25 && Boolean(toolState(user, 'espada')) && user.rpg.energy >= 18;
        const nextCommand = canRunAgain ? `${prefix}mazmorra` : dungeon.integrity < 25 ? `${prefix}reparar` : !toolState(user, 'espada') ? `${prefix}mercader` : `${prefix}usar elixir_energia`;
        const nextLabel = canRunAgain ? '🏰 Otra expedición' : dungeon.integrity < 25 ? '🔧 Reparar' : !toolState(user, 'espada') ? '🧑‍🌾 Comprar espada' : '⚡ Recuperar energía';
        const buttons = [
            { label: '📜 Misiones', command: `${prefix}misiones` },
            { label: '🎒 Inventario', command: `${prefix}inventario` },
            { label: nextLabel, command: nextCommand }
        ];
        return withRpgActions(sent, buttons, '🏰 Elige tu siguiente paso:');
    }

    if (canonical === 'level') {
        const sent = await reply(sock, chatId, msg, `🧙 *PERFIL RPG*\n\n👤 @${numberOf(jid)}\n⭐ Nivel: *${user.rpg.level}*\n✨ XP total: *${fmt(user.rpg.xp)} XP*\n${levelBar(user)}`, { mentions: [jid] });
        await sendActionButtons(sock, chatId, '⭐ Sigue avanzando:', [
            { label: '📜 Misiones', command: `${prefix}misiones` },
            { label: '✨ Habilidades', command: `${prefix}habilidades` },
            { label: '🗂️ Menú RPG', command: `${prefix}rpgmenu` }
        ], sent || msg);
        return sent;
    }

    if (canonical === 'achievements') {
        const unlocked = user.rpg.achievements || {};
        const rows = ACHIEVEMENTS.map(item => `${unlocked[item.id] ? '✅' : '🔒'} ${item.title} · +${fmt(item.reward)} ${COIN}`).join('\n');
        const sent = await reply(sock, chatId, msg, `🏆 *LOGROS RPG*\n\n${rows}\n\nDesbloqueados: *${Object.keys(unlocked).length}/${ACHIEVEMENTS.length}*`);
        await sendActionButtons(sock, chatId, '🏆 Continúa tu progreso:', [
            { label: '📜 Misiones', command: `${prefix}misiones` },
            { label: '⭐ Nivel', command: `${prefix}nivel` },
            { label: '🗂️ Menú RPG', command: `${prefix}rpgmenu` }
        ], sent || msg);
        return sent;
    }

    if (canonical === 'mine' || canonical === 'fish' || canonical === 'hunt') {
        const isMine = canonical === 'mine';
        const isFish = canonical === 'fish';
        const toolKey = isMine ? 'pico' : isFish ? 'cana' : 'espada';
        const waitKey = isMine ? 'lastMine' : isFish ? 'lastFish' : 'lastHunt';
        const waitMs = isMine ? 45e3 : isFish ? 60e3 : 50e3;
        const wait = cooldown(user, waitKey, waitMs);
        if (wait) return commandReply(sock, chatId, msg, canonical, `⏳ Tu personaje necesita descansar. Vuelve en *${timeLeft(wait)}*.\n👉 Mientras esperas, revisa *${prefix}misiones* o *${prefix}inventario*.`);
        const tool = toolState(user, toolKey);
        if (!tool) {
            const names = { pico: '⛏️ pico', cana: '🎣 caña de pescar', espada: '⚔️ espada' };
            const sent = await commandReply(sock, chatId, msg, canonical, `❌ Necesitas comprar un ${names[toolKey]} para poder ${isMine ? 'minar' : isFish ? 'pescar' : 'cazar'}.\nUsa *${prefix}mercader* para visitar la tienda del gremio.`);
            return withRpgActions(sent, [
                { label: '🧑‍🌾 Abrir mercader', command: `${prefix}mercader` },
                { label: '🎒 Inventario', command: `${prefix}inventario` },
                { label: '🗂️ Menú RPG', command: `${prefix}rpgmenu` }
            ]);
        }
        if (user.rpg.energy < (isMine ? 5 : isFish ? 6 : 7)) return commandReply(sock, chatId, msg, canonical, `⚡ No tienes suficiente energía.\nNecesitas: *${isMine ? 5 : isFish ? 6 : 7}*\nTienes: *${user.rpg.energy}/${user.rpg.maxEnergy}*\n\n✅ Solución: espera a que se recupere o consulta los tiempos con *${prefix}einfo*.`);
        const limit = consumeAction(user, canonical, DAILY_ACTIVITY_LIMITS[canonical]);
        if (!limit.ok) return commandReply(sock, chatId, msg, canonical, `🛡️ Alcanzaste el límite diario de *${limit.limit}* acciones para este comando. Vuelve mañana.`);
        const energy = consumeEnergy(user, isMine ? 5 : isFish ? 6 : 7);
        if (!energy.ok) return commandReply(sock, chatId, msg, canonical, `⚡ No tienes suficiente energía.\nNecesitas: *${isMine ? 5 : isFish ? 6 : 7}*\nTienes: *${energy.energy}/${energy.maxEnergy}*\n\n✅ Solución: espera la recuperación y vuelve a usar *${prefix}${isMine ? 'minar' : isFish ? 'pescar' : 'cazar'}*.`);
        const baseReward = random(isMine ? MINING_REWARDS : isFish ? FISHING_REWARDS : HUNTING_REWARDS);
        const reward = Math.floor(baseReward * classRewardMultiplier(user, canonical) * equipmentRewardMultiplier(user, canonical));
        const baseItem = isMine ? random(['carbón', 'hierro', 'oro', 'diamante', 'redstone']) : isFish ? random(['bacalao', 'salmón', 'pez globo', 'tesoro', 'libro encantado']) : random(['conejo', 'jabalí', 'ciervo', 'zorro', 'lobo salvaje']);
        const rare = rareDrop(user, `${canonical}-${baseItem}`, baseItem, baseReward);
        const item = rare.label;
        const used = consumeTool(user, toolKey);
        user.coins += reward;
        user[waitKey] = Date.now();
        const unlocked = addStat(user, isMine ? 'mined' : isFish ? 'fished' : 'hunted', 1);
        const activityProgress = grantActivityProgress(canonical, isMine || isFish ? 20 : 5);
        save();
        const frames = isMine
            ? [`⛏️ *${numberOf(jid)}* entra a una mina...`, '⛏️ Rompiendo piedra... ▰▱▱▱▱▱▱▱▱▱', '⛏️ Rompiendo piedra... ▰▰▰▰▰▱▱▱▱▱', `💎 ¡Encontraste ${item}!`]
            : isFish ? [`🎣 *${numberOf(jid)}* lanza la caña...`, '🎣 El agua se mueve... ▰▱▱▱▱▱▱▱▱▱', '🎣 ¡Algo mordió el anzuelo! ▰▰▰▰▰▰▱▱▱▱', `🐟 ¡Pescaste ${item}!`] : [`⚔️ *${numberOf(jid)}* se prepara para cazar...`, '⚔️ Siguiendo huellas... ▰▱▱▱▱▱▱▱▱▱', '⚔️ ¡La presa apareció! ▰▰▰▰▰▰▱▱▱▱', `🏹 ¡Cazaste un ${item}!`];
        await animate(sock, chatId, msg, frames);
        const sent = await commandReply(sock, chatId, msg, canonical, `✅ Encontraste *${item}*\n🪙 Recibiste *${fmt(reward)} ${COIN}*\n💰 Saldo: *${fmt(user.coins)}*\n🔧 ${toolKey}: *${used.durability}/${MERCHANT_ITEMS[toolKey].durability} usos*${used.broken ? `\n💥 Tu ${toolKey} se rompió. Compra otro en *${prefix}mercader*.` : ''}${classAdvantageText(user, canonical)}${equipmentAdvantageText(user, canonical)}\n⚡ Energía: *${user.rpg.energy}/${user.rpg.maxEnergy}*${achievementText(unlocked)}${activityProgress.extraText}`);
        return withRpgActions(sent, [
            { label: '📜 Misiones', command: `${prefix}misiones` },
            { label: '🧭 Explorar', command: `${prefix}explorar` },
            { label: '🗂️ Menú RPG', command: `${prefix}rpgmenu` }
        ]);
    }

    if (canonical === 'clan') {
        botData.clans ||= {};
        botData.clanWars ||= {};
        const action = String(args[0] || 'lista').toLowerCase();
        const currentClan = getUserClan(botData.clans, jid);
        if (['guerra', 'war', 'guerras'].includes(action)) {
            if (!currentClan) return commandReply(sock, chatId, msg, 'clan', '❌ Debes pertenecer a un clan para participar en guerras.');
            const currentKey = clanKey(currentClan.name);
            const subAction = String(args[1] || 'lista').toLowerCase();
            if (['desafiar', 'desafio', 'challenge'].includes(subAction)) {
                if (currentClan.owner !== jid) return commandReply(sock, chatId, msg, 'clan', '❌ Solo el líder del clan puede iniciar una guerra.');
                const target = findClan(botData.clans, args.slice(2).join(' '));
                if (!target) return commandReply(sock, chatId, msg, 'clan', `❌ Clan objetivo no encontrado. Usa *${prefix}clan* para ver los clanes.`);
                const targetKey = clanKey(target.name);
                if (targetKey === currentKey) return commandReply(sock, chatId, msg, 'clan', '❌ No puedes desafiar a tu propio clan.');
                const cooldownUntil = Math.max(Number(currentClan.warCooldownUntil) || 0, Number(target.warCooldownUntil) || 0);
                if (cooldownUntil > Date.now()) return commandReply(sock, chatId, msg, 'clan', `⏳ Uno de los clanes debe descansar *${timeLeft(cooldownUntil - Date.now())}* antes de iniciar otra guerra.`);
                if (clanWarList(botData.clanWars).some(war => ['pending', 'accepted'].includes(war.status) && [currentKey, targetKey].some(key => [war.challenger, war.defender].includes(key)))) return commandReply(sock, chatId, msg, 'clan', '⚔️ Uno de esos clanes ya tiene una guerra pendiente o activa.');
                const id = `war-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                botData.clanWars[id] = { id, challenger: currentKey, defender: targetKey, status: 'pending', createdAt: new Date().toISOString() };
                save();
                const sent = await commandReply(sock, chatId, msg, 'clan', `⚔️ *DESAFÍO ENVIADO*\n\n🏰 ${currentClan.name} vs ${target.name}\n\nEl líder de *${target.name}* puede aceptar con el botón o con:\n*${prefix}clan guerra aceptar*`);
                await sendActionButtons(sock, chatId, '⚔️ Desafío de clan:', [
                    { label: '✅ Aceptar guerra', command: `${prefix}clan guerra aceptar` },
                    { label: '📜 Ver guerras', command: `${prefix}clan guerra` },
                    { label: '🗂️ Menú RPG', command: `${prefix}rpgmenu` }
                ], sent || msg);
                return sent;
            }
            if (['aceptar', 'accept'].includes(subAction)) {
                if (currentClan.owner !== jid) return commandReply(sock, chatId, msg, 'clan', '❌ Solo el líder del clan puede aceptar una guerra.');
                const war = clanWarList(botData.clanWars).find(item => item.status === 'pending' && item.defender === currentKey);
                if (!war) return commandReply(sock, chatId, msg, 'clan', '❌ No tienes desafíos de guerra pendientes.');
                const challengerClan = botData.clans[war.challenger];
                const cooldownUntil = Math.max(Number(currentClan.warCooldownUntil) || 0, Number(challengerClan?.warCooldownUntil) || 0);
                if (cooldownUntil > Date.now()) return commandReply(sock, chatId, msg, 'clan', `⏳ Uno de los clanes debe descansar *${timeLeft(cooldownUntil - Date.now())}* antes de iniciar otra guerra.`);
                war.status = 'accepted';
                war.acceptedAt = new Date().toISOString();
                save();
                const sent = await commandReply(sock, chatId, msg, 'clan', `🛡️ *GUERRA ACEPTADA*\n\nEl líder puede resolver el combate con el botón o con:\n*${prefix}clan guerra combatir*`);
                await sendActionButtons(sock, chatId, '🛡️ Acciones de guerra:', [
                    { label: '⚔️ Resolver combate', command: `${prefix}clan guerra combatir` },
                    { label: '📜 Ver guerras', command: `${prefix}clan guerra` },
                    { label: '🏰 Info del clan', command: `${prefix}clan info` }
                ], sent || msg);
                return sent;
            }
            if (['combatir', 'resolver', 'fight', 'batalla'].includes(subAction)) {
                if (currentClan.owner !== jid) return commandReply(sock, chatId, msg, 'clan', '❌ Solo el líder puede iniciar el combate.');
                const war = clanWarList(botData.clanWars).find(item => item.status === 'accepted' && [item.challenger, item.defender].includes(currentKey));
                if (!war) return commandReply(sock, chatId, msg, 'clan', '❌ No tienes una guerra aceptada lista para combatir.');
                const challenger = botData.clans[war.challenger];
                const defender = botData.clans[war.defender];
                if (!challenger || !defender) return commandReply(sock, chatId, msg, 'clan', '❌ La guerra ya no es válida porque falta uno de los clanes.');
                const cooldownUntil = Math.max(Number(challenger.warCooldownUntil) || 0, Number(defender.warCooldownUntil) || 0);
                if (cooldownUntil > Date.now()) return commandReply(sock, chatId, msg, 'clan', `⏳ Uno de los clanes debe descansar *${timeLeft(cooldownUntil - Date.now())}* antes de resolver otra guerra.`);
                const challengerPower = clanPower(challenger);
                const defenderPower = clanPower(defender);
                const winner = challengerPower >= defenderPower ? challenger : defender;
                const loser = winner === challenger ? defender : challenger;
                const reward = 1500 + Math.min(10, Math.max(1, loser.members?.length || 1)) * 250;
                const xpReward = 100 + Math.min(10, Math.max(1, loser.members?.length || 1)) * 25;
                winner.coins = (Number(winner.coins) || 0) + reward;
                winner.xp = (Number(winner.xp) || 0) + xpReward;
                winner.level = clanLevel(winner);
                winner.wins = (Number(winner.wins) || 0) + 1;
                loser.losses = (Number(loser.losses) || 0) + 1;
                war.status = 'resolved';
                war.resolvedAt = new Date().toISOString();
                war.winner = clanKey(winner.name);
                war.challengerPower = challengerPower;
                war.defenderPower = defenderPower;
                const nextWarAt = Date.now() + CLAN_WAR_COOLDOWN;
                challenger.warCooldownUntil = nextWarAt;
                defender.warCooldownUntil = nextWarAt;
                save();
                const sent = await commandReply(sock, chatId, msg, 'clan', `🏆 *GUERRA RESUELTA*\n\n👑 Ganador: *${winner.name}*\n⚔️ Poder: *${winner === challenger ? challengerPower : defenderPower}*\n💥 Derrotado: *${loser.name}*\n\n🪙 Premio del clan: *${fmt(reward)} ${COIN}* (solo tesorería)\n⭐ XP del clan: *+${fmt(xpReward)}*\n📈 Nivel de ${winner.name}: *${winner.level}*\n🏆 Victorias: *${winner.wins}*\n⏳ Próxima guerra: en 6 horas.`);
                await sendActionButtons(sock, chatId, '🏆 Sigue la aventura del clan:', [
                    { label: '🏰 Info del clan', command: `${prefix}clan info` },
                    { label: '📜 Ver guerras', command: `${prefix}clan guerra` },
                    { label: '🗂️ Menú RPG', command: `${prefix}rpgmenu` }
                ], sent || msg);
                return sent;
            }
            const wars = clanWarList(botData.clanWars).filter(war => [war.challenger, war.defender].includes(currentKey));
            const listing = wars.length ? wars.map(war => `⚔️ ${botData.clans[war.challenger]?.name || war.challenger} vs ${botData.clans[war.defender]?.name || war.defender} · *${war.status}*`).join('\n') : 'No tienes guerras pendientes.';
            const sent = await commandReply(sock, chatId, msg, 'clan', `⚔️ *GUERRAS DE CLANES*\n\n${listing}\n\nDesafiar: *${prefix}clan guerra desafiar <clan>*\nAceptar: *${prefix}clan guerra aceptar*\nCombatir: *${prefix}clan guerra combatir*`);
            await sendActionButtons(sock, chatId, '⚔️ Navegación de clan:', [
                { label: '🏰 Info del clan', command: `${prefix}clan info` },
                { label: '📋 Ver clanes', command: `${prefix}clan` },
                { label: '🗂️ Menú RPG', command: `${prefix}rpgmenu` }
            ], sent || msg);
            return sent;
        }
        if (['crear', 'create'].includes(action)) {
            const displayName = args.slice(1).join(' ').trim().slice(0, 20);
            const key = clanKey(displayName);
            if (!key) return commandReply(sock, chatId, msg, 'clan', `ℹ️ Uso: *${prefix}clan crear <nombre>*`);
            if (currentClan) return commandReply(sock, chatId, msg, 'clan', `❌ Ya perteneces al clan *${currentClan.name}*.`);
            if (botData.clans[key]) return commandReply(sock, chatId, msg, 'clan', '❌ Ese nombre de clan ya está ocupado.');
            const creationCost = 10000;
            if (user.coins < creationCost) return commandReply(sock, chatId, msg, 'clan', `❌ Crear un clan cuesta *${fmt(creationCost)} ${COIN}*.`);
            user.coins -= creationCost;
            botData.clans[key] = { name: displayName, owner: jid, members: [jid], xp: 0, level: 1, coins: 0, wins: 0, losses: 0, createdAt: new Date().toISOString() };
            const unlocked = addStat(user, 'clansCreated', 1);
            save();
            return commandReply(sock, chatId, msg, 'clan', `⚔️ *Clan creado*\n\n🏰 Nombre: *${displayName}*\n💸 Costo: *${fmt(creationCost)} ${COIN}*\n👥 Miembros: *1*${achievementText(unlocked)}`);
        }
        if (['unirse', 'join'].includes(action)) {
            const clan = findClan(botData.clans, args.slice(1).join(' '));
            if (!clan) return commandReply(sock, chatId, msg, 'clan', `❌ Clan no encontrado. Usa *${prefix}clan* para ver la lista.`);
            if (currentClan) return commandReply(sock, chatId, msg, 'clan', `❌ Ya perteneces al clan *${currentClan.name}*.`);
            clan.members ||= [];
            clan.members.push(jid);
            save();
            return commandReply(sock, chatId, msg, 'clan', `✅ Te uniste al clan *${clan.name}*.\n👥 Miembros: *${clan.members.length}*`);
        }
        if (['salir', 'leave'].includes(action)) {
            if (!currentClan) return commandReply(sock, chatId, msg, 'clan', '❌ No perteneces a ningún clan.');
            currentClan.members = currentClan.members.filter(member => member !== jid);
            if (currentClan.owner === jid) {
                if (currentClan.members.length) currentClan.owner = currentClan.members[0];
                else delete botData.clans[clanKey(currentClan.name)];
            }
            save();
            return commandReply(sock, chatId, msg, 'clan', `👋 Saliste del clan *${currentClan.name}*.`);
        }
        if (['info', 'informacion'].includes(action)) {
            const clan = findClan(botData.clans, args.slice(1).join(' ')) || currentClan;
            if (!clan) return commandReply(sock, chatId, msg, 'clan', '❌ No se encontró ese clan.');
            clan.xp = Number(clan.xp) || 0;
            clan.level = clanLevel(clan);
            clan.coins = Number(clan.coins) || 0;
            const sent = await commandReply(sock, chatId, msg, 'clan', `🏰 *CLAN ${clan.name.toUpperCase()}*\n\n👑 Líder: @${numberOf(clan.owner)}\n👥 Miembros: *${clan.members.length}*\n⭐ Nivel: *${clan.level}* · XP: *${fmt(clan.xp)}*\n🪙 Tesorería: *${fmt(clan.coins)} ${COIN}*\n🏆 Victorias: *${clan.wins || 0}* · Derrotas: *${clan.losses || 0}*\n📅 Creado: *${new Date(clan.createdAt).toLocaleDateString('es-ES')}*`, { mentions: [clan.owner, ...clan.members] });
            await sendActionButtons(sock, chatId, '🏰 Acciones del clan:', [
                { label: '⚔️ Guerras', command: `${prefix}clan guerra` },
                { label: '📋 Ver clanes', command: `${prefix}clan` },
                { label: '🗂️ Menú RPG', command: `${prefix}rpgmenu` }
            ], sent || msg);
            return sent;
        }
        const clans = clanList(botData.clans);
        const listing = clans.length ? clans.slice(0, 10).map((clan, index) => `${index + 1}. 🏰 *${clan.name}* — ${clan.members.length} miembros`).join('\n') : 'Todavía no hay clanes creados.';
        const sent = await commandReply(sock, chatId, msg, 'clan', `⚔️ *CLANES*\n\n${listing}\n\nCrear: *${prefix}clan crear <nombre>*\nUnirse: *${prefix}clan unirse <nombre>*\nSalir: *${prefix}clan salir*\nInfo: *${prefix}clan info [nombre]*\nGuerra: *${prefix}clan guerra desafiar <clan>*`);
        await sendActionButtons(sock, chatId, '⚔️ Accesos de clan:', [
            { label: '🏰 Mi clan', command: `${prefix}clan info` },
            { label: '⚔️ Guerras', command: `${prefix}clan guerra` },
            { label: '🗂️ Menú RPG', command: `${prefix}rpgmenu` }
        ], sent || msg);
        return sent;
    }

    if (canonical === 'coinTop') {
        const wealth = new Map();
        for (const group of Object.values(botData.economy || {})) {
            for (const [key, value] of Object.entries(group?.users || {})) {
                const total = Math.max(0, Number(value.coins) || 0) + Math.max(0, Number(value.bank) || 0);
                wealth.set(numberOf(key), (wealth.get(numberOf(key)) || 0) + total);
            }
        }
        const rows = [...wealth.entries()].filter(([, total]) => total > 0).sort((a, b) => b[1] - a[1]);
        if (!rows.length) return reply(sock, chatId, msg, '🏆 Todavía no hay jugadores con monedas de oro registrados.');
        const text = rows.slice(0, 10).map(([number, total], index) => `${index + 1}. @${number} — *${fmt(total)} ${COIN}*`).join('\n');
        return reply(sock, chatId, msg, `🏆 *SALÓN DE LA FAMA DEL REINO*\n\n👥 Jugadores con monedas de oro: *${rows.length}*\n\n${text}`, { mentions: rows.slice(0, 10).map(([number]) => `${number}@s.whatsapp.net`) });
    }

    if (canonical === 'balance') {
        const target = getTarget(msg, q, state, botData) || { key: jid, user };
        const total = (target.user.coins || 0) + (target.user.bank || 0);
        return commandReply(sock, chatId, msg, 'balance', `🧙 *FICHA DEL AVENTURERO @${numberOf(target.key)}*\n\n🪙 Bolsa: *${fmt(target.user.coins)} ${COIN}*\n🏦 Cofre del gremio: *${fmt(target.user.bank)} ${COIN}*\n💎 Patrimonio total: *${fmt(total)} ${COIN}*`, { mentions: [target.key] });
    }
    if (canonical === 'baltop') {
        const page = Math.max(1, Number(args[0]) || 1);
        const entries = Object.entries(state.users).map(([key, value]) => ({ key, total: (value.coins || 0) + (value.bank || 0) })).filter(x => x.total > 0).sort((a, b) => b.total - a.total);
        if (!entries.length) return reply(sock, chatId, msg, '🏆 Todavía no hay cuentas con saldo en este grupo.');
        const pages = Math.max(1, Math.ceil(entries.length / 10));
        const rows = entries.slice((page - 1) * 10, page * 10);
        if (!rows.length) return reply(sock, chatId, msg, `❌ Página inválida. Usa una página entre 1 y ${pages}.`);
        const text = rows.map((x, i) => `${(page - 1) * 10 + i + 1}. @${numberOf(x.key)} — *${fmt(x.total)} ${COIN}*`).join('\n');
        const rankingText = `🏆 *RANKING DE AVENTUREROS*\n\n${text}\n\n_Página ${page}/${pages}_`;
        const sent = await reply(sock, chatId, msg, rankingText, { mentions: rows.map(x => x.key) });
        if (pages > 1) {
            const buttons = [];
            if (page > 1) buttons.push({ label: '◀️ Anterior', command: `${prefix}baltop ${page - 1}` });
            if (page < pages) buttons.push({ label: 'Siguiente ▶️', command: `${prefix}baltop ${page + 1}` });
            await sendActionButtons(sock, chatId, '🏆 Navega por el ranking:', buttons, sent || msg);
        }
        return sent;
    }
    if (canonical === 'loan') {
        const action = String(args[0] || 'estado').toLowerCase();
        const loan = user.loan;
        if (loan && !loan.paid && Date.now() > Number(loan.dueAt) && !loan.defaulted) {
            loan.total = Math.ceil(Number(loan.total) * 1.10);
            loan.defaulted = true;
            save();
        }
        if (['estado', 'status', 'ver'].includes(action)) {
            if (!loan || loan.paid) return reply(sock, chatId, msg, '🏦 No tienes un préstamo activo.\n\nSolicita uno con *.prestamo <cantidad>*.\nLímite: *20.000 monedas* · Interés: *20%* · Plazo: *7 días*');
            return reply(sock, chatId, msg, `🏦 *PRÉSTAMO ACTIVO*\n\n🪙 Recibido: *${fmt(loan.principal)} ${COIN}*\n💳 Total a devolver: *${fmt(loan.total)} ${COIN}*\n📅 Vence: *${new Date(loan.dueAt).toLocaleDateString('es-ES')}*${loan.defaulted ? '\n⚠️ Se aplicó un recargo del 10% por vencimiento.' : ''}\n\nPaga con: *.prestamo pagar <cantidad|todo>*`);
        }
        if (['pagar', 'pago', 'repay'].includes(action)) {
            if (!loan || loan.paid) return reply(sock, chatId, msg, '✅ No tienes un préstamo pendiente.');
            const requested = amount(args[1]);
            if (!requested) return reply(sock, chatId, msg, `ℹ️ Uso: *${prefix}prestamo pagar <cantidad|todo>*`);
            const payment = Math.min(requested === 'all' ? loan.total : requested, loan.total, user.coins);
            if (payment < 1) return reply(sock, chatId, msg, '❌ No tienes monedas suficientes para realizar un pago.');
            user.coins -= payment;
            loan.total -= payment;
            if (loan.total <= 0) { loan.total = 0; loan.paid = true; loan.paidAt = new Date().toISOString(); }
            save();
            return reply(sock, chatId, msg, `${loan.paid ? '✅ *PRÉSTAMO PAGADO COMPLETAMENTE*' : '💳 *PAGO REGISTRADO*'}\n\n🪙 Pago: *${fmt(payment)} ${COIN}*\n${loan.paid ? '🎉 Ya no tienes deuda.' : `📌 Saldo pendiente: *${fmt(loan.total)} ${COIN}*`}`);
        }
        const requested = amount(args[0]);
        const maxLoan = 20000;
        if (loan && !loan.paid) return reply(sock, chatId, msg, `❌ Ya tienes un préstamo activo de *${fmt(loan.total)} ${COIN}*. Usa *.prestamo estado* o *.prestamo pagar todo*.`);
        if (!requested || requested === 'all' || requested < 1000 || requested > maxLoan) return reply(sock, chatId, msg, `ℹ️ Uso: *${prefix}prestamo <cantidad>*\nMínimo: *1.000* · Máximo: *${fmt(maxLoan)} ${COIN}*\nInterés: *20%* · Plazo: *7 días*`);
        const principal = requested;
        user.coins += principal;
        user.loan = { principal, total: Math.ceil(principal * 1.20), createdAt: new Date().toISOString(), dueAt: Date.now() + 7 * 86400000, paid: false, defaulted: false };
        save();
        return reply(sock, chatId, msg, `🏦 *PRÉSTAMO APROBADO*\n\n🪙 Recibiste: *${fmt(principal)} ${COIN}*\n💳 Devolverás: *${fmt(user.loan.total)} ${COIN}*\n📅 Vencimiento: *${new Date(user.loan.dueAt).toLocaleDateString('es-ES')}*\n\nUsa *.prestamo estado* para consultar o *.prestamo pagar todo* para liquidarlo.`);
    }
    if (canonical === 'daily') {
        const wait = cooldown(user, 'lastDaily', 24 * 60 * 60 * 1000);
        if (wait) {
            const sent = await reply(sock, chatId, msg, `⏳ Ya recibiste tu recompensa del gremio. Regresa en *${timeLeft(wait)}*.`);
            return withRpgActions(sent, [
                { label: '⏱️ Tiempos', command: `${prefix}einfo` },
                { label: '📜 Misiones', command: `${prefix}misiones` },
                { label: '🗂️ Menú RPG', command: `${prefix}rpgmenu` }
            ]);
        }
        const previousDay = Number(user.lastDaily) ? new Date(Number(user.lastDaily)).toISOString().slice(0, 10) : '';
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const streak = previousDay === yesterday ? (Number(user.streak) || 0) + 1 : 1;
        const reward = 500 + Math.min(9, Math.max(0, streak - 1)) * 50;
        Object.assign(user, { coins: user.coins + reward, streak, lastDaily: Date.now() });
        const progress = grantActivityProgress('daily', 5, false);
        save();
        const sent = await reply(sock, chatId, msg, `🎁 El gremio te entregó *${fmt(reward)} ${COIN}* por completar tu recompensa diaria.\n🔥 Racha actual: *${streak} días* (bono diario limitado)\n💰 Bolsa: *${fmt(user.coins)} ${COIN}*${progress.extraText}\n\n${recommendedNextStep(user, prefix)}`);
        return withRpgActions(sent, [
            { label: '📜 Misiones', command: `${prefix}misiones` },
            { label: '💼 Trabajar', command: `${prefix}work` },
            { label: '🗂️ Menú RPG', command: `${prefix}rpgmenu` }
        ]);
    }
    if (canonical === 'work' || canonical === 'crime' || canonical === 'slut') {
        const config = canonical === 'work' ? { key: 'lastWork', wait: 60e3, gain: [100, 300], loss: [100, 500], chance: .25, label: 'trabajo' } : canonical === 'crime' ? { key: 'lastCrime', wait: 5 * 60e3, gain: [250, 650], loss: [200, 700], chance: .25, label: 'crimen' } : { key: 'lastSlut', wait: 4 * 60e3, gain: [200, 500], loss: [150, 500], chance: .30, label: 'trabajo de riesgo' };
        const wait = cooldown(user, config.key, config.wait);
        if (wait) return reply(sock, chatId, msg, `⏳ Debes esperar *${timeLeft(wait)}* para volver a usar este comando.`);
        const dailyLimit = consumeAction(user, canonical, DAILY_ACTIVITY_LIMITS[canonical]);
        if (!dailyLimit.ok) return reply(sock, chatId, msg, `🛡️ Completaste las *${dailyLimit.limit} tareas diarias* de este oficio. Vuelve mañana para seguir ganando oro.`);
        const lost = Math.random() < config.chance;
        const range = config[ lost ? 'loss' : 'gain' ];
        const baseValue = Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
        const value = lost ? baseValue : Math.max(1, Math.floor(baseValue * classRewardMultiplier(user, canonical) * equipmentRewardMultiplier(user, canonical)));
        const real = lost ? Math.min(user.coins, value) : value;
        user.coins += lost ? -real : real;
        user[config.key] = Date.now();
        const progress = grantActivityProgress(canonical, 5);
        save();
        const activity = randomJob(user, canonical, lost ? 'loss' : 'gain');
        const sent = await reply(sock, chatId, msg, lost ? `💥 ${activity} *${fmt(real)} ${COIN}*.\n🪙 Bolsa del aventurero: *${fmt(user.coins)} ${COIN}*${progress.extraText}` : `✅ ${activity} *${fmt(real)} ${COIN}*.\n🪙 Bolsa del aventurero: *${fmt(user.coins)} ${COIN}*${classAdvantageText(user, canonical)}${equipmentAdvantageText(user, canonical)}${progress.extraText}`);
        return withRpgActions(sent, [
            { label: '📜 Misiones', command: `${prefix}misiones` },
            { label: '⛏️ Oficios', command: `${prefix}minar` },
            { label: '🗂️ Menú RPG', command: `${prefix}rpgmenu` }
        ]);
    }
    if (canonical === 'deposit' || canonical === 'withdraw') {
        const input = amount(args[0]);
        if (input === null) return commandReply(sock, chatId, msg, canonical, `ℹ️ Uso: *${prefix}${HELP[canonical]}*`);
        const available = canonical === 'deposit' ? user.coins : user.bank;
        const value = input === 'all' ? available : input;
        if (!value || value > available) return commandReply(sock, chatId, msg, canonical, `❌ No tienes suficientes monedas en tu bolsa o cofre.`);
        if (canonical === 'deposit') { user.coins -= value; user.bank += value; } else { user.bank -= value; user.coins += value; }
        save(); return commandReply(sock, chatId, msg, canonical, `${canonical === 'deposit' ? '🏦 Guardaste en el cofre' : '💳 Retiraste del cofre'} *${fmt(value)} ${COIN}*.\n🪙 Bolsa: *${fmt(user.coins)} ${COIN}* · Cofre: *${fmt(user.bank)} ${COIN}*`);
    }
    if (canonical === 'pay') {
        const target = getTarget(msg, q, state, botData);
        const value = amount(args[0]);
        if (!target || !value || value === 'all') return reply(sock, chatId, msg, `ℹ️ Uso: *${prefix}${HELP.pay}*`);
        if (target.key === jid) return reply(sock, chatId, msg, '❌ No puedes transferirte a ti mismo.');
        if (value < 1000 || user.bank < value) return reply(sock, chatId, msg, `❌ Necesitas al menos 1.000 ${COIN} en el banco para transferir.`);
        const guard = dailyGuard(user);
        const recipientCount = Number(guard.recipients[target.key]) || 0;
        if (recipientCount >= ECONOMY_LIMITS.sameRecipient) {
            economyAlert(botData, 'recipient_limit', jid, { target: target.key, count: recipientCount });
            save();
            return reply(sock, chatId, msg, `🛡️ Alcanzaste el límite diario de transferencias al mismo jugador (*${ECONOMY_LIMITS.sameRecipient} envíos*). Vuelve mañana.`);
        }
        if (!consumeDailyLimit(botData, user, jid, 'transferCoins', value, ECONOMY_LIMITS.transferCoins, 'transfer_limit', { target: target.key })) {
            save();
            return reply(sock, chatId, msg, `🛡️ Alcanzaste el límite diario de transferencias (*${fmt(ECONOMY_LIMITS.transferCoins)} ${COIN}*). Vuelve mañana.`);
        }
        if (!consumeDailyLimit(botData, user, jid, 'transferCount', 1, ECONOMY_LIMITS.transferCount, 'transfer_count_limit', { target: target.key })) {
            guard.transferCoins = Math.max(0, (Number(guard.transferCoins) || 0) - value);
            save();
            return reply(sock, chatId, msg, `🛡️ Alcanzaste el máximo de *${ECONOMY_LIMITS.transferCount} transferencias diarias*. Vuelve mañana.`);
        }
        guard.recipients[target.key] = recipientCount + 1;
        const tax = Math.max(MIN_TRANSFER_TAX, Math.ceil(value * TRANSFER_TAX_RATE));
        const received = value - tax;
        user.bank -= value;
        target.user.bank = (target.user.bank || 0) + received;
        botData.economyStats ||= { transferTaxes: 0, transferCount: 0 };
        botData.economyStats.transferTaxes = (Number(botData.economyStats.transferTaxes) || 0) + tax;
        botData.economyStats.transferCount = (Number(botData.economyStats.transferCount) || 0) + 1;
        save();
        return reply(sock, chatId, msg, `🤝 Entregaste *${fmt(value)} ${COIN}* a @${numberOf(target.key)}.\n🏛️ Tasa del reino: *${fmt(tax)} ${COIN}* (5%)\n📥 Recibido: *${fmt(received)} ${COIN}*`, { mentions: [target.key] });
    }
    if (canonical === 'coinflip' || canonical === 'roulette') {
        const value = amount(args[0]) === 'all' ? user.coins : amount(args[0]);
        if (!value || value < MIN_BET || value > user.coins) return reply(sock, chatId, msg, `ℹ️ Uso: *${prefix}${HELP[canonical]}* (mínimo ${MIN_BET} ${COIN})`);
        let won;
        if (canonical === 'coinflip') {
            won = Math.random() < .5;
        } else {
            const color = String(args[1] || '').toLowerCase();
            if (!['rojo', 'red', 'negro', 'black'].includes(color)) return reply(sock, chatId, msg, `ℹ️ Uso: *${prefix}${HELP.roulette}* (rojo/negro)`);
            const result = Math.random() < .5 ? 'rojo' : 'negro';
            won = (color === 'rojo' || color === 'red') === (result === 'rojo');
        }
        if (!consumeDailyLimit(botData, user, jid, 'gamblingStake', value, ECONOMY_LIMITS.gamblingStake, 'gambling_limit', { game: canonical, stake: value })) {
            save();
            return reply(sock, chatId, msg, `🛡️ Alcanzaste el límite diario de apuestas de taberna (*${fmt(ECONOMY_LIMITS.gamblingStake)} ${COIN}*). Vuelve mañana.`);
        }
        if (won) user.coins += value; else user.coins -= value;
        save(); return reply(sock, chatId, msg, won ? `🎉 ¡El destino favoreció tu tirada! Ganaste *${fmt(value)} ${COIN}*.` : `💥 La suerte te abandonó en la taberna. Perdiste *${fmt(value)} ${COIN}*.`);
    }
    if (canonical === 'steal') {
        const target = getTarget(msg, q, state, botData);
        if (!target) return reply(sock, chatId, msg, `ℹ️ Uso: *${prefix}${HELP.steal}*`);
        if (target.key === jid) return reply(sock, chatId, msg, '❌ No puedes robarte a ti mismo.');
        const wait = cooldown(user, 'lastRob', 10 * 60e3);
        if (wait) return reply(sock, chatId, msg, `⏳ Espera *${timeLeft(wait)}* para volver a intentarlo.`);
        if (!target.user.lastSeen || Date.now() - target.user.lastSeen < 60 * 60e3) return reply(sock, chatId, msg, '🛡️ Solo puedes robar a alguien que lleve más de una hora inactivo.');
        const stolen = Math.min(target.user.coins, Math.max(100, Math.floor(target.user.coins * (.1 + Math.random() * .2))));
        user.lastRob = Date.now();
        if (Math.random() < .5 && stolen > 0) { target.user.coins -= stolen; user.coins += stolen; save(); return reply(sock, chatId, msg, `🦹 Como pícaro, robaste *${fmt(stolen)} ${COIN}* a @${numberOf(target.key)}.`, { mentions: [target.key] }); }
        const fine = Math.min(user.coins, Math.floor(Math.random() * 4000) + 1000); user.coins -= fine; save(); return reply(sock, chatId, msg, `⚖️ Los guardias del reino te atraparon y perdiste *${fmt(fine)} ${COIN}*.`);
    }
    if (canonical === 'einfo') {
        const cooldownRows = [
            ['Trabajo', 'lastWork', 60e3], ['Crimen', 'lastCrime', 5 * 60e3], ['Golpe', 'lastRob', 10 * 60e3],
            ['Daily', 'lastDaily', 24 * 60 * 60e3], ['Trovador', 'lastSlut', 4 * 60e3],
            ['Explorar', 'lastExplore', 75e3], ['Recolectar', 'lastGather', 60e3], ['Patrullar', 'lastPatrol', 120e3],
            ['Minar', 'lastMine', 45e3], ['Pescar', 'lastFish', 60e3], ['Cazar', 'lastHunt', 50e3]
        ].map(([label, key, ms]) => {
            const remaining = cooldown(user, key, ms);
            return `• ${label}: ${remaining ? timeLeft(remaining) : 'disponible'}`;
        }).join('\n');
        const actions = user.rpg?.featureState?.actions || {};
        const limitRows = Object.entries(DAILY_ACTIVITY_LIMITS).map(([key, limit]) => `• ${key}: *${Math.min(limit, Number(actions[key]) || 0)}/${limit}*`).join('\n');
        const dungeon = ensureDungeonState(user);
        const sent = await reply(sock, chatId, msg, `⏱️ *TIEMPOS Y CUPOS DEL AVENTURERO*\n\n⚡ Energía: *${user.rpg.energy}/${user.rpg.maxEnergy}* (regenera 2 por minuto)\n\n*Recargas*\n${cooldownRows}\n\n*Cupos de hoy*\n${limitRows}\n🏰 Mazmorra: *${Math.min(3, Number(dungeon.runs) || 0)}/3*`);
        await sendActionButtons(sock, chatId, '🧭 Continúa tu aventura:', [
            { label: '🗂️ Menú RPG', command: `${prefix}rpgmenu` },
            { label: '🎒 Inventario', command: `${prefix}inventario` },
            { label: '🧑‍🌾 Mercader', command: `${prefix}mercader` }
        ], sent || msg);
        return sent;
    }
}

module.exports = runEconomy;
module.exports.aliases = ALIASES;
module.exports.menu = menu;
module.exports.premiumShopPackages = PREMIUM_SHOP_PACKAGES;
module.exports.achievements = ACHIEVEMENTS.map(({ id, title, reward }) => ({ id, title, reward }));
module.exports.items = Object.fromEntries(Object.entries(MERCHANT_ITEMS).map(([key, item]) => [key, { name: item.name, durability: item.durability }]));
