const crypto = require('node:crypto');
const { commandImagePath, sendImageCaption, sendItemCaption } = require('./rpgMedia');
const { ensureFeatureState, consumeEnergy, recordMissionEvent, levelUpText, rarityInfo } = require('./rpgFeatures');
const { CLASS_EQUIPMENT, DUNGEON_LOOT, RPG_ITEMS, RPG_GATHERING_LOOT } = require('./rpgCatalog');
const { sendActionButtons } = require('./interactiveActions');
const CLASS_SKILLS = {
    guerrero: [
        { id: 'golpe', name: 'Golpe poderoso', cost: 8, power: 1.45, description: 'Ataque pesado con daño aumentado.' },
        { id: 'fortaleza', name: 'Fortaleza', cost: 12, heal: 26, description: 'Recupera vida y reduce el próximo daño.' }
    ],
    mago: [
        { id: 'fuego', name: 'Bola de fuego', cost: 12, power: 1.75, description: 'Daño mágico alto.' },
        { id: 'hielo', name: 'Rayo de hielo', cost: 10, power: 1.2, heal: 8, description: 'Daño y recuperación ligera.' }
    ],
    picaro: [
        { id: 'sombra', name: 'Ataque furtivo', cost: 10, power: 1.9, crit: 0.35, description: 'Gran probabilidad de golpe crítico.' },
        { id: 'veneno', name: 'Veneno', cost: 9, power: 1.15, damageOverTime: 18, description: 'Deja daño adicional al enemigo.' }
    ],
    tirador: [
        { id: 'certero', name: 'Disparo certero', cost: 9, power: 1.6, crit: 0.2, description: 'Ataque preciso con crítico mejorado.' },
        { id: 'trampa', name: 'Trampa', cost: 11, power: 1.25, damageOverTime: 24, description: 'Daña al enemigo durante dos turnos.' }
    ],
    paladin: [
        { id: 'luz_sagrada', name: 'Luz sagrada', cost: 11, power: 1.5, heal: 12, description: 'Golpea con luz divina y recupera vida.' },
        { id: 'bastion_divino', name: 'Bastión divino', cost: 12, power: 1.15, heal: 25, guard: true, description: 'Levanta un escudo, se cura y reduce el contraataque.' }
    ]
};

const ENEMIES = [
    { id: 'goblin', name: 'Goblin saqueador', level: 1, hp: 260, attack: 24, reward: 75, xp: 35, drop: 'hierro' },
    { id: 'lobo', name: 'Lobo de sombra', level: 3, hp: 360, attack: 34, reward: 120, xp: 55, drop: 'piel' },
    { id: 'mago', name: 'Mago errante', level: 5, hp: 520, attack: 46, reward: 220, xp: 80, drop: 'runa' },
    { id: 'dragon', name: 'Dragón joven', level: 8, hp: 820, attack: 68, reward: 400, xp: 140, drop: 'escama' }
];

const RAID_BOSSES = {
    dragon_ancient: { id: 'dragon_ancient', name: '🐉 Dragón ancestral', hp: 5200, attack: 95, reward: 2500, xp: 650, drop: 'escama_ancestral', minLevel: 3 },
    titan: { id: 'titan', name: '🗿 Titán de obsidiana', hp: 7600, attack: 125, reward: 4000, xp: 900, drop: 'núcleo_obsidiana', minLevel: 5 },
    lich: { id: 'lich', name: '💀 Rey Liche', hp: 9800, attack: 150, reward: 5500, xp: 1200, drop: 'corona_liche', minLevel: 8 }
};

const RECIPES = {
    pocion: { name: 'Poción de vida', materials: { hierba: 1, agua: 1 }, coins: 80, gives: { potion: 1 } },
    pocion_menor: { name: 'Poción menor', materials: { hierba: 2, agua: 1 }, coins: 150, gives: { pocion_menor: 1 } },
    pocion_mayor: { name: 'Poción mayor', materials: { hierba: 3, agua: 2, runa: 1 }, coins: 600, gives: { pocion_mayor: 1 } },
    elixir_energia: { name: 'Elixir de energía', materials: { hierba: 2, agua: 2, carbon: 1 }, coins: 350, gives: { elixir_energia: 1 } },
    espada_hierro: { name: 'Espada de hierro', materials: { hierro: 5, carbon: 2 }, coins: 250, gives: { sword_iron: 1 } },
    armadura: { name: 'Armadura reforzada', materials: { hierro: 8, piel: 3 }, coins: 500, gives: { armor_reinforced: 1 } },
    espada_abismal: { name: 'Espada abismal', materials: { hierro: 8, carbon: 4, runa: 2 }, coins: 2500, gives: { sword_abyss: 1 } },
    armadura_escamas: { name: 'Armadura de escamas', materials: { hierro: 5, piel: 6, escama: 4 }, coins: 3000, gives: { armor_dragon: 1 } },
    amuleto_lunar: { name: 'Amuleto lunar', materials: { runa: 3, hierba: 4, agua: 2 }, coins: 1800, gives: { amulet_lunar: 1 } }
};

