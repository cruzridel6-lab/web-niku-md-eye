const profileCommand = require('./profile');
const { handleExpansion, ensureRpg, updateTitles, activateWelcomeMission } = require('../lib/rpgExpansion');
const { classImagePath, shopImagePath, dungeonImagePath, sendImageCaption } = require('../lib/rpgMedia');
const COIN = '🪙 Niku Coins';
const MIN_BET = 200;
const INVESTMENT_DURATION = 5 * 60 * 1000;
const MIN_INVESTMENT = 500;
const MAX_INVESTMENT = 20000;
const TRANSFER_TAX_RATE = 0.05;
const MIN_TRANSFER_TAX = 25;
const ECONOMY_LIMITS = {
    transferCoins: 50000,
    transferCount: 10,
    duelStake: 20000,
    gamblingStake: 10000,
    sameRecipient: 8
};
const RPG_LEVEL_XP = level => Math.max(0, (level - 1) * (level - 1) * 100);
const MINING_REWARDS = [120, 180, 250, 400, 650, 900, 1400];
const FISHING_REWARDS = [100, 160, 240, 350, 500, 800, 1200];
const HUNTING_REWARDS = [180, 260, 380, 550, 800, 1100, 1600];
const DUNGEON_REWARDS = [700, 900, 1200, 1600, 2200];
const EXPLORATION_REWARDS = [250, 350, 500, 700, 1000];
const GATHERING_REWARDS = [180, 280, 420, 600, 850];
const MERCHANT_ITEMS = {
    pico: { name: '⛏️ Pico', price: 2500, durability: 15, aliases: ['pico', 'pickaxe'] },
    espada: { name: '⚔️ Espada', price: 3000, durability: 12, aliases: ['espada', 'sword'] },
    cana: { name: '🎣 Caña de pescar', price: 2200, durability: 15, aliases: ['cana', 'caña', 'vara', 'rod'] }
};
const CHARACTER_CLASSES = {
    guerrero: { label: '⚔️ Guerrero', description: 'Resistente y experto en combate cuerpo a cuerpo.', advantage: 'obtiene +25% de monedas en las misiones de .work.' },
    mago: { label: '🔮 Mago', description: 'Dominador de hechizos, sabiduría y poder arcano.', advantage: 'recibe +15% de monedas al completar trabajos mágicos.' },
    picaro: { label: '🗡️ Pícaro', description: 'Ágil, sigiloso y experto en golpes precisos.', advantage: 'obtiene +30% de botín en .crime y +10% en .work.' },
    tirador: { label: '🏹 Tirador', description: 'Especialista en ataques a distancia, puntería y cacería.', advantage: 'obtiene +30% de recompensa al .cazar y +15% en encargos.' }
};
const CLASS_EQUIPMENT = {
    guerrero: [
        { id: 'mandoble_dragon', name: '⚔️ Mandoble del Dragón', price: 28000, bonus: 0.10, activities: ['work', 'dungeon', 'raid'] },
        { id: 'armadura_coloso', name: '🛡️ Armadura del Coloso', price: 32000, bonus: 0.12, activities: ['work', 'dungeon', 'raid'] }
    ],
    mago: [
        { id: 'grimorio_arcano', name: '📖 Grimorio Arcano', price: 30000, bonus: 0.12, activities: ['work', 'explore', 'raid'] },
        { id: 'tunica_astral', name: '🔮 Túnica Astral', price: 35000, bonus: 0.12, activities: ['work', 'dungeon', 'raid'] }
    ],
    picaro: [
        { id: 'dagas_sombra', name: '🗡️ Dagas de la Sombra', price: 29000, bonus: 0.12, activities: ['work', 'crime', 'raid'] },
        { id: 'capa_niebla', name: '🥷 Capa de la Niebla', price: 34000, bonus: 0.10, activities: ['crime', 'steal', 'raid'] }
    ],
    tirador: [
        { id: 'arco_fenix', name: '🏹 Arco del Fénix', price: 31000, bonus: 0.12, activities: ['work', 'hunt', 'raid'] },
        { id: 'visor_halcon', name: '🦅 Visor del Halcón', price: 36000, bonus: 0.12, activities: ['hunt', 'crime', 'raid'] }
    ]
};
const DUNGEON_LOOT = [
    { id: 'gema_lunar', name: '💎 Gema lunar', sellPrice: 4500 },
    { id: 'colmillo_dragon', name: '🦷 Colmillo de dragón', sellPrice: 6500 },
    { id: 'runa_antigua', name: '🔯 Runa antigua', sellPrice: 8000 },
    { id: 'corazon_golem', name: '🪨 Corazón de gólem', sellPrice: 10000 },
    { id: 'pergamino_perdido', name: '📜 Pergamino perdido', sellPrice: 12000 }
];
const RAID_BOSSES = {
    dragon_ancestral: { name: '🐉 Dragón Ancestral', hp: 24000, reward: 60000, xp: 180, description: 'Una bestia milenaria que respira fuego sobre todo el grupo.' },
    titan_abismal: { name: '🗿 Titán Abismal', hp: 30000, reward: 80000, xp: 220, description: 'Un coloso de piedra que no cae ante un solo aventurero.' },
    reina_nigromante: { name: '👑 Reina Nigromante', hp: 27000, reward: 72000, xp: 200, description: 'Señora de los muertos y maestra de las maldiciones.' }
};
const RAID_TITLES = {
    dragon_ancestral: '🐉 Matadragones ancestral',
    titan_abismal: '🗿 Rompe-titanes del abismo',
    reina_nigromante: '👑 Caudillo de la muerte'
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
    market: ['market', 'mercadojugadores', 'subasta'],
    season: ['season', 'temporada', 'rankingtemporada'],
    skills: ['skills', 'habilidades', 'talentos'],
    potion: ['potion', 'pocion', 'poción', 'curar'],
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
    merchant: ['mercader', 'mercado'],
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
    investment: ['invertir', 'inversion', 'inversión']
};
const PROFILE_RPG_COMMANDS = new Set(['registrarse', 'registrar', 'register', 'registro', 'profile', 'perfil', 'user', 'marry', 'casar', 'divorce', 'divorciar', 'history', 'historial', 'historialmatrimonial', 'marryhistory', 'pfp', 'getpfp', 'foto', 'avatar', 'setbio', 'setdescription', 'setdescperfil', 'setbirth', 'setcumple', 'setbirthday', 'setgenre', 'setgenero']);

const HELP = {
    balance: 'balance | bal', baltop: 'baltop [página]', coinflip: 'cf <cantidad>', crime: 'crime · encargo clandestino',
    daily: 'daily · recompensa del gremio', deposit: 'deposit <cantidad|all> · guardar en el cofre', einfo: 'einfo', pay: 'pay <cantidad> @usuario',
    roulette: 'rt <cantidad> <rojo|negro>', reward: 'regalo <token>', level: 'nivel', mine: 'minar', fish: 'pescar', hunt: 'cazar', merchant: 'mercader [pico|espada|cana]', repair: 'reparar', explore: 'explorar', gather: 'recolectar', patrol: 'patrullar', dungeon: 'mazmorra', mission: 'misiones [nueva]', achievements: 'logros', clan: 'clan <crear|unirse|salir|info|guerra>', coinTop: 'nikutop', slut: 'slut', steal: 'rob @usuario',
    withdraw: 'with <cantidad|all> · sacar del cofre', work: 'work · misión del gremio', investment: 'invertir <cantidad> · inversión de 5 minutos', characterClass: 'clase <guerrero|mago|picaro>', raid: 'raid <crear|unirse|atacar|estado>', combat: 'combate <iniciar|atacar|habilidad|defender|huir>', inventory: 'inventario', craft: 'fabricar [pocion|espada_hierro|armadura>', quest: 'campaña [nueva|reclamar]', title: 'titulos', market: 'mercado <ver|publicar|comprar>', season: 'temporada', skills: 'habilidades', potion: 'pocion', rpgstatus: 'estadisticas'
};