function fmt(value) { return Number(value || 0).toLocaleString('es-ES'); }
function reply(sock, chatId, msg, text, extra = {}) { return sock.sendMessage(chatId, { text, ...extra }, { quoted: msg }); }
function imageReply(sock, chatId, msg, command, text, extra = {}) { return sendImageCaption(sock, chatId, msg, commandImagePath(command), text, extra); }
function normalizeItemQuery(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' '); }
function consumableId(value) {
    const wanted = normalizeItemQuery(value);
    return Object.entries(RPG_ITEMS).find(([id, item]) => item.type === 'consumible' && [id, item.name, ...(item.aliases || [])].some(alias => normalizeItemQuery(alias) === wanted))?.[0] || null;
}
function availableConsumables(rpg) { return Object.entries(RPG_ITEMS).filter(([id, item]) => item.type === 'consumible' && Number(rpg.inventory?.[id]) > 0); }
async function replyWithActions(sock, chatId, msg, text, buttons, prompt = 'Elige una acción:') {
    const sent = await reply(sock, chatId, msg, text);
    if (buttons?.length) await sendActionButtons(sock, chatId, prompt, buttons, sent || msg);
    return sent;
}
async function imageWithActions(sock, chatId, msg, command, text, buttons, prompt = '🐉 Acciones de raid:') {
    const sent = await imageReply(sock, chatId, msg, command, text);
    if (buttons?.length) await sendActionButtons(sock, chatId, prompt, buttons, sent || msg);
    return sent;
}
function ensureRpg(user) {
    user.rpg ||= { xp: 0, level: 1, lastXp: 0 };
    user.rpg.stats ||= {};
    user.rpg.inventory ||= { potion: 2 };
    user.rpg.materials ||= {};
    user.rpg.equipment ||= {};
    if (!user.rpg.gearInventoryMigrated) {
        for (const [id, item] of Object.entries(RPG_ITEMS)) {
            if (!item.slot || !user.rpg.equipment[id]) continue;
            const count = Number(user.rpg.inventory[id]) || 0;
            if (count > 0) {
                user.rpg.inventory[id] = count - 1;
                if (user.rpg.inventory[id] <= 0) delete user.rpg.inventory[id];
            }
        }
        user.rpg.gearInventoryMigrated = true;
    }
    if (!user.rpg.dungeonLootDeduplicated) {
        const dungeonIds = new Set(DUNGEON_LOOT.map(item => item.id));
        for (const id of Object.keys(user.rpg.loot || {})) if (dungeonIds.has(id.split(':')[0])) delete user.rpg.loot[id];
        user.rpg.dungeonLootDeduplicated = true;
    }
    user.rpg.skills ||= {};
    user.rpg.titles ||= [];
    user.rpg.pvp ||= { wins: 0, losses: 0, elo: 1000, streak: 0 };
    user.rpg.hp = Math.max(0, Math.min(Number(user.rpg.hp ?? 100), Number(user.rpg.maxHp || 100)));
    user.rpg.maxHp = Math.max(100, Number(user.rpg.maxHp) || 100);
    user.rpg.energy = Math.max(0, Math.min(Number(user.rpg.energy ?? 50), Number(user.rpg.maxEnergy || 50)));
    user.rpg.maxEnergy = Math.max(50, Number(user.rpg.maxEnergy) || 50);
    if (!user.rpg.hp) user.rpg.hp = user.rpg.maxHp;
    ensureFeatureState(user);
    return user.rpg;
}
function activateWelcomeMission(user) {
    const rpg = ensureRpg(user);
    rpg.welcomeMission ||= {
        id: 'primer-paso',
        title: '🌟 Primer paso',
        objective: 'Completa tu primer combate contra un enemigo.',
        progress: 0,
        target: 1,
        reward: 500,
        xpReward: 40,
        claimed: false,
        startedAt: new Date().toISOString()
    };
    return rpg.welcomeMission;
}
function completeWelcomeMission(user) {
    const mission = user.rpg?.welcomeMission;
    if (!mission || mission.claimed) return '';
    mission.progress = Math.min(Number(mission.target) || 1, (Number(mission.progress) || 0) + 1);
    if (mission.progress < mission.target) return '';
    mission.claimed = true;
    mission.completedAt = new Date().toISOString();
    const reward = Math.max(0, Number(mission.reward) || 0);
    user.coins = (Number(user.coins) || 0) + reward;
    addXp(user, Number(mission.xpReward) || 40);
    return `🎉 *MISIÓN DE BIENVENIDA COMPLETADA*\n\n${mission.title}\n🪙 +${fmt(reward)} monedas de oro\n✨ +${fmt(mission.xpReward)} XP`;
}
function classKey(user) { return ensureRpg(user).class || 'guerrero'; }
function grantTitle(user, title) { const rpg = ensureRpg(user); if (!rpg.titles.includes(title)) rpg.titles.push(title); }
function updateTitles(user) {
    const rpg = ensureRpg(user), stats = rpg.stats || {}, pvp = rpg.pvp || {};
    if (Number(rpg.level) >= 10) grantTitle(user, 'Héroe del reino');
    if (Number(stats.dungeonKills) >= 50) grantTitle(user, 'Señor de las mazmorras');
    if (Number(stats.mined || 0) + Number(stats.fished || 0) + Number(stats.hunted || 0) >= 100) grantTitle(user, 'Explorador incansable');
    if (Number(pvp.wins) >= 10) grantTitle(user, 'Duelista veterano');
    if (Number(pvp.elo) >= 1400) grantTitle(user, 'Campeón de arena');
    return rpg;
}
function addXp(user, amount) {
    const rpg = ensureRpg(user);
    const before = Number(rpg.level) || 1;
    rpg.xp = Math.max(0, Number(rpg.xp) || 0) + Math.max(1, Math.floor(amount));
    rpg.level = Math.max(1, Math.floor(Math.sqrt(rpg.xp / 100)) + 1);
    rpg.hp = rpg.maxHp = 100 + (rpg.level - 1) * 12;
    rpg.energy = rpg.maxEnergy = 50 + (rpg.level - 1) * 4;
    updateTitles(user);
    return { gained: Math.max(1, Math.floor(amount)), level: rpg.level, levelUp: rpg.level > before };
}
function classLabel(user) { return ({ guerrero: '⚔️ Guerrero', mago: '🔮 Mago', picaro: '🗡️ Pícaro', tirador: '🏹 Tirador', paladin: '🛡️ Paladín' })[classKey(user)] || '🧭 Aventurero'; }
function enemyFor(user) { const level = Number(ensureRpg(user).level) || 1; const pool = ENEMIES.filter(enemy => enemy.level <= level + 2); return pool[Math.floor(Math.random() * pool.length)] || ENEMIES[0]; }
function battleFor(botData, chatId, jid) { botData.rpgBattles ||= {}; botData.rpgBattles[chatId] ||= {}; return botData.rpgBattles[chatId][jid]; }
function power(user) { const rpg = ensureRpg(user); const bonus = Object.entries(rpg.equipment).reduce((sum, [id, active]) => sum + (active ? Number(RPG_ITEMS[id]?.power || 0) : 0), 0); return 32 + (Number(rpg.level) || 1) * 7 + bonus; }
function defense(user) { const rpg = ensureRpg(user); return Object.entries(rpg.equipment).reduce((sum, [id, active]) => sum + (active ? Number(RPG_ITEMS[id]?.defense || 0) : 0), 0); }
function itemText(user, prefix = '.') {
    const rpg = ensureRpg(user);
    const display = (id, catalog) => catalog[id]?.name || id;
    const inv = Object.entries(rpg.inventory).filter(([, count]) => Number(count) > 0).map(([id, count]) => `${display(id, RPG_ITEMS)} x${count}`).join(' · ') || 'Vacío';
    const mats = Object.entries(rpg.materials).filter(([, count]) => Number(count) > 0).map(([id, count]) => `${id} x${count}`).join(' · ') || 'Ninguno';
    const lootEntries = [
        ...Object.entries(rpg.loot || {}).filter(([id, count]) => RPG_GATHERING_LOOT[id.split(':')[0]] && Number(count) > 0),
        ...Object.entries(user.loot || {}).filter(([, count]) => Number(count) > 0)
    ];
    const loot = lootEntries.map(([id, count]) => {
        const [baseId, rarity] = id.split(':');
        const item = RPG_GATHERING_LOOT[baseId] || DUNGEON_LOOT.find(drop => drop.id === baseId);
        const info = rarityInfo(rarity || 'comun');
        return `${item ? `${info.icon} ${info.label} ${item.name}` : id} x${count}`;
    }).join(' · ') || 'Ninguno';
    const rpgGear = Object.keys(rpg.equipment).filter(id => rpg.equipment[id]).map(id => display(id, RPG_ITEMS));
    const classGear = Object.values(CLASS_EQUIPMENT).flat().filter(item => user.equipment?.[item.id]).map(item => item.name);
    const gear = [...rpgGear, ...classGear].join(' · ') || 'Sin equipo';
    const gearIds = Object.entries(RPG_ITEMS).filter(([, item]) => item.slot).map(([id]) => id).join(', ');
    return `🎒 *INVENTARIO*\n\n🧰 Objetos: ${inv}\n🧱 Materiales: ${mats}\n📦 Botín raro: ${loot}\n⚔️ Equipado: ${gear}\n\nGestiona tus armas y armaduras: *${prefix}inventario equipar <id>* / *${prefix}inventario quitar <id>*\nEquipo fabricable: ${gearIds}\nVer foto y ficha: *${prefix}objeto <nombre o ID>*`;
}
function handleGearAction(sock, chatId, msg, args, user, rpg, save, prefix) {
    const action = String(args[0] || '').toLowerCase();
    if (!['equipar', 'equip', 'quitar', 'desequipar', 'unequip'].includes(action)) return null;
    const id = String(args[1] || '').toLowerCase();
    if (!id) return reply(sock, chatId, msg, `ℹ️ Usa *${prefix}inventario equipar <id>* o *${prefix}inventario quitar <id>*. Revisa tus piezas con *${prefix}inventario*.`);
    const item = RPG_ITEMS[id];
    if (!item?.slot) return reply(sock, chatId, msg, '❌ Ese objeto no es un arma, armadura o accesorio equipable.');
    if (['quitar', 'desequipar', 'unequip'].includes(action)) {
        if (!rpg.equipment[id]) return reply(sock, chatId, msg, `❌ No tienes *${item.name}* equipado.`);
        delete rpg.equipment[id];
        rpg.inventory[id] = (Number(rpg.inventory[id]) || 0) + 1;
        save();
        return sendItemCaption(sock, chatId, msg, id, `✅ Guardaste *${item.name}* en tu inventario. Ya puedes subastarlo con *${prefix}subastar ${id} <precio>*.`);
    }
    if ((Number(rpg.inventory[id]) || 0) < 1) return reply(sock, chatId, msg, `❌ No tienes *${item.name}* en la bolsa. Fabrícalo o cómpralo primero.`);
    if (rpg.equipment[id]) return reply(sock, chatId, msg, `✅ *${item.name}* ya está equipado.`);
    const activeId = Object.keys(rpg.equipment).find(otherId => rpg.equipment[otherId] && RPG_ITEMS[otherId]?.slot === item.slot);
    if (activeId) {
        delete rpg.equipment[activeId];
        rpg.inventory[activeId] = (Number(rpg.inventory[activeId]) || 0) + 1;
    }
    rpg.inventory[id] -= 1;
    if (rpg.inventory[id] <= 0) delete rpg.inventory[id];
    rpg.equipment[id] = true;
    save();
    return sendItemCaption(sock, chatId, msg, id, `✅ Equipaste *${item.name}*.\n⚔️ Poder: *${power(user)}* · 🛡️ Defensa: *${defense(user)}*${activeId ? `\n📦 ${RPG_ITEMS[activeId].name} volvió a tu bolsa.` : ''}`);
}

function raidParticipantKey(botData, raid, jid, sameIdentity) {
    return Object.keys(raid?.participants || {}).find(key => sameIdentity(botData, key, jid));
}
function raidForPlayer(botData, chatId, jid, sameIdentity) {
    return Object.values(botData.rpgRaids || {}).find(raid => raid.chatId === chatId && raidParticipantKey(botData, raid, jid, sameIdentity) && ['lobby', 'active'].includes(raid.status));
}
function raidStatus(raid) {
    const members = Object.values(raid.participants || {});
    const damage = members.reduce((sum, member) => sum + Number(member.damage || 0), 0);
    return `👥 Participantes: *${members.length}/${raid.maxPlayers}*\n${members.map(member => `• ${member.name} · ${member.damage || 0} daño`).join('\n') || 'Nadie'}\n\n❤️ Jefe: *${raid.boss.currentHp}/${raid.boss.hp} HP*\n⚔️ Daño acumulado: *${damage}*`;
}
async function handleRaid({ sock, chatId, msg, args, user, jid, botData, save, prefix, sameIdentity = (_data, left, right) => left === right }) {
    if (!String(chatId).endsWith('@g.us')) return imageReply(sock, chatId, msg, 'raid', '❌ Las raids cooperativas solo pueden jugarse dentro de un grupo.');
    botData.rpgRaids ||= {};
    const action = String(args[0] || 'ayuda').toLowerCase();
    const current = raidForPlayer(botData, chatId, jid, sameIdentity);
    if (['ayuda', 'help'].includes(action)) return imageWithActions(sock, chatId, msg, 'raid', `🐉 *RAIDS COOPERATIVAS*\n\n${prefix}raid crear dragon · Crear lobby\n${prefix}raid unirse <ID> · Unirse a una raid\n${prefix}raid iniciar [ID] · Comenzar con 2+ jugadores\n${prefix}raid atacar · Golpear al jefe\n${prefix}raid estado · Ver progreso\n${prefix}raid salir · Salir del lobby\n\nJefes: *dragon*, *titan*, *lich*`, [
        { label: '📋 Ver raids', command: `${prefix}raid lista` },
        { label: '🐉 Crear Dragón', command: `${prefix}raid crear dragon` },
        { label: '🗂️ Menú RPG', command: `${prefix}rpgmenu` }
    ]);
    if (action === 'lista') {
        const open = Object.values(botData.rpgRaids).filter(raid => raid.chatId === chatId && raid.status === 'lobby');
        const buttons = open.slice(0, 2).map(raid => ({ label: `🤝 Unirse ${raid.boss.name}`, command: `${prefix}raid unirse ${raid.id}` }));
        if (buttons.length < 3) buttons.push({ label: '🐉 Crear raid', command: `${prefix}raid crear dragon` });
        if (buttons.length < 3) buttons.push({ label: '⚔️ Ayuda', command: `${prefix}raid ayuda` });
        return imageWithActions(sock, chatId, msg, 'raid', open.length ? `📋 *RAIDS ABIERTAS*\n\n${open.map(raid => `• *${raid.id}* · ${raid.boss.name} · ${Object.keys(raid.participants).length}/${raid.maxPlayers}`).join('\n')}` : '📋 No hay raids abiertas. Crea una con *.raid crear dragon*.', buttons);
    }
    if (action === 'crear') {
        if (current) return imageReply(sock, chatId, msg, 'raid', '❌ Ya estás en una raid activa o en un lobby.');
        const key = String(args[1] || 'dragon').toLowerCase();
        const boss = RAID_BOSSES[key === 'dragon' ? 'dragon_ancient' : key === 'reyliche' ? 'lich' : key];
        if (!boss) return imageReply(sock, chatId, msg, 'raid', '❌ Jefe desconocido. Usa: *dragon*, *titan* o *lich*.');
        if (Number(ensureRpg(user).level) < boss.minLevel) return imageReply(sock, chatId, msg, 'raid', `❌ Necesitas nivel *${boss.minLevel}* para retar a ${boss.name}.`);
        const id = `raid-${Date.now().toString(36).slice(-6)}`;
        botData.rpgRaids[id] = { id, chatId, creator: jid, status: 'lobby', maxPlayers: 8, boss: { ...boss, currentHp: boss.hp }, participants: { [jid]: { jid, name: msg?.pushName || jid.split('@')[0], damage: 0 } }, actions: {}, round: 1, createdAt: new Date().toISOString() };
        save();
        return imageWithActions(sock, chatId, msg, 'raid', `🐉 *RAID CREADA*\n\nJefe: *${boss.name}*\nID: *${id}*\n\nComparte el ID y espera a otro aventurero. El creador iniciará cuando haya 2+ jugadores.`, [
            { label: '🤝 Compartir/unirse', command: `${prefix}raid unirse ${id}` },
            { label: '📋 Ver raids', command: `${prefix}raid lista` },
            { label: '📊 Estado', command: `${prefix}raid estado` }
        ]);
    }
    if (action === 'unirse') {
        const raid = botData.rpgRaids[String(args[1] || '')];
        if (!raid || raid.chatId !== chatId || raid.status !== 'lobby') return imageReply(sock, chatId, msg, 'raid', '❌ No encontré un lobby abierto con ese ID.');
        if (current && current.id !== raid.id) return imageReply(sock, chatId, msg, 'raid', '❌ Ya estás en otra raid o lobby. Sal de esa primero.');
        if (raidParticipantKey(botData, raid, jid, sameIdentity)) return imageWithActions(sock, chatId, msg, 'raid', '✅ Ya estás dentro de esta raid.', [{ label: '📊 Estado', command: `${prefix}raid estado` }, { label: '📋 Ver raids', command: `${prefix}raid lista` }]);
        if (Object.keys(raid.participants).length >= raid.maxPlayers) return imageReply(sock, chatId, msg, 'raid', '❌ La raid está llena.');
        raid.participants[jid] = { jid, name: msg?.pushName || jid.split('@')[0], damage: 0 };
        save();
        return imageWithActions(sock, chatId, msg, 'raid', `✅ Te uniste a *${raid.boss.name}*.\n\n${raidStatus(raid)}\n\nEl creador puede iniciar con *${prefix}raid iniciar ${raid.id}*.`, [
            { label: '📊 Estado', command: `${prefix}raid estado` },
            { label: '🔥 Iniciar raid', command: `${prefix}raid iniciar ${raid.id}` },
            { label: '📋 Ver raids', command: `${prefix}raid lista` }
        ]);
    }
    const raid = current || (args[1] && botData.rpgRaids[args[1]]);
    const participantKey = raid ? raidParticipantKey(botData, raid, jid, sameIdentity) : null;
    if (action === 'estado') return raid
        ? imageWithActions(sock, chatId, msg, 'raid', `🐉 *${raid.boss.name}* · ${raid.status.toUpperCase()}\n\n${raidStatus(raid)}`, raid.status === 'active'
            ? [{ label: '⚔️ Atacar', command: `${prefix}raid atacar` }, { label: '📊 Actualizar', command: `${prefix}raid estado` }, { label: '🎒 Inventario', command: `${prefix}inventario` }]
            : [{ label: '🔥 Iniciar raid', command: `${prefix}raid iniciar ${raid.id}` }, { label: '📋 Ver raids', command: `${prefix}raid lista` }])
        : imageWithActions(sock, chatId, msg, 'raid', 'ℹ️ No estás en una raid.', [{ label: '📋 Ver raids', command: `${prefix}raid lista` }, { label: '🐉 Crear raid', command: `${prefix}raid crear dragon` }]);
    if (action === 'salir') { if (!raid || !participantKey) return imageReply(sock, chatId, msg, 'raid', 'ℹ️ No estás en una raid.'); if (raid.status !== 'lobby') return imageReply(sock, chatId, msg, 'raid', '❌ No puedes salir cuando la batalla ya comenzó.'); if (sameIdentity(botData, raid.creator, jid)) { delete botData.rpgRaids[raid.id]; } else delete raid.participants[participantKey]; save(); return imageReply(sock, chatId, msg, 'raid', '↩️ Saliste del lobby de la raid.'); }
    if (action === 'iniciar') { const target = botData.rpgRaids[String(args[1] || '')] || raid; if (!target || target.chatId !== chatId) return imageReply(sock, chatId, msg, 'raid', '❌ No encontré esa raid.'); if (!sameIdentity(botData, target.creator, jid)) return imageReply(sock, chatId, msg, 'raid', '❌ Solo quien creó la raid puede iniciarla.'); if (Object.keys(target.participants).length < 2) return imageWithActions(sock, chatId, msg, 'raid', '❌ Necesitan al menos 2 jugadores para comenzar.', [{ label: '📊 Estado', command: `${prefix}raid estado` }, { label: '📋 Ver raids', command: `${prefix}raid lista` }]); target.status = 'active'; target.startedAt = new Date().toISOString(); save(); return imageWithActions(sock, chatId, msg, 'raid', `🔥 *RAID INICIADA*\n\n${target.boss.name} despertó. Cada jugador puede atacar una vez por ronda.\n\n${raidStatus(target)}\n\nUsen *${prefix}raid atacar*.`, [{ label: '⚔️ Atacar', command: `${prefix}raid atacar` }, { label: '📊 Estado', command: `${prefix}raid estado` }, { label: '🎒 Inventario', command: `${prefix}inventario` }]); }
    if (action === 'atacar' || action === 'attack') {
        if (!raid || raid.status !== 'active') return imageReply(sock, chatId, msg, 'raid', '❌ No tienes una raid activa.');
        if (!participantKey) return imageReply(sock, chatId, msg, 'raid', `❌ No formas parte de esta raid. Únete con *${prefix}raid unirse ${raid.id}*.`);
        raid.actions ||= {};
        if (raid.actions[participantKey] === raid.round) return imageWithActions(sock, chatId, msg, 'raid', '⏳ Ya atacaste en esta ronda. Espera a tus compañeros.', [{ label: '📊 Estado', command: `${prefix}raid estado` }, { label: '🎒 Inventario', command: `${prefix}inventario` }]);
        const rpg = ensureRpg(user);
        const damage = Math.max(20, power(user) + Math.floor(Math.random() * 35));
        raid.round ||= 1;
        raid.actions[participantKey] = raid.round;
        raid.participants[participantKey].damage = (Number(raid.participants[participantKey].damage) || 0) + damage;
        raid.boss.currentHp = Math.max(0, raid.boss.currentHp - damage);
        if (raid.boss.currentHp <= 0) {
            const users = botData.economy?.[chatId]?.users || {};
            const eligible = Object.values(raid.participants).map(member => ({
                member,
                user: Object.entries(users).find(([key]) => sameIdentity(botData, key, member.jid))?.[1]
            })).filter(entry => entry.user);
            const total = eligible.reduce((sum, entry) => sum + Number(entry.member.damage || 0), 0);
            const participantCount = eligible.length;
            const rewardBudget = Math.max(0, Math.floor(Number(raid.boss.reward) || 0));
            let distributed = 0;
            const rewards = [];
            for (const [index, { member, user: memberUser }] of eligible.entries()) {
                const share = index === participantCount - 1
                    ? Math.max(0, rewardBudget - distributed)
                    : Math.floor(rewardBudget * (.7 / participantCount + .3 * (Number(member.damage || 0) / Math.max(1, total))));
                distributed += share;
                memberUser.coins = (Number(memberUser.coins) || 0) + share;
                const memberRpg = ensureRpg(memberUser);
                addXp(memberUser, raid.boss.xp);
                memberRpg.materials[raid.boss.drop] = (Number(memberRpg.materials[raid.boss.drop]) || 0) + 1;
                memberRpg.stats.raidsWon = (Number(memberRpg.stats.raidsWon) || 0) + 1;
                if (Number(memberRpg.stats.raidsWon) >= 3) grantTitle(memberUser, 'Cazador de jefes');
                rewards.push(`${member.name}: +${fmt(share)} monedas`);
            }
            raid.status = 'victory';
            raid.finishedAt = new Date().toISOString();
            save();
            return imageWithActions(sock, chatId, msg, 'raid', `🏆 *¡JEFE DERROTADO!*\n\n${raid.boss.name} cayó después de ${raid.round || 1} rondas.\n📦 Drop épico para todos: *${raid.boss.drop}*\n💰 El oro del jefe se reparte entre el grupo: 70% en partes iguales y 30% según el daño aportado. No se genera oro extra.\n\n${rewards.join('\n')}`, [
                { label: '📜 Misiones', command: `${prefix}misiones` },
                { label: '🎒 Inventario', command: `${prefix}inventario` },
                { label: '🗂️ Menú RPG', command: `${prefix}rpgmenu` }
            ]);
        }
        const targetJids = Object.keys(raid.participants);
        const target = targetJids[Math.floor(Math.random() * targetJids.length)];
        const users = botData.economy?.[chatId]?.users || {};
        const targetUser = Object.entries(users).find(([key]) => sameIdentity(botData, key, target))?.[1];
        const taken = Math.max(8, Math.floor(raid.boss.attack * (.75 + Math.random() * .35)));
        if (targetUser) {
            const targetRpg = ensureRpg(targetUser);
            targetRpg.hp = Math.max(1, targetRpg.hp - taken);
        }
        const everyoneActed = targetJids.every(member => raid.actions[member] === raid.round);
        if (everyoneActed) { raid.round = (raid.round || 1) + 1; raid.actions = {}; }
        save();
        const sent = await imageReply(sock, chatId, msg, 'raid', `⚔️ *${msg?.pushName || 'Jugador'}* causó *${damage} de daño* a ${raid.boss.name}.\n💥 El jefe golpeó a *${raid.participants[target].name}* por *${taken} de daño*.\n\n${raidStatus(raid)}\n\n${everyoneActed ? `➡️ Comienza la ronda ${raid.round}.` : 'Los demás jugadores pueden atacar.'}`);
        const buttons = everyoneActed
            ? [{ label: '⚔️ Nueva ronda', command: `${prefix}raid atacar` }, { label: '📊 Estado', command: `${prefix}raid estado` }, { label: '🎒 Inventario', command: `${prefix}inventario` }]
            : [{ label: '📊 Estado', command: `${prefix}raid estado` }, { label: '🎒 Inventario', command: `${prefix}inventario` }];
        await sendActionButtons(sock, chatId, '🐉 Turno de la raid:', buttons, sent || msg);
        return sent;
    }
    return imageReply(sock, chatId, msg, 'raid', `ℹ️ Usa *${prefix}raid ayuda* para ver los comandos.`);
}