function fmt(value) { return Number(value || 0).toLocaleString('es-ES'); }
function reply(sock, chatId, msg, text, extra = {}) {
    return sock.sendMessage(chatId, { text, ...extra }, { quoted: msg });
}
function getSender(msg, chatId) {
    return msg?.key?.participantAlt || msg?.key?.senderPn || msg?.key?.participant || (msg?.key?.fromMe ? msg?.key?.remoteJid : chatId);
}
function normalizeJid(jid) {
    return String(jid || '').split(':')[0].replace(/[^0-9@.a-z_-]/gi, '');
}
function numberOf(jid) { return normalizeJid(jid).split('@')[0]; }
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
    const jid = normalizeJid(sender);
    state.users[jid] ||= { coins: 0, bank: 0, lastSeen: 0 };
    const user = state.users[jid];
    user.coins = Math.max(0, Number(user.coins) || 0);
    user.bank = Math.max(0, Number(user.bank) || 0);
    user.lastSeen = Date.now();
    return { state, user, jid };
}
function findUser(state, jid) {
    const wanted = numberOf(jid);
    const key = Object.keys(state.users || {}).find(k => numberOf(k) === wanted);
    return key ? { key, user: state.users[key] } : null;
}
function getTarget(msg, q, state) {
    const context = getContext(msg);
    const raw = context.mentioned || context.quoted || (String(q || '').match(/@?\d{7,16}/)?.[0]);
    if (!raw) return null;
    return findUser(state, raw.replace(/^@/, '') + (raw.includes('@') ? '' : '@s.whatsapp.net'));
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
        tirador: { work: 1.15, crime: 1.15, hunt: 1.30 }
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
function equipmentForUser(user, id) {
    return classEquipment(user).find(item => item.id === id) || null;
}
function equipmentRewardMultiplier(user, activity) {
    const owned = user.equipment || {};
    return classEquipment(user).reduce((total, item) => total + (owned[item.id] && item.activities.includes(activity) ? item.bonus : 0), 1);
}
function equipmentAdvantageText(user, activity) {
    const percent = Math.round((equipmentRewardMultiplier(user, activity) - 1) * 100);
    return percent > 0 ? `\n⚔️ Equipamiento activo: *+${percent}% de recompensa*` : '';
}
function lootById(id) { return DUNGEON_LOOT.find(item => item.id === id); }
function raidClassMultiplier(user) {
    return ({ guerrero: 1.25, mago: 1.15, picaro: 1.20, tirador: 1.20 })[user.rpg?.class] || 1;
}
function raidTimeLeft(raid) { return timeLeft(Math.max(0, Number(raid.expiresAt) - Date.now())); }
function raidParticipantsText(raid) {
    return Object.values(raid.participants || {}).map(item => `• ${item.name || `Jugador ${numberOf(item.jid)}`}: *${fmt(item.damage)} daño*`).join('\n') || '• Nadie se ha unido todavía.';
}
function raidStatusText(raid, prefix) {
    const boss = RAID_BOSSES[raid.bossId];
    return `⚔️ *RAID: ${boss.name}*\n\n${boss.description}\n❤️ Jefe: *${fmt(Math.max(0, raid.hp))}/${fmt(raid.maxHp)} HP*\n⏳ Tiempo: *${raidTimeLeft(raid)}*\n👥 Participantes: *${Object.keys(raid.participants || {}).length}/8*\n\n${raidParticipantsText(raid)}\n\nÚnete: *${prefix}raid unirse*\nAtaca: *${prefix}raid atacar*`;
}
function grantRaidTitle(user, title) {
    const rpg = ensureRpg(user);
    rpg.titles ||= [];
    if (rpg.titles.includes(title)) return false;
    rpg.titles.push(title);
    return true;
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
    { id: 'first_steps', title: '🌱 Primeros pasos', test: s => s.commandsUsed >= 1, reward: 500 },
    { id: 'level_five', title: '⭐ Aventurero nivel 5', test: (s, u) => u.rpg.level >= 5, reward: 2000 },
    { id: 'miner', title: '⛏️ Minero incansable', test: s => s.mined >= 10, reward: 1500 },
    { id: 'angler', title: '🎣 Maestro pescador', test: s => s.fished >= 10, reward: 1500 },
    { id: 'hunter', title: '🏹 Cazador experto', test: s => s.hunted >= 10, reward: 1800 },
    { id: 'dungeon', title: '🏰 Explorador de mazmorras', test: s => s.dungeonKills >= 50, reward: 3000 },
    { id: 'mission', title: '📜 Cumplidor de misiones', test: s => s.missionsCompleted >= 1, reward: 2500 },
    { id: 'clan', title: '⚔️ Fundador de clan', test: s => s.clansCreated >= 1, reward: 2000 },
    { id: 'raid_dragon_ancestral', title: '🐉 Caída del Dragón Ancestral', test: s => Number(s.raidBosses?.dragon_ancestral) >= 1, reward: 10000 },
    { id: 'raid_titan_abismal', title: '🗿 El Titán se arrodilla', test: s => Number(s.raidBosses?.titan_abismal) >= 1, reward: 12000 },
    { id: 'raid_reina_nigromante', title: '👑 Silencio de la Reina Nigromante', test: s => Number(s.raidBosses?.reina_nigromante) >= 1, reward: 11000 }
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
            unlocked.push(`🏆 ${achievement.title} (+${fmt(achievement.reward)} Niku Coins)`);
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
    const wanted = String(value || '').trim().toLowerCase();
    return Object.entries(MERCHANT_ITEMS).find(([, item]) => item.aliases.includes(wanted))?.[0] || null;
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
        user.mission = { type: 'dungeon', target, progress: 0, reward: 12000 + Math.floor(Math.random() * 9001), createdAt: new Date().toISOString(), completed: false };
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
    return `╭───〔 ⚔️ ECONOMÍA RPG 〕───╮\n│\n│ 🧙 ${prefix}perfil · Ficha del aventurero\n│ 📝 ${prefix}registrarse nombre · Crear personaje\n│ 💰 ${prefix}balance · Bolsa del aventurero\n│ 🏆 ${prefix}baltop · Ranking de aventureros\n│ 🌍 ${prefix}nekotop · Top global de Neko Coins\n│ ⭐ ${prefix}nivel · Ver XP y nivel\n│ ⚔️ ${prefix}combate · Luchar contra enemigos\n│ 🐉 ${prefix}raid · Raid cooperativa contra jefes\n│ 🎒 ${prefix}inventario · Ver mochila y equipo\n│ ✨ ${prefix}habilidades · Habilidades de clase\n│ 🔨 ${prefix}fabricar · Crear objetos\n│ 🧭 ${prefix}tutorial · Guía del aventurero\n│ 📜 ${prefix}campaña · Misiones de historia\n│ 🛒 ${prefix}mercado · Mercado entre jugadores\n│ 🏛️ ${prefix}subastas · Casa de subastas RPG\n│ 🏷️ ${prefix}titulos · Títulos del aventurero\n│ 🏆 ${prefix}temporada · Ranking de temporada\n│ 🛡️ ${prefix}clase · Elegir personaje\n│ 🏆 ${prefix}logros · Ver logros\n│ 🧑‍🌾 ${prefix}mercader · Comprar herramientas\n│ 🧭 ${prefix}explorar · Explorar regiones\n│ 🌿 ${prefix}recolectar · Recolectar recursos\n│ 🛡️ ${prefix}patrullar · Patrullar el clan\n│ ⛏️ ${prefix}minar · Minería RPG\n│ 🎣 ${prefix}pescar · Pesca RPG\n│ 🏹 ${prefix}cazar · Caza RPG\n│ 🏰 ${prefix}mazmorra · Mazmorra diaria\n│ 🔧 ${prefix}reparar · Reparar mazmorra\n│ 📜 ${prefix}misiones · Ver misión\n│ ⚔️ ${prefix}clan · Clanes y guerras\n│ 🎁 ${prefix}daily · Recompensa del gremio\n│ 💼 ${prefix}work · Misión del gremio\n│ 🏦 ${prefix}deposit · Guardar en el cofre\n│ 💳 ${prefix}withdraw · Sacar del cofre\n│ 💸 ${prefix}pay · Entregar monedas\n│ 📈 ${prefix}invertir · Inversión de 5 minutos\n│ 🎰 ${prefix}coinflip · Fortuna de la taberna\n│ 🎡 ${prefix}roulette · Ruleta del reino\n│ 🕵️ ${prefix}crime · Encargo clandestino\n│ 🦹 ${prefix}rob · Golpe de pícaro\n│ 🎭 ${prefix}slut · Actuación del trovador\n│ 🎁 ${prefix}premio · Reclamar regalo\n│ 💍 ${prefix}marry · Forjar vínculo\n│ 📜 ${prefix}historial · Historial del personaje\n│ ⏱️ ${prefix}einfo · Tiempos de aventura\n│\n╰────────────────────────╯`;
}
function tutorialText(user, prefix = '.') {
    const mission = user.rpg?.welcomeMission;
    const missionLine = mission
        ? `${mission.claimed ? '✅' : '📍'} ${mission.title}: *${Math.min(Number(mission.progress) || 0, Number(mission.target) || 1)}/${mission.target}*${mission.claimed ? ' — completada' : `\n   ${mission.objective}`}`
        : '📍 Misión de bienvenida: elige una clase para activarla.';
    return `🧭 *TUTORIAL DEL AVENTURERO*\n\n1️⃣ *Completa tu personaje*\nUsa *${prefix}perfil* y elige tu clase con *${prefix}clase*.\n\n2️⃣ *Haz tu primer combate*\nUsa *${prefix}combate iniciar* y después *${prefix}combate atacar*.\n\n3️⃣ *Revisa tu progreso*\nConsulta *${prefix}nivel*, *${prefix}inventario* y *${prefix}logros*.\n\n4️⃣ *Explora el reino*\nPrueba *${prefix}misiones*, *${prefix}raid* y *${prefix}mercado*.\n\n🎯 *MISIÓN DE BIENVENIDA*\n${missionLine}\n🎁 Recompensa: *500 Niku Coins + 40 XP*\n\nEscribe *${prefix}tutorial* cuando necesites volver a esta guía.`;
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
    if (command === 'economy' || command === 'economymenu' || command === 'rpg' || command === 'rpgmenu' || command === 'economiarpg' || command === 'economyrpg') return reply(sock, chatId, msg, menu(prefix));
    if (PROFILE_RPG_COMMANDS.has(String(command || '').toLowerCase())) return profileCommand(sock, chatId, msg, command, q, botData, saveBotData, prefix);
    const canonical = Object.keys(ALIASES).find(key => ALIASES[key].includes(command)) || command;
    if (!ALIASES[canonical]) return reply(sock, chatId, msg, menu(prefix));
    const sender = getSender(msg, chatId);
    const { state, user, jid } = ensureState(botData, chatId, sender);
    const args = String(q || '').trim().split(/\s+/).filter(Boolean);
    const save = () => saveBotData();
    await resumeInvestmentsForChat(sock, chatId, botData, saveBotData);
    if (canonical === 'tutorial') return reply(sock, chatId, msg, tutorialText(user, prefix));
    const expansionCanonical = canonical === 'merchant' && ['ver', 'listado', 'publicar', 'comprar'].includes(String(args[0] || '').toLowerCase()) ? 'market' : canonical;
    const expansionResult = await handleExpansion({ sock, chatId, msg, canonical: expansionCanonical, args, user, jid, botData, save, prefix });
    if (expansionResult) return expansionResult;
    const mention = [jid];
    const commandAchievements = addStat(user, 'commandsUsed', 1);
    const xpEvent = addXp(user, (canonical === 'mine' || canonical === 'fish') ? 20 : 5);
    if (xpEvent.gained || commandAchievements.length) save();

    if (canonical === 'investment') {
        botData.investments ||= {};
        const active = investmentForUser(botData, chatId, jid);
        if (active) return reply(sock, chatId, msg, `📈 Ya tienes una inversión en curso por *${fmt(active.amount)} ${COIN}*.\n⏳ Termina en aproximadamente *${timeLeft(Math.max(0, Number(active.resolvesAt) - Date.now()))}*.`);
        const requested = amount(args[0]);
        if (requested === 'all' || !requested) return reply(sock, chatId, msg, `ℹ️ Uso: *${prefix}${HELP.investment}*\nMínimo: *${fmt(MIN_INVESTMENT)} ${COIN}* · Máximo: *${fmt(MAX_INVESTMENT)} ${COIN}*.`);
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
            if (duel.status !== 'pending' || now - Number(duel.createdAt) <= 10 * 60e3) continue;
            const challenger = findUser(state, duel.challenger);
            if (challenger) challenger.user.coins = (Number(challenger.user.coins) || 0) + Number(duel.stake || 0);
            delete duels[id];
            changed = true;
        }
        if (changed) save();
        const action = String(args[0] || '').toLowerCase();
        if (['historial', 'history', 'hist'].includes(action)) {
            if (!history.length) return reply(sock, chatId, msg, '📜 Todavía no hay duelos PvP registrados en este chat.');
            const rows = history.slice(0, 10).map((duel, index) => `${index + 1}. 🏆 @${numberOf(duel.winner)} venció a @${numberOf(duel.loser)} · *${fmt(duel.stake)} ${COIN}* · ${new Date(duel.resolvedAt).toLocaleDateString('es-ES')}`).join('\n');
            return reply(sock, chatId, msg, `📜 *HISTORIAL DE DUELOS PvP*\n\n${rows}\n\nMostrando los últimos ${Math.min(10, history.length)} duelos.`, { mentions: history.slice(0, 10).flatMap(duel => [duel.winner, duel.loser]) });
        }
        if (['ranking', 'rank', 'top', 'mejores'].includes(action)) {
            if (!history.length) return reply(sock, chatId, msg, '🏆 Todavía no hay resultados para crear un ranking.');
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
            return reply(sock, chatId, msg, `🏆 *RANKING PvP DEL CHAT*\n\n${text}\n\n_Ordenado por victorias, porcentaje y saldo neto._`, { mentions: rows.map(item => item.player) });
        }
        if (['aceptar', 'accept'].includes(action)) {
            const requestedChallenger = getTarget(msg, args.slice(1).join(' '), state);
            const pending = Object.values(duels).filter(duel => duel.status === 'pending' && duel.target === jid)
                .filter(duel => !requestedChallenger || duel.challenger === requestedChallenger.key)
                .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))[0];
            if (!pending) return reply(sock, chatId, msg, `❌ No tienes duelos pendientes. Usa *${prefix}duelo @usuario <cantidad>* para retar a alguien.`);
            const challenger = findUser(state, pending.challenger);
            const stake = Number(pending.stake) || 0;
            if (!challenger || stake < MIN_BET) { delete duels[pending.id]; save(); return reply(sock, chatId, msg, '❌ Ese duelo ya no es válido porque falta la cuenta del retador.'); }
            if (user.coins < stake) return reply(sock, chatId, msg, `❌ Necesitas *${fmt(stake)} ${COIN}* para aceptar el duelo. Tienes *${fmt(user.coins)}*.`);
            if (!consumeDailyLimit(botData, user, jid, 'duelStake', stake, ECONOMY_LIMITS.duelStake, 'duel_limit', { stake, challenger: pending.challenger })) {
                save();
                return reply(sock, chatId, msg, `🛡️ Alcanzaste el límite diario de apuestas PvP (*${fmt(ECONOMY_LIMITS.duelStake)} ${COIN}*). Vuelve mañana.`);
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
            return reply(sock, chatId, msg, `⚔️ *DUELO PvP RESUELTO*\n\n🏆 Ganador: @${numberOf(winner.key)}\n💥 Derrotado: @${numberOf(loser)}\n🪙 Pozo ganado: *${fmt(stake * 2)} ${COIN}*\n📈 ELO del ganador: *${winnerRpg.pvp.elo}* (+${eloGain})\n🔥 Racha: *${winnerRpg.pvp.streak}*\n\n💰 Saldo del ganador: *${fmt(winner.account.coins)} ${COIN}*`, { mentions: [winner.key, loser] });
        }
        if (['cancelar', 'cancel', 'rechazar', 'reject'].includes(action)) {
            const pending = Object.values(duels).find(duel => duel.status === 'pending' && duel.challenger === jid);
            if (!pending) return reply(sock, chatId, msg, '❌ No tienes un duelo pendiente que cancelar.');
            user.coins += Number(pending.stake) || 0;
            delete duels[pending.id]; save();
            return reply(sock, chatId, msg, `↩️ Duelo cancelado. Se te devolvieron *${fmt(pending.stake)} ${COIN}*.`);
        }
        if (['estado', 'status', 'lista'].includes(action)) {
            const pending = Object.values(duels).filter(duel => duel.status === 'pending' && (duel.challenger === jid || duel.target === jid));
            if (!pending.length) return reply(sock, chatId, msg, '⚔️ No tienes duelos pendientes.');
            const text = pending.map(duel => `${duel.challenger === jid ? '📤 Retaste a' : '📥 Te retó'} @${numberOf(duel.challenger === jid ? duel.target : duel.challenger)} · *${fmt(duel.stake)} ${COIN}*`).join('\n');
            return reply(sock, chatId, msg, `⚔️ *DUELOS PENDIENTES*\n\n${text}\n\nAceptar: *${prefix}duelo aceptar*\nCancelar: *${prefix}duelo cancelar*`, { mentions: pending.flatMap(duel => [duel.challenger, duel.target]) });
        }
        const target = getTarget(msg, q, state);
        const stake = amount(args[args.length - 1]);
        if (!target || !stake || stake < MIN_BET) return reply(sock, chatId, msg, `ℹ️ Uso: *${prefix}${HELP.duel}*\nMínimo: *${fmt(MIN_BET)} ${COIN}*`);
        if (target.key === jid) return reply(sock, chatId, msg, '❌ No puedes retarte a ti mismo.');
        if (user.coins < stake) return reply(sock, chatId, msg, `❌ No tienes suficientes ${COIN}. Necesitas *${fmt(stake)}* y tienes *${fmt(user.coins)}*.`);
        if (Object.values(duels).some(duel => duel.status === 'pending' && (duel.challenger === jid || duel.target === jid))) return reply(sock, chatId, msg, '⚔️ Tú o ese jugador ya tienen un duelo pendiente.');
        if (!consumeDailyLimit(botData, user, jid, 'duelStake', stake, ECONOMY_LIMITS.duelStake, 'duel_limit', { stake, target: target.key })) {
            save();
            return reply(sock, chatId, msg, `🛡️ Alcanzaste el límite diario de apuestas PvP (*${fmt(ECONOMY_LIMITS.duelStake)} ${COIN}*). Vuelve mañana.`);
        }
        const id = `duel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        user.coins -= stake;
        duels[id] = { id, challenger: jid, target: target.key, stake, status: 'pending', createdAt: now };
        save();
        return reply(sock, chatId, msg, `⚔️ *DESAFÍO PvP ENVIADO*\n\n📤 @${numberOf(jid)} retó a @${numberOf(target.key)}\n🪙 Apuesta: *${fmt(stake)} ${COIN}*\n⏳ Expira en 10 minutos\n\n@${numberOf(target.key)}, acepta con *${prefix}duelo aceptar*.\nEl retador puede cancelar con *${prefix}duelo cancelar*.`, { mentions: [jid, target.key] });
    }
    if (canonical === 'characterClass') {
        const requested = String(args[0] || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (!requested || !CHARACTER_CLASSES[requested]) {
            const options = Object.entries(CHARACTER_CLASSES).map(([key, value]) => `${value.label} — *${key}*\n${value.description}\n✨ Ventaja: ${value.advantage}`).join('\n\n');
            return reply(sock, chatId, msg, `🧙 *ELECCIÓN DE CLASE*\n\n${options}\n\nElige una clase con:\n*${prefix}clase guerrero*\n*${prefix}clase mago*\n*${prefix}clase picaro*\n*${prefix}clase tirador*`);
        }
        if (user.rpg.class) return reply(sock, chatId, msg, `🛡️ Tu personaje ya pertenece a la clase *${CHARACTER_CLASSES[user.rpg.class]?.label || user.rpg.class}*. La clase se elige una sola vez.`);
        user.rpg.class = requested;
        activateWelcomeMission(user);
        save();
        const selected = CHARACTER_CLASSES[requested];
        return sendImageCaption(sock, chatId, msg, classImagePath(requested), `🎉 *CLASE ELEGIDA*\n\n${selected.label}\n${selected.description}\n✨ Ventaja: ${selected.advantage}\n\n⭐ Nivel inicial: *${user.rpg.level}*\n✨ Experiencia: *${fmt(user.rpg.xp)} XP*\n\nTu clase aparecerá en *${prefix}perfil*.`);
    }

    if (canonical === 'raid') {
        state.raids ||= { active: null, history: [] };
        let raid = state.raids.active;
        if (raid && Number(raid.expiresAt) <= Date.now()) {
            state.raids.history ||= [];
            state.raids.history.push({ bossId: raid.bossId, status: 'expired', finishedAt: new Date().toISOString(), participants: Object.keys(raid.participants || {}).length });
            state.raids.history = state.raids.history.slice(-20);
            state.raids.active = null;
            raid = null;
            save();
        }
        const action = String(args[0] || 'estado').toLowerCase();
        if (action === 'jefes' || action === 'bosses' || action === 'boss') {
            const bosses = Object.entries(RAID_BOSSES).map(([id, boss]) => `👹 *${boss.name}* — *${id}*\n❤️ ${fmt(boss.hp)} HP · 🎁 ${fmt(boss.reward)} ${COIN}\n${boss.description}`).join('\n\n');
            return reply(sock, chatId, msg, `👑 *JEFES ÉPICOS DISPONIBLES*\n\n${bosses}\n\nCrea una raid aleatoria con *${prefix}raid crear* o elige jefe con *${prefix}raid crear <id>*. `);
        }
        if (action === 'crear' || action === 'create') {
            if (raid) return reply(sock, chatId, msg, `⚠️ Ya hay una raid activa.\n\n${raidStatusText(raid, prefix)}`);
            const requestedBoss = String(args[1] || '').toLowerCase();
            const bossId = RAID_BOSSES[requestedBoss] ? requestedBoss : random(Object.keys(RAID_BOSSES));
            const boss = RAID_BOSSES[bossId];
            raid = { bossId, hp: boss.hp, maxHp: boss.hp, reward: boss.reward, createdAt: new Date().toISOString(), expiresAt: Date.now() + 10 * 60 * 1000, participants: { [jid]: { jid, name: numberOf(jid), damage: 0, lastAttack: 0 } } };
            state.raids.active = raid;
            save();
            return reply(sock, chatId, msg, `🚨 *RAID CREADA*\n\n${boss.name} ha despertado.\n❤️ Vida: *${fmt(boss.hp)} HP*\n🎁 Botín total: *${fmt(boss.reward)} ${COIN}*\n⏳ Tenéis *10 minutos* para derrotarlo.\n\nLos demás jugadores pueden unirse con *${prefix}raid unirse*.\n${raidStatusText(raid, prefix)}`);
        }
        if (!raid) return reply(sock, chatId, msg, `⚔️ No hay una raid activa. Crea una con *${prefix}raid crear*.`);
        if (action === 'unirse' || action === 'join') {
            if (raid.participants[jid]) return reply(sock, chatId, msg, `✅ Ya estás dentro de la raid contra *${RAID_BOSSES[raid.bossId].name}*. Usa *${prefix}raid atacar* para golpear.`);
            if (Object.keys(raid.participants).length >= 8) return reply(sock, chatId, msg, '❌ La raid ya alcanzó el límite de 8 aventureros.');
            raid.participants[jid] = { jid, name: numberOf(jid), damage: 0, lastAttack: 0 };
            save();
            return reply(sock, chatId, msg, `🤝 *${numberOf(jid)} se unió a la raid*\n\n${raidStatusText(raid, prefix)}`);
        }
        if (action === 'estado' || action === 'status' || action === 'ver') return reply(sock, chatId, msg, raidStatusText(raid, prefix));
        if (action === 'atacar' || action === 'ataque' || action === 'attack') {
            const participant = raid.participants[jid];
            if (!participant) return reply(sock, chatId, msg, `❌ Primero únete con *${prefix}raid unirse*.`);
            const wait = cooldown(participant, 'lastAttack', 25e3);
            if (wait) return reply(sock, chatId, msg, `⏳ Tu ataque se está recargando. Vuelve en *${timeLeft(wait)}*.`);
            const level = Math.max(1, Number(user.rpg.level) || 1);
            const baseDamage = 450 + level * 130 + Math.floor(Math.random() * 251);
            const damage = Math.max(1, Math.floor(baseDamage * raidClassMultiplier(user) * equipmentRewardMultiplier(user, 'raid')));
            participant.lastAttack = Date.now();
            participant.damage = (Number(participant.damage) || 0) + damage;
            raid.hp = Math.max(0, raid.hp - damage);
            if (raid.hp > 0) {
                save();
                return reply(sock, chatId, msg, `💥 *${numberOf(jid)} atacó a ${RAID_BOSSES[raid.bossId].name}*\n⚔️ Daño causado: *${fmt(damage)}*\n❤️ Vida restante: *${fmt(raid.hp)}/${fmt(raid.maxHp)} HP*\n\n${raidStatusText(raid, prefix)}`);
            }
            const boss = RAID_BOSSES[raid.bossId];
            const members = Object.values(raid.participants);
            const rewards = [];
            for (const member of members) {
                const found = findUser(state, member.jid);
                if (!found) continue;
                const memberUser = found.user;
                const share = Math.max(1, Math.floor((raid.reward / members.length) * equipmentRewardMultiplier(memberUser, 'raid')));
                memberUser.coins = (Number(memberUser.coins) || 0) + share;
                memberUser.rpg ||= { xp: 0, level: 1, lastXp: 0 };
                memberUser.rpg.lastXp = 0;
                const xp = addXp(memberUser, boss.xp);
                const regularUnlocks = addStat(memberUser, 'raidsCompleted', 1);
                memberUser.rpg.stats ||= {};
                memberUser.rpg.stats.raidBosses ||= {};
                memberUser.rpg.stats.raidBosses[raid.bossId] = (Number(memberUser.rpg.stats.raidBosses[raid.bossId]) || 0) + 1;
                const raidUnlocks = unlockAchievements(memberUser);
                const titleGranted = grantRaidTitle(memberUser, RAID_TITLES[raid.bossId]);
                updateTitles(memberUser);
                const unlockText = [...regularUnlocks, ...raidUnlocks].length ? `\n🏆 ${[...regularUnlocks, ...raidUnlocks].join('\n🏆 ')}` : '';
                const titleText = titleGranted ? `\n🏅 *Título desbloqueado:* ${RAID_TITLES[raid.bossId]}` : '';
                rewards.push(`• ${member.name}: *+${fmt(share)} ${COIN}* y *+${fmt(xp.gained || boss.xp)} XP*${unlockText}${titleText}`);
            }
            state.raids.history ||= [];
            state.raids.history.push({ bossId: raid.bossId, status: 'victory', finishedAt: new Date().toISOString(), participants: members.length, damage: members.reduce((sum, item) => sum + item.damage, 0) });
            state.raids.history = state.raids.history.slice(-20);
            state.raids.active = null;
            save();
            return reply(sock, chatId, msg, `🏆 *¡${boss.name} HA SIDO DERROTADO!*\n\n⚔️ Daño de tu golpe final: *${fmt(damage)}*\n👥 Recompensas compartidas:\n${rewards.join('\n')}\n\nLa raid terminó. Crea otra con *${prefix}raid crear*.`);
        }
        return reply(sock, chatId, msg, `⚔️ Usa *${prefix}raid crear*, *${prefix}raid unirse*, *${prefix}raid atacar* o *${prefix}raid estado*.`);
    }

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
        const selected = toolFor(args[0]);
        const gear = classEquipment(user).find(item => item.id === String(args[0] || '').toLowerCase());
        if (gear) {
            user.equipment ||= {};
            if (user.equipment[gear.id]) return reply(sock, chatId, msg, `✅ Ya tienes equipado ${gear.name}. Su bonificación está activa.`);
            if (user.coins < gear.price) return reply(sock, chatId, msg, `❌ ${gear.name} cuesta *${fmt(gear.price)} ${COIN}*.\nTienes: *${fmt(user.coins)} ${COIN}*.`);
            user.coins -= gear.price;
            user.equipment[gear.id] = { purchasedAt: new Date().toISOString(), price: gear.price };
            save();
            return reply(sock, chatId, msg, `✅ *EQUIPAMIENTO ADQUIRIDO*\n\n${gear.name}\n💸 Precio: *${fmt(gear.price)} ${COIN}*\n⚔️ Bonificación: *+${Math.round(gear.bonus * 100)}%* en ${gear.activities.join(', ')}\n🪙 Bolsa: *${fmt(user.coins)} ${COIN}*`);
        }
        if (!selected) {
            const offers = Object.entries(MERCHANT_ITEMS).map(([key, item]) => {
                const current = user.tools?.[key];
                const durability = current?.durability > 0 ? ` · tienes ${current.durability}/${item.durability}` : '';
                return `🛍️ *${item.name}* — *${fmt(item.price)} ${COIN}* · ${item.durability} usos${durability}`;
            }).join('\n');
            const gearOffers = classEquipment(user).map(item => `⚔️ *${item.name}* — *${fmt(item.price)} ${COIN}* · +${Math.round(item.bonus * 100)}% en ${item.activities.join(', ')}\nComprar: *${prefix}mercader ${item.id}*`).join('\n');
            return sendImageCaption(sock, chatId, msg, shopImagePath(), `🧑‍🌾 *MERCADER RPG*\n\n${offers}\n\n👑 *EQUIPAMIENTO DE ${CHARACTER_CLASSES[user.rpg.class]?.label || 'TU CLASE'}*\n${gearOffers || 'Elige una clase para desbloquear armas y armaduras.'}\n\n📦 Vender drops: *${prefix}mercader vender*\n\n⛏️ Minar requiere pico\n⚔️ Cazar requiere espada\n🎣 Pescar requiere caña`);
        }
        const item = MERCHANT_ITEMS[selected];
        if (user.coins < item.price) return reply(sock, chatId, msg, `❌ No tienes suficientes ${COIN}.\nNecesitas: *${fmt(item.price)}*\nTienes: *${fmt(user.coins)}*`);
        user.tools ||= {};
        user.coins -= item.price;
        user.tools[selected] = { durability: item.durability, maxDurability: item.durability, boughtAt: new Date().toISOString() };
        save();
        return reply(sock, chatId, msg, `✅ Compraste ${item.name}\n\n💸 Precio: *${fmt(item.price)} ${COIN}*\n🔧 Durabilidad: *${item.durability}/${item.durability} usos*\n💰 Saldo: *${fmt(user.coins)} ${COIN}*`);
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
        if (wait) return reply(sock, chatId, msg, `⏳ Ya estás explorando. Regresa en *${timeLeft(wait)}*.`);
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
        save();
        await animate(sock, chatId, msg, ['🧭 Preparando la expedición...', '🗺️ Atravesando el bosque... ▰▱▱▱▱▱▱▱▱▱', '🗺️ Siguiendo un camino desconocido... ▰▰▰▰▰▰▱▱▱▱', `✨ Descubriste ${discovery}!`]);
        return reply(sock, chatId, msg, `✅ Exploración completada\n\n🪙 Recompensa: *${fmt(reward)} ${COIN}*\n💰 Saldo: *${fmt(user.coins)} ${COIN}*${clanText}\n⭐ +${xpEvent.gained || 0} XP`);
    }

    if (canonical === 'gather') {
        const wait = cooldown(user, 'lastGather', 60e3);
        if (wait) return reply(sock, chatId, msg, `⏳ Ya recolectaste recursos recientemente. Vuelve en *${timeLeft(wait)}*.`);
        const tool = toolState(user, 'pico');
        if (!tool) return reply(sock, chatId, msg, `❌ Necesitas un ⛏️ *pico* para recolectar recursos.\nUsa *${prefix}mercader pico*.`);
        const reward = random(GATHERING_REWARDS);
        const resource = random(['cristales', 'hierbas raras', 'madera encantada', 'semillas mágicas', 'fragmentos de mineral']);
        const used = consumeTool(user, 'pico');
        user.coins += reward;
        user.lastGather = Date.now();
        save();
        await animate(sock, chatId, msg, ['🌿 Buscando recursos...', '🌿 Recolectando materiales... ▰▱▱▱▱▱▱▱▱▱', '🌿 La bolsa empieza a llenarse... ▰▰▰▰▰▰▰▱▱▱', `📦 Encontraste ${resource}!`]);
        return reply(sock, chatId, msg, `✅ Recolección completada\n\n📦 Recurso: *${resource}*\n🪙 Recompensa: *${fmt(reward)} ${COIN}*\n🔧 Pico: *${used.durability}/${MERCHANT_ITEMS.pico.durability} usos*${used.broken ? `\n💥 Tu pico se rompió. Compra otro en *${prefix}mercader*.` : ''}`);
    }

    if (canonical === 'patrol') {
        const clan = getUserClan(botData.clans, jid);
        if (!clan) return reply(sock, chatId, msg, `❌ Debes pertenecer a un clan para patrullar. Usa *${prefix}clan* para unirte a uno.`);
        const wait = cooldown(user, 'lastPatrol', 120e3);
        if (wait) return reply(sock, chatId, msg, `⏳ El clan ya fue patrullado. Vuelve en *${timeLeft(wait)}*.`);
        const reward = random([400, 550, 700, 900]);
        const clanXp = random([80, 100, 120, 150]);
        user.coins += reward;
        user.lastPatrol = Date.now();
        clan.xp = (Number(clan.xp) || 0) + clanXp;
        clan.level = clanLevel(clan);
        save();
        await animate(sock, chatId, msg, ['🛡️ Reuniendo a la guardia del clan...', '🛡️ Revisando las fronteras... ▰▱▱▱▱▱▱▱▱▱', '🛡️ Detectando huellas enemigas... ▰▰▰▰▰▰▰▰▱▱', '✅ ¡La frontera está segura!']);
        return reply(sock, chatId, msg, `🛡️ *PATRULLA DEL CLAN*\n\n🏰 Clan: *${clan.name}*\n🪙 Recompensa: *${fmt(reward)} ${COIN}*\n⭐ XP del clan: *+${clanXp}*\n📈 Nivel del clan: *${clan.level}*`);
    }

    if (canonical === 'mission') {
        const action = String(args[0] || '').toLowerCase();
        const welcome = user.rpg?.welcomeMission;
        const welcomeText = welcome ? `🎯 *MISIÓN DE BIENVENIDA*\n${welcome.title}\n${welcome.objective}\nProgreso: *${Math.min(Number(welcome.progress) || 0, Number(welcome.target) || 1)}/${welcome.target}*\n${welcome.claimed ? '✅ Recompensa entregada: 500 Niku Coins + 40 XP' : '🎁 Completa tu primer combate para recibir 500 Niku Coins + 40 XP.'}` : '';
        if (action === 'nueva' && user.mission && !user.mission.completed) return reply(sock, chatId, msg, '📜 Ya tienes una misión activa. Complétala antes de pedir otra.');
        const hadMission = Boolean(user.mission);
        const current = action === 'nueva' ? ensureMission(user, true) : (user.mission || ensureMission(user));
        if (action === 'nueva' || !hadMission) save();
        const dungeon = ensureDungeonState(user);
        if (current.completed) return reply(sock, chatId, msg, `${welcomeText ? `${welcomeText}\n\n` : ''}📜 *MISIÓN COMPLETADA*\n\n🏰 Mata *${current.target} monstruos* en la mazmorra.\n🎁 Recompensa recibida: *${fmt(current.reward)} ${COIN}*\n\nEscribe *${prefix}misiones nueva* para obtener otra misión.`);
        return reply(sock, chatId, msg, `${welcomeText ? `${welcomeText}\n\n` : ''}📜 *MISIÓN DE MAZMORRA*\n\n🏰 Derrota monstruos: *${current.progress}/${current.target}*\n🎁 Recompensa: *${fmt(current.reward)} ${COIN}*\n🚪 Entradas hoy: *${dungeon.runs}/3*\n\nUsa *${prefix}mazmorra* para avanzar.`);
    }

    if (canonical === 'dungeon') {
        const dungeon = ensureDungeonState(user);
        const mission = ensureMission(user);
        if (dungeon.runs >= 3) return reply(sock, chatId, msg, `🚪 Ya bajaste a la mazmorra *3/3 veces* hoy.\nVuelve mañana para continuar la misión.`);
        if (dungeon.integrity < 25) return reply(sock, chatId, msg, `🏚️ Tu mazmorra está demasiado dañada (*${dungeon.integrity}/100*).\nUsa *${prefix}reparar* para restaurarla por *1.500 ${COIN}*.`);
        const sword = toolState(user, 'espada');
        if (!sword) return reply(sock, chatId, msg, `❌ Necesitas una ⚔️ *espada* para entrar a la mazmorra.\nUsa *${prefix}mercader espada* para comprar una.`);
        const remaining = Math.max(0, mission.target - mission.progress);
        const runsLeft = 3 - dungeon.runs;
        const kills = runsLeft === 1 ? remaining : Math.min(remaining, 5 + Math.floor(Math.random() * 8));
        const used = consumeTool(user, 'espada');
        dungeon.runs += 1;
        dungeon.integrity = Math.max(0, dungeon.integrity - 35);
        mission.progress += kills;
        const dungeonAchievements = addStat(user, 'dungeonKills', kills);
        const reward = Math.floor(random(DUNGEON_REWARDS) * equipmentRewardMultiplier(user, 'dungeon'));
        user.coins += reward;
        const droppedLoot = Math.random() < 0.45 ? random(DUNGEON_LOOT) : null;
        if (droppedLoot) {
            user.loot ||= {};
            user.loot[droppedLoot.id] = (Number(user.loot[droppedLoot.id]) || 0) + 1;
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
        const unlocked = [...dungeonAchievements, ...missionAchievements];
        save();
        await animate(sock, chatId, msg, ['🏰 Las puertas de la mazmorra se abren...', '👾 Monstruos detectados... ▰▱▱▱▱▱▱▱▱▱', `⚔️ Derrotando monstruos... *${kills} eliminados*`, '🏆 ¡Has sobrevivido a la expedición!']);
        return sendImageCaption(sock, chatId, msg, dungeonImagePath(), `✅ Expedición completada\n\n👾 Monstruos derrotados: *${kills}*\n🪙 Recompensa: *${fmt(reward)} ${COIN}*${equipmentAdvantageText(user, 'dungeon')}\n${droppedLoot ? `📦 *DROP:* ${droppedLoot.name}\n💰 Puedes venderlo con *${prefix}mercader vender ${droppedLoot.id}*` : '🔍 No encontraste un drop vendible esta vez.'}\n📜 Misión: *${mission.progress}/${mission.target}*\n🚪 Entradas hoy: *${dungeon.runs}/3*\n🏚️ Integridad de mazmorra: *${dungeon.integrity}/100*\n🔧 Espada: *${used.durability}/12 usos*${used.broken ? '\n💥 Tu espada se rompió. Compra otra en el mercader.' : ''}${completion}${achievementText(unlocked)}`);
    }

    if (canonical === 'level') {
        return reply(sock, chatId, msg, `🧙 *PERFIL RPG*\n\n👤 @${numberOf(jid)}\n⭐ Nivel: *${user.rpg.level}*\n✨ XP total: *${fmt(user.rpg.xp)}*\n${levelBar(user)}`, { mentions: [jid] });
    }

    if (canonical === 'achievements') {
        const unlocked = user.rpg.achievements || {};
        const rows = ACHIEVEMENTS.map(item => `${unlocked[item.id] ? '✅' : '🔒'} ${item.title} · +${fmt(item.reward)} ${COIN}`).join('\n');
        return reply(sock, chatId, msg, `🏆 *LOGROS RPG*\n\n${rows}\n\nDesbloqueados: *${Object.keys(unlocked).length}/${ACHIEVEMENTS.length}*`);
    }

    if (canonical === 'mine' || canonical === 'fish' || canonical === 'hunt') {
        const isMine = canonical === 'mine';
        const isFish = canonical === 'fish';
        const toolKey = isMine ? 'pico' : isFish ? 'cana' : 'espada';
        const waitKey = isMine ? 'lastMine' : isFish ? 'lastFish' : 'lastHunt';
        const waitMs = isMine ? 45e3 : isFish ? 60e3 : 50e3;
        const wait = cooldown(user, waitKey, waitMs);
        if (wait) return reply(sock, chatId, msg, `⏳ Tu personaje necesita descansar. Vuelve en *${timeLeft(wait)}*.`);
        const tool = toolState(user, toolKey);
        if (!tool) {
            const names = { pico: '⛏️ pico', cana: '🎣 caña de pescar', espada: '⚔️ espada' };
            return reply(sock, chatId, msg, `❌ Necesitas comprar un ${names[toolKey]} para poder ${isMine ? 'minar' : isFish ? 'pescar' : 'cazar'}.\nUsa *${prefix}mercader* para visitar la tienda del gremio.`);
        }
        const baseReward = random(isMine ? MINING_REWARDS : isFish ? FISHING_REWARDS : HUNTING_REWARDS);
        const reward = Math.floor(baseReward * classRewardMultiplier(user, canonical) * equipmentRewardMultiplier(user, canonical));
        const item = isMine ? random(['carbón', 'hierro', 'oro', 'diamante', 'redstone']) : isFish ? random(['bacalao', 'salmón', 'pez globo', 'tesoro', 'libro encantado']) : random(['conejo', 'jabalí', 'ciervo', 'zorro', 'lobo salvaje']);
        const used = consumeTool(user, toolKey);
        user.coins += reward;
        user[waitKey] = Date.now();
        const unlocked = addStat(user, isMine ? 'mined' : isFish ? 'fished' : 'hunted', 1);
        save();
        const frames = isMine
            ? [`⛏️ *${numberOf(jid)}* entra a una mina...`, '⛏️ Rompiendo piedra... ▰▱▱▱▱▱▱▱▱▱', '⛏️ Rompiendo piedra... ▰▰▰▰▰▱▱▱▱▱', `💎 ¡Encontraste ${item}!`]
            : isFish ? [`🎣 *${numberOf(jid)}* lanza la caña...`, '🎣 El agua se mueve... ▰▱▱▱▱▱▱▱▱▱', '🎣 ¡Algo mordió el anzuelo! ▰▰▰▰▰▰▱▱▱▱', `🐟 ¡Pescaste ${item}!`] : [`⚔️ *${numberOf(jid)}* se prepara para cazar...`, '⚔️ Siguiendo huellas... ▰▱▱▱▱▱▱▱▱▱', '⚔️ ¡La presa apareció! ▰▰▰▰▰▰▱▱▱▱', `🏹 ¡Cazaste un ${item}!`];
        await animate(sock, chatId, msg, frames);
        return reply(sock, chatId, msg, `✅ Recibiste *${fmt(reward)} ${COIN}*\n💰 Saldo: *${fmt(user.coins)}*\n🔧 ${toolKey}: *${used.durability}/${MERCHANT_ITEMS[toolKey].durability} usos*${used.broken ? `\n💥 Tu ${toolKey} se rompió. Compra otro en *${prefix}mercader*.` : ''}${classAdvantageText(user, canonical)}${equipmentAdvantageText(user, canonical)}\n⭐ +${xpEvent.gained || 0} XP${achievementText(unlocked)}`);
    }

    if (canonical === 'clan') {
        botData.clans ||= {};
        botData.clanWars ||= {};
        const action = String(args[0] || 'lista').toLowerCase();
        const currentClan = getUserClan(botData.clans, jid);
        if (['guerra', 'war', 'guerras'].includes(action)) {
            if (!currentClan) return reply(sock, chatId, msg, '❌ Debes pertenecer a un clan para participar en guerras.');
            const currentKey = clanKey(currentClan.name);
            const subAction = String(args[1] || 'lista').toLowerCase();
            if (['desafiar', 'desafio', 'challenge'].includes(subAction)) {
                if (currentClan.owner !== jid) return reply(sock, chatId, msg, '❌ Solo el líder del clan puede iniciar una guerra.');
                const target = findClan(botData.clans, args.slice(2).join(' '));
                if (!target) return reply(sock, chatId, msg, `❌ Clan objetivo no encontrado. Usa *${prefix}clan* para ver los clanes.`);
                const targetKey = clanKey(target.name);
                if (targetKey === currentKey) return reply(sock, chatId, msg, '❌ No puedes desafiar a tu propio clan.');
                if (clanWarList(botData.clanWars).some(war => [war.challenger, war.defender].includes(currentKey) && [war.challenger, war.defender].includes(targetKey))) return reply(sock, chatId, msg, '⚔️ Ya existe una guerra pendiente o activa entre esos clanes.');
                const id = `war-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                botData.clanWars[id] = { id, challenger: currentKey, defender: targetKey, status: 'pending', createdAt: new Date().toISOString() };
                save();
                return reply(sock, chatId, msg, `⚔️ *DESAFÍO ENVIADO*\n\n🏰 ${currentClan.name} vs ${target.name}\n\nEl líder de *${target.name}* debe aceptar con:\n*${prefix}clan guerra aceptar*`);
            }
            if (['aceptar', 'accept'].includes(subAction)) {
                if (currentClan.owner !== jid) return reply(sock, chatId, msg, '❌ Solo el líder del clan puede aceptar una guerra.');
                const war = clanWarList(botData.clanWars).find(item => item.status === 'pending' && item.defender === currentKey);
                if (!war) return reply(sock, chatId, msg, '❌ No tienes desafíos de guerra pendientes.');
                war.status = 'accepted';
                war.acceptedAt = new Date().toISOString();
                save();
                return reply(sock, chatId, msg, `🛡️ *GUERRA ACEPTADA*\n\nYa puedes resolver el combate con:\n*${prefix}clan guerra combatir*`);
            }
            if (['combatir', 'resolver', 'fight', 'batalla'].includes(subAction)) {
                if (currentClan.owner !== jid) return reply(sock, chatId, msg, '❌ Solo el líder puede iniciar el combate.');
                const war = clanWarList(botData.clanWars).find(item => item.status === 'accepted' && [item.challenger, item.defender].includes(currentKey));
                if (!war) return reply(sock, chatId, msg, '❌ No tienes una guerra aceptada lista para combatir.');
                const challenger = botData.clans[war.challenger];
                const defender = botData.clans[war.defender];
                if (!challenger || !defender) return reply(sock, chatId, msg, '❌ La guerra ya no es válida porque falta uno de los clanes.');
                const challengerPower = clanPower(challenger);
                const defenderPower = clanPower(defender);
                const winner = challengerPower >= defenderPower ? challenger : defender;
                const loser = winner === challenger ? defender : challenger;
                const reward = 5000 + (loser.members?.length || 1) * 1000;
                const xpReward = 250 + (loser.members?.length || 1) * 50;
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
                if (winner === currentClan) user.coins += reward;
                save();
                return reply(sock, chatId, msg, `🏆 *GUERRA RESUELTA*\n\n👑 Ganador: *${winner.name}*\n⚔️ Poder: *${winner === challenger ? challengerPower : defenderPower}*\n💥 Derrotado: *${loser.name}*\n\n🪙 Premio del clan: *${fmt(reward)} ${COIN}*\n⭐ XP del clan: *+${fmt(xpReward)}*\n📈 Nivel de ${winner.name}: *${winner.level}*\n🏆 Victorias: *${winner.wins}*`);
            }
            const wars = clanWarList(botData.clanWars).filter(war => [war.challenger, war.defender].includes(currentKey));
            const listing = wars.length ? wars.map(war => `⚔️ ${botData.clans[war.challenger]?.name || war.challenger} vs ${botData.clans[war.defender]?.name || war.defender} · *${war.status}*`).join('\n') : 'No tienes guerras pendientes.';
            return reply(sock, chatId, msg, `⚔️ *GUERRAS DE CLANES*\n\n${listing}\n\nDesafiar: *${prefix}clan guerra desafiar <clan>*\nAceptar: *${prefix}clan guerra aceptar*\nCombatir: *${prefix}clan guerra combatir*`);
        }
        if (['crear', 'create'].includes(action)) {
            const displayName = args.slice(1).join(' ').trim().slice(0, 20);
            const key = clanKey(displayName);
            if (!key) return reply(sock, chatId, msg, `ℹ️ Uso: *${prefix}clan crear <nombre>*`);
            if (currentClan) return reply(sock, chatId, msg, `❌ Ya perteneces al clan *${currentClan.name}*.`);
            if (botData.clans[key]) return reply(sock, chatId, msg, '❌ Ese nombre de clan ya está ocupado.');
            const creationCost = 10000;
            if (user.coins < creationCost) return reply(sock, chatId, msg, `❌ Crear un clan cuesta *${fmt(creationCost)} ${COIN}*.`);
            user.coins -= creationCost;
            botData.clans[key] = { name: displayName, owner: jid, members: [jid], xp: 0, level: 1, coins: 0, wins: 0, losses: 0, createdAt: new Date().toISOString() };
            const unlocked = addStat(user, 'clansCreated', 1);
            save();
            return reply(sock, chatId, msg, `⚔️ *Clan creado*\n\n🏰 Nombre: *${displayName}*\n💸 Costo: *${fmt(creationCost)} ${COIN}*\n👥 Miembros: *1*${achievementText(unlocked)}`);
        }
        if (['unirse', 'join'].includes(action)) {
            const clan = findClan(botData.clans, args.slice(1).join(' '));
            if (!clan) return reply(sock, chatId, msg, `❌ Clan no encontrado. Usa *${prefix}clan* para ver la lista.`);
            if (currentClan) return reply(sock, chatId, msg, `❌ Ya perteneces al clan *${currentClan.name}*.`);
            clan.members ||= [];
            clan.members.push(jid);
            save();
            return reply(sock, chatId, msg, `✅ Te uniste al clan *${clan.name}*.\n👥 Miembros: *${clan.members.length}*`);
        }
        if (['salir', 'leave'].includes(action)) {
            if (!currentClan) return reply(sock, chatId, msg, '❌ No perteneces a ningún clan.');
            currentClan.members = currentClan.members.filter(member => member !== jid);
            if (currentClan.owner === jid) {
                if (currentClan.members.length) currentClan.owner = currentClan.members[0];
                else delete botData.clans[clanKey(currentClan.name)];
            }
            save();
            return reply(sock, chatId, msg, `👋 Saliste del clan *${currentClan.name}*.`);
        }
        if (['info', 'informacion'].includes(action)) {
            const clan = findClan(botData.clans, args.slice(1).join(' ')) || currentClan;
            if (!clan) return reply(sock, chatId, msg, '❌ No se encontró ese clan.');
            clan.xp = Number(clan.xp) || 0;
            clan.level = clanLevel(clan);
            clan.coins = Number(clan.coins) || 0;
            return reply(sock, chatId, msg, `🏰 *CLAN ${clan.name.toUpperCase()}*\n\n👑 Líder: @${numberOf(clan.owner)}\n👥 Miembros: *${clan.members.length}*\n⭐ Nivel: *${clan.level}* · XP: *${fmt(clan.xp)}*\n🪙 Tesorería: *${fmt(clan.coins)} ${COIN}*\n🏆 Victorias: *${clan.wins || 0}* · Derrotas: *${clan.losses || 0}*\n📅 Creado: *${new Date(clan.createdAt).toLocaleDateString('es-ES')}*`, { mentions: [clan.owner, ...clan.members] });
        }
        const clans = clanList(botData.clans);
        const listing = clans.length ? clans.slice(0, 10).map((clan, index) => `${index + 1}. 🏰 *${clan.name}* — ${clan.members.length} miembros`).join('\n') : 'Todavía no hay clanes creados.';
        return reply(sock, chatId, msg, `⚔️ *CLANES*\n\n${listing}\n\nCrear: *${prefix}clan crear <nombre>*\nUnirse: *${prefix}clan unirse <nombre>*\nSalir: *${prefix}clan salir*\nInfo: *${prefix}clan info [nombre]*\nGuerra: *${prefix}clan guerra desafiar <clan>*`);
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
        if (!rows.length) return reply(sock, chatId, msg, '🏆 Todavía no hay jugadores con Niku Coins registrados.');
        const text = rows.slice(0, 10).map(([number, total], index) => `${index + 1}. @${number} — *${fmt(total)} ${COIN}*`).join('\n');
        return reply(sock, chatId, msg, `🏆 *SALÓN DE LA FAMA DEL REINO*\n\n👥 Jugadores con Niku Coins: *${rows.length}*\n\n${text}`, { mentions: rows.slice(0, 10).map(([number]) => `${number}@s.whatsapp.net`) });
    }

    if (canonical === 'balance') {
        const target = getTarget(msg, q, state) || { key: jid, user };
        const total = (target.user.coins || 0) + (target.user.bank || 0);
        return reply(sock, chatId, msg, `🧙 *FICHA DEL AVENTURERO @${numberOf(target.key)}*\n\n🪙 Bolsa: *${fmt(target.user.coins)} ${COIN}*\n🏦 Cofre del gremio: *${fmt(target.user.bank)} ${COIN}*\n💎 Patrimonio total: *${fmt(total)} ${COIN}*`, { mentions: [target.key] });
    }
    if (canonical === 'baltop') {
        const page = Math.max(1, Number(args[0]) || 1);
        const entries = Object.entries(state.users).map(([key, value]) => ({ key, total: (value.coins || 0) + (value.bank || 0) })).filter(x => x.total > 0).sort((a, b) => b.total - a.total);
        if (!entries.length) return reply(sock, chatId, msg, '🏆 Todavía no hay cuentas con saldo en este grupo.');
        const pages = Math.max(1, Math.ceil(entries.length / 10));
        const rows = entries.slice((page - 1) * 10, page * 10);
        if (!rows.length) return reply(sock, chatId, msg, `❌ Página inválida. Usa una página entre 1 y ${pages}.`);
        const text = rows.map((x, i) => `${(page - 1) * 10 + i + 1}. @${numberOf(x.key)} — *${fmt(x.total)} ${COIN}*`).join('\n');
        return reply(sock, chatId, msg, `🏆 *RANKING DE AVENTUREROS*\n\n${text}\n\n_Página ${page}/${pages}_`, { mentions: rows.map(x => x.key) });
    }
    if (canonical === 'daily') {
        const wait = cooldown(user, 'lastDaily', 24 * 60 * 60 * 1000);
        if (wait) return reply(sock, chatId, msg, `⏳ Ya recibiste tu recompensa del gremio. Regresa en *${timeLeft(wait)}*.`);
        const streak = wait ? 0 : (Number(user.streak) || 0) + 1;
        const reward = 30000 + (streak - 1) * 5000;
        Object.assign(user, { coins: user.coins + reward, streak, lastDaily: Date.now() }); save();
        return reply(sock, chatId, msg, `🎁 El gremio te entregó *${fmt(reward)} ${COIN}* por completar tu recompensa diaria.\n🔥 Racha actual: *${streak} días*`);
    }
    if (canonical === 'work' || canonical === 'crime' || canonical === 'slut') {
        const config = canonical === 'work' ? { key: 'lastWork', wait: 60e3, gain: [1, 10000], loss: [1000, 5000], chance: .25, label: 'trabajo' } : canonical === 'crime' ? { key: 'lastCrime', wait: 5 * 60e3, gain: [3000, 18000], loss: [3000, 15000], chance: .25, label: 'crimen' } : { key: 'lastSlut', wait: 4 * 60e3, gain: [1000, 11000], loss: [2000, 8000], chance: .30, label: 'trabajo de riesgo' };
        const wait = cooldown(user, config.key, config.wait);
        if (wait) return reply(sock, chatId, msg, `⏳ Debes esperar *${timeLeft(wait)}* para volver a usar este comando.`);
        const lost = Math.random() < config.chance;
        const range = config[ lost ? 'loss' : 'gain' ];
        const baseValue = Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
        const value = lost ? baseValue : Math.max(1, Math.floor(baseValue * classRewardMultiplier(user, canonical) * equipmentRewardMultiplier(user, canonical)));
        const real = lost ? Math.min(user.coins, value) : value;
        user.coins += lost ? -real : real;
        user[config.key] = Date.now(); save();
        const activity = randomJob(user, canonical, lost ? 'loss' : 'gain');
        return reply(sock, chatId, msg, lost ? `💥 ${activity} *${fmt(real)} ${COIN}*.\n🪙 Bolsa del aventurero: *${fmt(user.coins)} ${COIN}*` : `✅ ${activity} *${fmt(real)} ${COIN}*.\n🪙 Bolsa del aventurero: *${fmt(user.coins)} ${COIN}*${classAdvantageText(user, canonical)}${equipmentAdvantageText(user, canonical)}`);
    }
    if (canonical === 'deposit' || canonical === 'withdraw') {
        const input = amount(args[0]);
        if (input === null) return reply(sock, chatId, msg, `ℹ️ Uso: *${prefix}${HELP[canonical]}*`);
        const available = canonical === 'deposit' ? user.coins : user.bank;
        const value = input === 'all' ? available : input;
        if (!value || value > available) return reply(sock, chatId, msg, `❌ No tienes suficientes monedas en tu bolsa o cofre.`);
        if (canonical === 'deposit') { user.coins -= value; user.bank += value; } else { user.bank -= value; user.coins += value; }
        save(); return reply(sock, chatId, msg, `${canonical === 'deposit' ? '🏦 Guardaste en el cofre' : '💳 Retiraste del cofre'} *${fmt(value)} ${COIN}*.\n🪙 Bolsa: *${fmt(user.coins)} ${COIN}* · Cofre: *${fmt(user.bank)} ${COIN}*`);
    }
    if (canonical === 'pay') {
        const target = getTarget(msg, q, state);
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
        const target = getTarget(msg, q, state);
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
        const rows = [['work', 'lastWork', 60e3], ['crime', 'lastCrime', 5 * 60e3], ['rob', 'lastRob', 10 * 60e3], ['daily', 'lastDaily', 24 * 60 * 60e3], ['slut', 'lastSlut', 4 * 60e3]].map(([label, key, ms]) => `${label}: ${cooldown(user, key, ms) ? timeLeft(cooldown(user, key, ms)) : 'disponible'}`).join('\n');
        return reply(sock, chatId, msg, `⏱️ *TIEMPOS DE RECARGA DEL AVENTURERO*\n\n${rows}`);
    }
}

module.exports = runEconomy;
module.exports.aliases = ALIASES;
module.exports.menu = menu;
module.exports.achievements = ACHIEVEMENTS.map(({ id, title, reward }) => ({ id, title, reward }));
module.exports.items = Object.fromEntries(Object.entries(MERCHANT_ITEMS).map(([key, item]) => [key, { name: item.name, durability: item.durability }]));