async function handleExpansion({ sock, chatId, msg, canonical, args, user, jid, botData, save, prefix = '.', sameIdentity = (_data, left, right) => left === right }) {
    const command = String(canonical || '').toLowerCase();
    if (command === 'raid') return handleRaid({ sock, chatId, msg, args, user, jid, botData, save, prefix, sameIdentity });
    if (!['combat', 'inventory', 'craft', 'quest', 'title', 'market', 'season', 'skills', 'potion', 'useitem', 'rpgstatus'].includes(command)) return false;
    const rpg = ensureRpg(user);
    updateTitles(user);
    if (command === 'inventory') {
        const gearResponse = handleGearAction(sock, chatId, msg, args, user, rpg, save, prefix);
        if (gearResponse) return gearResponse;
        const sent = await imageReply(sock, chatId, msg, 'inventory', itemText(user, prefix));
        const buttons = availableConsumables(rpg).slice(0, 2).map(([id, item]) => ({ label: `🧪 Usar ${item.name.replace(/^[^\p{L}\p{N}]+/u, '')}`, command: `${prefix}usar ${id}` }));
        buttons.push({ label: '🗂️ Menú RPG', command: `${prefix}rpgmenu` });
        return sendActionButtons(sock, chatId, '🎒 Acciones de mochila:', buttons, sent || msg).then(() => sent);
    }
    if (command === 'rpgstatus') {
        const sent = await reply(sock, chatId, msg, `📊 *ESTADO DEL AVENTURERO*\n\n${classLabel(user)} · Nivel ${rpg.level}\n❤️ Vida: *${rpg.hp}/${rpg.maxHp}*\n⚡ Energía: *${rpg.energy}/${rpg.maxEnergy}*\n⚔️ Poder: *${power(user)}*\n🏆 Títulos: *${rpg.titles.length ? rpg.titles.join(', ') : 'Ninguno'}*\n🏅 PvP: *${rpg.pvp.wins}V-${rpg.pvp.losses}D* · ELO *${rpg.pvp.elo}*`);
        await sendActionButtons(sock, chatId, '📊 Accesos del aventurero:', [
            { label: '🎒 Inventario', command: `${prefix}inventario` },
            { label: '⚔️ Iniciar combate', command: `${prefix}combate iniciar` },
            { label: '📜 Misiones', command: `${prefix}misiones` }
        ], sent || msg);
        return sent;
    }
    if (command === 'skills') {
        const skills = CLASS_SKILLS[classKey(user)] || [];
        const activeBattle = battleFor(botData, chatId, jid);
        const sent = await reply(sock, chatId, msg, `✨ *HABILIDADES DE ${classLabel(user).toUpperCase()}*\n\n${skills.map(skill => `• *${prefix}combate habilidad ${skill.id}* — ${skill.name} (${skill.cost}⚡)\n  ${skill.description}`).join('\n')}`);
        const buttons = activeBattle
            ? skills.slice(0, 2).map(skill => ({ label: `✨ ${skill.name}`, command: `${prefix}combate habilidad ${skill.id}` })).concat([{ label: '🛡️ Defender', command: `${prefix}combate defender` }])
            : [{ label: '⚔️ Iniciar combate', command: `${prefix}combate iniciar` }, { label: '🎒 Inventario', command: `${prefix}inventario` }, { label: '📊 Estadísticas', command: `${prefix}estadisticas` }];
        await sendActionButtons(sock, chatId, '✨ Acciones de habilidad:', buttons, sent || msg);
        return sent;
    }
    if (command === 'potion' || command === 'useitem') {
        const explicit = String(args.join(' ') || '').trim();
        const available = availableConsumables(rpg);
        if (!explicit && command === 'useitem') {
            const buttons = available.slice(0, 3).map(([id, item]) => ({ label: `Usar ${item.name.replace(/^[^\p{L}\p{N}]+/u, '')}`, command: `${prefix}usar ${id}` }));
            if (!buttons.length) buttons.push({ label: '🧑‍🌾 Abrir mercader', command: `${prefix}mercader` }, { label: '🔨 Ver recetas', command: `${prefix}fabricar` });
            const sent = await reply(sock, chatId, msg, available.length ? `🧪 *CONSUMIBLES EN TU BOLSA*\n\n${available.map(([id, item]) => `• ${item.name} x${rpg.inventory[id]} — ${item.heal ? `cura hasta ${item.heal} HP` : `recupera hasta ${item.energy} energía`} · *${prefix}usar ${id}*`).join('\n')}` : `🧪 No tienes consumibles. Compra en *${prefix}mercader* o revisa las recetas con *${prefix}fabricar*.`);
            await sendActionButtons(sock, chatId, '🧪 Selecciona qué consumir:', buttons, sent || msg);
            return sent;
        }
        const selectedId = explicit ? consumableId(explicit) : (Number(rpg.inventory.potion) > 0 ? 'potion' : null);
        if (!selectedId) {
            const buttons = available.slice(0, 3).map(([id, item]) => ({ label: `Usar ${item.name.replace(/^[^\p{L}\p{N}]+/u, '')}`, command: `${prefix}usar ${id}` }));
            if (!buttons.length) buttons.push({ label: '🧑‍🌾 Abrir mercader', command: `${prefix}mercader` }, { label: '🔨 Fabricar poción', command: `${prefix}fabricar pocion` });
            const sent = await reply(sock, chatId, msg, explicit ? `❌ No reconozco ese consumible. Usa *${prefix}objeto* para consultar el catálogo.` : `❌ No tienes la poción básica. Mira tus consumibles con *${prefix}usar* o fabrica una con *${prefix}fabricar pocion*.`);
            await sendActionButtons(sock, chatId, '🧪 Opciones de consumibles:', buttons, sent || msg);
            return sent;
        }
        const item = RPG_ITEMS[selectedId];
        if ((Number(rpg.inventory[selectedId]) || 0) < 1) {
            const recipeId = Object.entries(RECIPES).find(([, recipe]) => Number(recipe.gives?.[selectedId]) > 0)?.[0];
            const buttons = [{ label: '🧑‍🌾 Abrir mercader', command: `${prefix}mercader` }];
            if (recipeId) buttons.push({ label: '🔨 Fabricar', command: `${prefix}fabricar ${recipeId}` });
            buttons.push({ label: '🎒 Inventario', command: `${prefix}inventario` });
            return replyWithActions(sock, chatId, msg, `❌ No tienes *${item.name}*.`, buttons, '🧪 Consigue este consumible:');
        }
        let effect = 0;
        if (item.heal) {
            effect = Math.min(Number(item.heal), Math.max(0, rpg.maxHp - rpg.hp));
            if (!effect) return reply(sock, chatId, msg, `❤️ Tienes la vida completa (*${rpg.hp}/${rpg.maxHp}*). No se consumió *${item.name}*.`);
            rpg.hp += effect;
        } else if (item.energy) {
            effect = Math.min(Number(item.energy), Math.max(0, rpg.maxEnergy - rpg.energy));
            if (!effect) return reply(sock, chatId, msg, `⚡ Tienes la energía completa (*${rpg.energy}/${rpg.maxEnergy}*). No se consumió *${item.name}*.`);
            rpg.energy += effect;
        }
        rpg.inventory[selectedId] -= 1;
        if (rpg.inventory[selectedId] <= 0) delete rpg.inventory[selectedId];
        save();
        const battle = battleFor(botData, chatId, jid);
        const buttons = battle
            ? [{ label: '⚔️ Atacar', command: `${prefix}combate atacar` }, { label: '🛡️ Defender', command: `${prefix}combate defender` }, { label: '📊 Estado', command: `${prefix}combate estado` }]
            : [{ label: '🎒 Inventario', command: `${prefix}inventario` }, { label: '🏰 Mazmorra', command: `${prefix}mazmorra` }, { label: '🗂️ Menú RPG', command: `${prefix}rpgmenu` }];
        const sent = await reply(sock, chatId, msg, `🧪 Usaste *${item.name}* y recuperaste *${effect} ${item.heal ? 'HP' : 'energía'}*.\n❤️ Vida: *${rpg.hp}/${rpg.maxHp}* · ⚡ Energía: *${rpg.energy}/${rpg.maxEnergy}*`);
        await sendActionButtons(sock, chatId, '✨ Continúa tu aventura:', buttons, sent || msg);
        return sent;
    }
    if (command === 'combat') {
        botData.rpgBattles ||= {};
        botData.rpgBattles[chatId] ||= {};
        let battle = battleFor(botData, chatId, jid);
        const action = String(args[0] || 'estado').toLowerCase();
        const activeSkills = CLASS_SKILLS[classKey(user)] || [];
        const combatButtons = () => [
            { label: '⚔️ Atacar', command: `${prefix}combate atacar` },
            activeSkills[0] ? { label: `✨ ${activeSkills[0].name}`, command: `${prefix}combate habilidad ${activeSkills[0].id}` } : { label: '✨ Habilidades', command: `${prefix}habilidades` },
            { label: '🛡️ Defender', command: `${prefix}combate defender` }
        ];
        if (['iniciar', 'start', 'buscar'].includes(action)) {
            if (battle) {
                const sent = await reply(sock, chatId, msg, `⚔️ Ya estás luchando contra *${battle.enemy.name}*.`);
                await sendActionButtons(sock, chatId, '⚔️ Elige tu acción:', combatButtons(), sent || msg);
                return sent;
            }
            const enemy = enemyFor(user);
            battle = { enemy: { ...enemy, currentHp: enemy.hp }, turn: 1, guard: false, startedAt: Date.now() };
            botData.rpgBattles[chatId][jid] = battle;
            save();
            const sent = await reply(sock, chatId, msg, `⚔️ *COMBATE INICIADO*\n\n👾 Enemigo: *${enemy.name}* · Nivel ${enemy.level}\n❤️ Vida: *${enemy.hp}/${enemy.hp}*\n\nCada acción válida consume energía; una victoria entrega *${fmt(enemy.reward)} monedas* y materiales.`);
            await sendActionButtons(sock, chatId, '⚔️ Primer turno:', combatButtons(), sent || msg);
            return sent;
        }
        if (!battle) {
            const sent = await reply(sock, chatId, msg, `ℹ️ No tienes combate activo. Inicia uno para ganar oro y materiales: *${prefix}combate iniciar*.`);
            await sendActionButtons(sock, chatId, '🗺️ Acciones de aventura:', [
                { label: '⚔️ Iniciar combate', command: `${prefix}combate iniciar` },
                { label: '🎒 Inventario', command: `${prefix}inventario` },
                { label: '📜 Misiones', command: `${prefix}misiones` }
            ], sent || msg);
            return sent;
        }
        if (['huir', 'flee'].includes(action)) {
            delete botData.rpgBattles[chatId][jid];
            save();
            return reply(sock, chatId, msg, '🏃 Escapaste del combate.');
        }
        if (action === 'estado') {
            const sent = await reply(sock, chatId, msg, `⚔️ *COMBATE CONTRA ${battle.enemy.name.toUpperCase()}*\n\n❤️ Tú: ${rpg.hp}/${rpg.maxHp}\n👾 Enemigo: ${battle.enemy.currentHp}/${battle.enemy.hp}\n⚡ Energía: ${rpg.energy}/${rpg.maxEnergy}`);
            await sendActionButtons(sock, chatId, '⚔️ Elige tu acción:', combatButtons(), sent || msg);
            return sent;
        }
        const skillAction = action === 'habilidad' || action === 'skill';
        const skill = skillAction ? activeSkills.find(item => item.id === String(args[1] || '').toLowerCase()) : null;
        if (skillAction && !skill) return reply(sock, chatId, msg, `ℹ️ Habilidad desconocida. Elige una con *${prefix}habilidades*.`);
        if (!skillAction && !['atacar', 'attack', 'defender'].includes(action)) return reply(sock, chatId, msg, `❌ Esa acción no existe. Usa los botones del combate o *${prefix}combate estado*.`);
        let damage = Math.max(8, power(user) + Math.floor(Math.random() * 16) - 8);
        let message = '';
        if (action !== 'defender') {
            const energyCost = skillAction ? skill.cost : 3;
            const energy = consumeEnergy(user, energyCost);
            if (!energy.ok) return reply(sock, chatId, msg, `⚡ No tienes suficiente energía. Necesitas *${energyCost}* y tienes *${energy.energy}/${energy.maxEnergy}*. Usa *${prefix}usar elixir_energia* si tienes uno.`);
        }
        if (action === 'defender') {
            rpg.energy = Math.min(rpg.maxEnergy, rpg.energy + 6);
            battle.guard = true;
            message = '🛡️ Adoptaste una postura defensiva.';
        } else if (skillAction) {
            damage = Math.floor(damage * (skill.power || 1));
            const healed = skill.heal ? Math.min(skill.heal, rpg.maxHp - rpg.hp) : 0;
            rpg.hp += healed;
            if (skill.guard) battle.guard = true;
            message = `✨ Usaste *${skill.name}* y causaste *${damage} de daño*${healed ? `; recuperaste *${healed} HP*` : ''}${skill.guard ? '; el escudo mitigará el contraataque' : ''}.`;
        } else {
            const critical = Math.random() < 0.12;
            if (critical) damage = Math.floor(damage * 1.7);
            message = `${critical ? '💥 ¡Golpe crítico!' : '⚔️ Atacaste'} Causaste *${damage} de daño*.`;
        }
        if (action !== 'defender') battle.enemy.currentHp = Math.max(0, battle.enemy.currentHp - damage);
        if (battle.enemy.currentHp <= 0) {
            user.coins += battle.enemy.reward;
            const xp = addXp(user, battle.enemy.xp);
            const completed = recordMissionEvent(user, 'combat', 1);
            completed.forEach(mission => addXp(user, mission.xp));
            rpg.materials[battle.enemy.drop] = (Number(rpg.materials[battle.enemy.drop]) || 0) + 1;
            rpg.materials.hierba = (Number(rpg.materials.hierba) || 0) + 1;
            rpg.materials.agua = (Number(rpg.materials.agua) || 0) + 1;
            rpg.materials.carbon = (Number(rpg.materials.carbon) || 0) + (Math.random() < .5 ? 1 : 0);
            if (rpg.quest && !rpg.quest.claimed) rpg.quest.progress = Math.min(rpg.quest.target, Number(rpg.quest.progress || 0) + 1);
            const welcomeText = completeWelcomeMission(user);
            delete botData.rpgBattles[chatId][jid];
            save();
            const missionText = completed.map(mission => `\n📜 Misión: *${mission.title}* · +${fmt(mission.reward)} monedas`).join('');
            const sent = await reply(sock, chatId, msg, `${message}\n\n🏆 *VICTORIA* contra ${battle.enemy.name}\n🪙 +${fmt(battle.enemy.reward)} monedas · ✨ +${battle.enemy.xp} XP${levelUpText(xp)}\n📦 Drop: *${battle.enemy.drop}*${missionText}${welcomeText ? `\n\n${welcomeText}` : ''}`);
            await sendActionButtons(sock, chatId, '🏆 ¿Qué harás ahora?', [
                { label: '⚔️ Siguiente combate', command: `${prefix}combate iniciar` },
                { label: '🎒 Inventario', command: `${prefix}inventario` },
                { label: '📜 Misiones', command: `${prefix}misiones` }
            ], sent || msg);
            return sent;
        }
        const incoming = Math.max(1, battle.enemy.attack + Math.floor(Math.random() * 12) - 6 - defense(user));
        const taken = battle.guard ? Math.floor(incoming * .45) : incoming;
        rpg.hp = Math.max(0, rpg.hp - taken);
        battle.guard = false;
        battle.turn += 1;
        if (rpg.hp <= 0) {
            rpg.hp = Math.ceil(rpg.maxHp * .35);
            delete botData.rpgBattles[chatId][jid];
            save();
            const sent = await reply(sock, chatId, msg, `${message}\n💥 ${battle.enemy.name} te derrotó. Recuperaste ${rpg.hp} HP, pero no obtuviste recompensa.`);
            await sendActionButtons(sock, chatId, '❤️ Prepárate para el próximo encuentro:', [
                { label: '🧪 Usar poción', command: `${prefix}pocion` },
                { label: '🎒 Inventario', command: `${prefix}inventario` },
                { label: '⚔️ Nuevo combate', command: `${prefix}combate iniciar` }
            ], sent || msg);
            return sent;
        }
        save();
        const sent = await reply(sock, chatId, msg, `${message}\n👾 Contraataque: recibiste *${taken} de daño*.\n❤️ Tu vida: *${rpg.hp}/${rpg.maxHp}*\n👾 Enemigo: *${battle.enemy.currentHp}/${battle.enemy.hp}*`);
        await sendActionButtons(sock, chatId, '⚔️ Elige tu siguiente acción:', combatButtons(), sent || msg);
        return sent;
    }
    if (command === 'craft') {
        const recipe = RECIPES[String(args[0] || '').toLowerCase()];
        if (!recipe) {
            const entries = Object.entries(RECIPES);
            const consumableRecipes = entries.filter(([, item]) => Object.keys(item.gives || {}).some(id => RPG_ITEMS[id]?.type === 'consumible'));
            const otherRecipes = entries.filter(([, item]) => !Object.keys(item.gives || {}).some(id => RPG_ITEMS[id]?.type === 'consumible'));
            const render = list => list.map(([id, item]) => `• *${prefix}fabricar ${id}* — ${item.name}: ${Object.entries(item.materials).map(([m, n]) => `${m} x${n}`).join(', ')} + ${fmt(item.coins)} oro`).join('\n');
            const sent = await reply(sock, chatId, msg, `🔨 *TALLER DEL AVENTURERO*\n\n🧪 *Consumibles*\n${render(consumableRecipes)}\n\n⚔️ *Equipo y accesorios*\n${render(otherRecipes)}\n\nLos botones fabrican la receta indicada y descuentan sus materiales y monedas.`);
            const buttons = entries.map(([id, item]) => ({ label: `🔨 ${item.name}`, command: `${prefix}fabricar ${id}` }));
            for (let index = 0; index < buttons.length; index += 3) await sendActionButtons(sock, chatId, '🧰 Recetas del taller:', buttons.slice(index, index + 3), sent || msg);
            return sent;
        }
        if (user.coins < recipe.coins) return replyWithActions(sock, chatId, msg, `❌ Necesitas *${fmt(recipe.coins)} monedas* para fabricar ${recipe.name}.`, [
            { label: '🧑‍🌾 Abrir mercader', command: `${prefix}mercader` },
            { label: '💼 Trabajar', command: `${prefix}work` },
            { label: '🎒 Inventario', command: `${prefix}inventario` }
        ], '🧰 Opciones de fabricación:');
        if (Object.entries(recipe.materials).some(([material, needed]) => Number(rpg.materials[material] || 0) < needed)) return replyWithActions(sock, chatId, msg, '❌ Te faltan materiales. Consíguelos combatiendo y explorando.', [
            { label: '⚔️ Combatir', command: `${prefix}combate iniciar` },
            { label: '🧭 Explorar', command: `${prefix}explorar` },
            { label: '🎒 Inventario', command: `${prefix}inventario` }
        ], '🧭 Consigue los materiales:');
        for (const [material, needed] of Object.entries(recipe.materials)) rpg.materials[material] -= needed;
        user.coins -= recipe.coins;
        for (const [id, amount] of Object.entries(recipe.gives)) {
            rpg.inventory[id] = (Number(rpg.inventory[id]) || 0) + amount;
            const item = RPG_ITEMS[id];
            const occupied = item?.slot && Object.keys(rpg.equipment).some(otherId => rpg.equipment[otherId] && RPG_ITEMS[otherId]?.slot === item.slot);
            if (item?.slot && !occupied) {
                rpg.inventory[id] -= 1;
                if (rpg.inventory[id] <= 0) delete rpg.inventory[id];
                rpg.equipment[id] = true;
            }
        }
        save();
        const craftedId = Object.keys(recipe.gives).find(id => RPG_ITEMS[id]);
        const sent = await sendItemCaption(sock, chatId, msg, craftedId, `🔨 Fabricaste *${recipe.name}* correctamente.\n\n${itemText(user, prefix)}`);
        const buttons = RPG_ITEMS[craftedId]?.type === 'consumible'
            ? [{ label: '🧪 Usar ahora', command: `${prefix}usar ${craftedId}` }, { label: '🎒 Inventario', command: `${prefix}inventario` }, { label: '🔨 Más recetas', command: `${prefix}fabricar` }]
            : [{ label: '🎒 Inventario', command: `${prefix}inventario` }, { label: '🏪 Subastar objeto', command: `${prefix}subastar ${craftedId}` }, { label: '🔨 Más recetas', command: `${prefix}fabricar` }];
        await sendActionButtons(sock, chatId, '✨ ¿Qué quieres hacer ahora?', buttons, sent || msg);
        return sent;
    }
    if (command === 'quest') {
        rpg.quest ||= { id: 'la_amenaza', title: 'La amenaza del bosque', objective: 'Derrota 3 enemigos', progress: 0, target: 3, reward: 900, claimed: false };
        if (actionIs(args, ['nueva', 'new'])) { rpg.quest = { id: `quest-${Date.now()}`, title: 'La amenaza del bosque', objective: 'Derrota 3 enemigos', progress: 0, target: 3, reward: 900, claimed: false }; save(); }
        if (args[0] === 'reclamar' && rpg.quest.progress >= rpg.quest.target && !rpg.quest.claimed) {
            rpg.quest.claimed = true;
            user.coins += rpg.quest.reward;
            save();
            const sent = await reply(sock, chatId, msg, `🎉 Misión completada. Recompensa: *${fmt(rpg.quest.reward)} monedas*`);
            await sendActionButtons(sock, chatId, '📜 Sigue avanzando:', [{ label: '⚔️ Combatir', command: `${prefix}combate iniciar` }, { label: '📜 Ver campaña', command: `${prefix}campaña` }, { label: '🎒 Inventario', command: `${prefix}inventario` }], sent || msg);
            return sent;
        }
        const completed = Number(rpg.quest.progress) >= Number(rpg.quest.target);
        const sent = await reply(sock, chatId, msg, `📜 *${rpg.quest.title}*\n${rpg.quest.objective}\nProgreso: *${rpg.quest.progress}/${rpg.quest.target}*\nRecompensa: *${fmt(rpg.quest.reward)} monedas*\n${completed ? `Reclama con *${prefix}campaña reclamar*` : 'Explora y combate para avanzar.'}`);
        const buttons = completed
            ? [{ label: '🎁 Reclamar recompensa', command: `${prefix}campaña reclamar` }, { label: '🎒 Inventario', command: `${prefix}inventario` }, { label: '🗂️ Menú RPG', command: `${prefix}rpgmenu` }]
            : [{ label: '⚔️ Iniciar combate', command: `${prefix}combate iniciar` }, { label: '🧭 Explorar', command: `${prefix}explorar` }, { label: '🎒 Inventario', command: `${prefix}inventario` }];
        await sendActionButtons(sock, chatId, '📜 Acciones de campaña:', buttons, sent || msg);
        return sent;
    }
    if (command === 'title') {
        const titleAction = String(args[0] || '').toLowerCase();
        updateTitles(user);
        if (titleAction === 'usar' && args[1]) {
            const title = args.slice(1).join(' ');
            if (!rpg.titles.includes(title)) return reply(sock, chatId, msg, '❌ Ese título no está desbloqueado.');
            rpg.activeTitle = title;
            save();
        }
        const sent = await reply(sock, chatId, msg, `🏷️ *TÍTULOS DEL AVENTURERO*\n\n${rpg.titles.length ? rpg.titles.map(title => `${rpg.activeTitle === title ? '✅' : '▫️'} ${title}`).join('\n') : 'Aún no tienes títulos.'}`);
        const buttons = rpg.titles.slice(0, 3).map(title => ({ label: `🏷️ ${title}`, command: `${prefix}titulos usar ${title}` }));
        if (!buttons.length) buttons.push({ label: '⚔️ Combate', command: `${prefix}combate iniciar` }, { label: '📜 Misiones', command: `${prefix}misiones` }, { label: '🗂️ Menú RPG', command: `${prefix}rpgmenu` });
        await sendActionButtons(sock, chatId, '🏷️ Equipa un título o sigue la aventura:', buttons, sent || msg);
        return sent;
    }
    if (command === 'market') {
        botData.rpgMarket ||= {};
        const action = String(args[0] || 'ver').toLowerCase();
        const knownItems = new Set(Object.keys(RPG_ITEMS));

        if (action === 'ver' || action === 'listado') {
            const listings = Object.values(botData.rpgMarket)
                .filter(item => item.status === 'open' && item.chatId === chatId && !sameIdentity(botData, item.seller, jid))
                .slice(0, 20);
            const text = listings.length
                ? `🛒 *MERCADO DEL GRUPO*\n\n${listings.map(item => `#${item.id} · ${item.sellerName} vende *${item.item}* por *${fmt(item.price)} monedas*`).join('\n')}`
                : '🛒 No hay publicaciones de otros jugadores en este chat.';
            return imageReply(sock, chatId, msg, 'market', text);
        }

        if (action === 'publicar') {
            const item = String(args[1] || '').toLowerCase();
            const price = Number(args[2]);
            if (!item || !Number.isSafeInteger(price) || price < 100) {
                return imageReply(sock, chatId, msg, 'market', `ℹ️ Uso: *${prefix}mercado publicar <objeto> <precio>* (mínimo 100).`);
            }
            if (!knownItems.has(item)) return imageReply(sock, chatId, msg, 'market', `❌ El mercado admite objetos de la mochila RPG. Para subastar botín, materiales o equipo de clase, usa *${prefix}subastar*.`);
            if ((Number(rpg.inventory[item]) || 0) < 1) return imageReply(sock, chatId, msg, 'market', '❌ No tienes ese objeto en tu inventario.');
            let id;
            do { id = `m-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`; } while (botData.rpgMarket[id]);
            rpg.inventory[item] -= 1;
            if (rpg.inventory[item] <= 0) delete rpg.inventory[item];
            botData.rpgMarket[id] = {
                id, chatId, item, price, seller: jid,
                sellerName: msg?.pushName || jid.split('@')[0],
                status: 'open', createdAt: new Date().toISOString()
            };
            save();
            return imageWithActions(sock, chatId, msg, 'market', `✅ Publicaste *${item}* por *${fmt(price)} monedas*. ID: *${id}*\n\nLa publicación queda disponible solo en este grupo.`, [
                { label: '🛒 Ver mercado', command: `${prefix}mercado ver` },
                { label: '↩️ Cancelar publicación', command: `${prefix}mercado cancelar ${id}` },
                { label: '🎒 Inventario', command: `${prefix}inventario` }
            ]);
        }

        if (action === 'cancelar') {
            const listing = botData.rpgMarket[String(args[1] || '')];
            if (!listing || listing.status !== 'open' || listing.chatId !== chatId) {
                return imageReply(sock, chatId, msg, 'market', '❌ La publicación no está disponible en este chat.');
            }
            if (!sameIdentity(botData, listing.seller, jid)) return imageReply(sock, chatId, msg, 'market', '❌ Solo quien publicó el objeto puede cancelar la venta.');
            rpg.inventory[listing.item] = (Number(rpg.inventory[listing.item]) || 0) + 1;
            listing.status = 'cancelled';
            listing.cancelledAt = new Date().toISOString();
            save();
            return imageWithActions(sock, chatId, msg, 'market', `↩️ Retiraste *${listing.item}* del mercado. Volvió a tu inventario.`, [
                { label: '🎒 Inventario', command: `${prefix}inventario` },
                { label: '🛒 Ver mercado', command: `${prefix}mercado ver` }
            ]);
        }

        if (action === 'comprar') {
            const listing = botData.rpgMarket[String(args[1] || '')];
            if (!listing || listing.status !== 'open' || listing.chatId !== chatId) {
                return imageReply(sock, chatId, msg, 'market', '❌ Publicación no disponible en este grupo. No se descontó oro.');
            }
            if (sameIdentity(botData, listing.seller, jid)) return imageReply(sock, chatId, msg, 'market', '❌ No puedes comprarte a ti mismo.');
            const price = Number(listing.price);
            if (!Number.isSafeInteger(price) || price < 100 || !knownItems.has(listing.item)) {
                return imageReply(sock, chatId, msg, 'market', '❌ La publicación tiene datos inválidos. No se descontó oro.');
            }
            const users = botData.economy?.[chatId]?.users || {};
            const sellerEntry = Object.entries(users).find(([key]) => sameIdentity(botData, key, listing.seller));
            if (!sellerEntry) return imageReply(sock, chatId, msg, 'market', '❌ No pude resolver la cuenta del vendedor en este grupo. No se descontó oro.');
            if ((Number(user.coins) || 0) < price) return imageReply(sock, chatId, msg, 'market', '❌ No tienes suficientes monedas. No se descontó oro.');
            const tax = Math.max(25, Math.ceil(price * .05));
            user.coins = (Number(user.coins) || 0) - price;
            sellerEntry[1].coins = (Number(sellerEntry[1].coins) || 0) + price - tax;
            rpg.inventory[listing.item] = (Number(rpg.inventory[listing.item]) || 0) + 1;
            listing.status = 'sold';
            listing.buyer = jid;
            listing.tax = tax;
            listing.soldAt = new Date().toISOString();
            save();
            return imageWithActions(sock, chatId, msg, 'market', `✅ Compraste *${listing.item}* por *${fmt(price)} monedas*.\n💸 Comisión: *${fmt(tax)}* · 💰 El vendedor recibió: *${fmt(price - tax)}*`, [
                { label: '🎒 Inventario', command: `${prefix}inventario` },
                { label: '🛒 Ver mercado', command: `${prefix}mercado ver` },
                { label: '🏛️ Subastas', command: `${prefix}subastas` }
            ]);
        }

        return imageWithActions(sock, chatId, msg, 'market', `ℹ️ Usa *${prefix}mercado ver*, *${prefix}mercado publicar <objeto> <precio>*, *${prefix}mercado comprar <ID>* o *${prefix}mercado cancelar <ID>*.`, [
            { label: '🛒 Ver mercado', command: `${prefix}mercado ver` },
            { label: '🎒 Inventario', command: `${prefix}inventario` },
            { label: '🏛️ Subastas', command: `${prefix}subastas` }
        ]);
    }
    if (command === 'season') { const users = Object.values(botData.economy?.[chatId]?.users || {}).map(item => ({ user: item, rpg: ensureRpg(item) })).sort((a,b) => (b.rpg.pvp.elo||0) - (a.rpg.pvp.elo||0)).slice(0,10); const sent = await reply(sock, chatId, msg, `🏆 *TEMPORADA DEL REINO*\n\n${users.length ? users.map((item,i) => `${i+1}. ${classLabel(item.user)} · ELO ${item.rpg.pvp.elo} · ${item.rpg.pvp.wins}V-${item.rpg.pvp.losses}D`).join('\n') : 'Aún no hay competidores.'}\n\nLa temporada se renueva mensualmente.`); await sendActionButtons(sock, chatId, '🏆 Acciones del reino:', [{ label: '⚔️ Iniciar combate', command: `${prefix}combate iniciar` }, { label: '🎒 Inventario', command: `${prefix}inventario` }, { label: '🗂️ Menú RPG', command: `${prefix}rpgmenu` }], sent || msg); return sent; }
    return false;
}
function actionIs(args, values) { return values.includes(String(args[0] || '').toLowerCase()); }
module.exports = { handleExpansion, ensureRpg, addXp, updateTitles, activateWelcomeMission, completeWelcomeMission, CLASS_SKILLS, RECIPES };
