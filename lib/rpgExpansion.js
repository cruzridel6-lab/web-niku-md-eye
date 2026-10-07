const { commandImagePath, sendImageCaption } = require('./rpgMedia');
const { ensureFeatureState, consumeEnergy, recordMissionEvent, levelUpText, rarityInfo } = require('./rpgFeatures');
const { CLASS_EQUIPMENT, DUNGEON_LOOT, RPG_ITEMS, RPG_GATHERING_LOOT } = require('./rpgCatalog');
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
    ]
};

const ENEMIES = [
    { id: 'goblin', name: 'Goblin saqueador', level: 1, hp: 260, attack: 24, reward: 180, xp: 35, drop: 'hierro' },
    { id: 'lobo', name: 'Lobo de sombra', level: 3, hp: 360, attack: 34, reward: 280, xp: 55, drop: 'piel' },
    { id: 'mago', name: 'Mago errante', level: 5, hp: 520, attack: 46, reward: 450, xp: 80, drop: 'runa' },
    { id: 'dragon', name: 'Dragón joven', level: 8, hp: 820, attack: 68, reward: 850, xp: 140, drop: 'escama' }
];

const RAID_BOSSES = {
    dragon_ancient: { id: 'dragon_ancient', name: '🐉 Dragón ancestral', hp: 5200, attack: 95, reward: 12000, xp: 650, drop: 'escama_ancestral', minLevel: 3 },
    titan: { id: 'titan', name: '🗿 Titán de obsidiana', hp: 7600, attack: 125, reward: 18000, xp: 900, drop: 'núcleo_obsidiana', minLevel: 5 },
    lich: { id: 'lich', name: '💀 Rey Liche', hp: 9800, attack: 150, reward: 25000, xp: 1200, drop: 'corona_liche', minLevel: 8 }
};

const RECIPES = {
    pocion: { name: 'Poción de vida', materials: { hierba: 1, agua: 1 }, coins: 80, gives: { potion: 1 } },
    espada_hierro: { name: 'Espada de hierro', materials: { hierro: 5, carbon: 2 }, coins: 250, gives: { sword_iron: 1 } },
    armadura: { name: 'Armadura reforzada', materials: { hierro: 8, piel: 3 }, coins: 500, gives: { armor_reinforced: 1 } },
    espada_abismal: { name: 'Espada abismal', materials: { hierro: 8, carbon: 4, runa: 2 }, coins: 2500, gives: { sword_abyss: 1 } },
    armadura_escamas: { name: 'Armadura de escamas', materials: { hierro: 5, piel: 6, escama: 4 }, coins: 3000, gives: { armor_dragon: 1 } },
    amuleto_lunar: { name: 'Amuleto lunar', materials: { runa: 3, hierba: 4, agua: 2 }, coins: 1800, gives: { amulet_lunar: 1 } }
};

function fmt(value) { return Number(value || 0).toLocaleString('es-ES'); }
function reply(sock, chatId, msg, text, extra = {}) { return sock.sendMessage(chatId, { text, ...extra }, { quoted: msg }); }
function imageReply(sock, chatId, msg, command, text, extra = {}) { return sendImageCaption(sock, chatId, msg, commandImagePath(command), text, extra); }
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
function classLabel(user) { return ({ guerrero: '⚔️ Guerrero', mago: '🔮 Mago', picaro: '🗡️ Pícaro', tirador: '🏹 Tirador' })[classKey(user)] || '🧭 Aventurero'; }
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
    return `🎒 *INVENTARIO*\n\n🧰 Objetos: ${inv}\n🧱 Materiales: ${mats}\n📦 Botín raro: ${loot}\n⚔️ Equipado: ${gear}\n\nGestiona tus armas y armaduras: *${prefix}inventario equipar <id>* / *${prefix}inventario quitar <id>*\nEquipo fabricable: ${gearIds}`;
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
        return reply(sock, chatId, msg, `✅ Guardaste *${item.name}* en tu inventario. Ya puedes subastarlo con *${prefix}subastar ${id} <precio>*.`);
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
    return reply(sock, chatId, msg, `✅ Equipaste *${item.name}*.\n⚔️ Poder: *${power(user)}* · 🛡️ Defensa: *${defense(user)}*${activeId ? `\n📦 ${RPG_ITEMS[activeId].name} volvió a tu bolsa.` : ''}`);
}

function raidForPlayer(botData, chatId, jid) {
    return Object.values(botData.rpgRaids || {}).find(raid => raid.chatId === chatId && raid.participants?.[jid] && ['lobby', 'active'].includes(raid.status));
}
function raidStatus(raid) {
    const members = Object.values(raid.participants || {});
    const damage = members.reduce((sum, member) => sum + Number(member.damage || 0), 0);
    return `👥 Participantes: *${members.length}/${raid.maxPlayers}*\n${members.map(member => `• ${member.name} · ${member.damage || 0} daño`).join('\n') || 'Nadie'}\n\n❤️ Jefe: *${raid.boss.currentHp}/${raid.boss.hp} HP*\n⚔️ Daño acumulado: *${damage}*`;
}
async function handleRaid({ sock, chatId, msg, args, user, jid, botData, save, prefix }) {
    if (!String(chatId).endsWith('@g.us')) return imageReply(sock, chatId, msg, 'raid', '❌ Las raids cooperativas solo pueden jugarse dentro de un grupo.');
    botData.rpgRaids ||= {};
    const action = String(args[0] || 'ayuda').toLowerCase();
    const current = raidForPlayer(botData, chatId, jid);
    if (['ayuda', 'help'].includes(action)) return imageReply(sock, chatId, msg, 'raid', `🐉 *RAIDS COOPERATIVAS*\n\n${prefix}raid crear dragon · Crear lobby\n${prefix}raid unirse <ID> · Unirse a una raid\n${prefix}raid iniciar [ID] · Comenzar con 2+ jugadores\n${prefix}raid atacar · Golpear al jefe\n${prefix}raid estado · Ver progreso\n${prefix}raid salir · Salir del lobby\n\nJefes: *dragon*, *titan*, *lich*`);
    if (action === 'lista') { const open = Object.values(botData.rpgRaids).filter(raid => raid.chatId === chatId && raid.status === 'lobby'); return imageReply(sock, chatId, msg, 'raid', open.length ? `📋 *RAIDS ABIERTAS*\n\n${open.map(raid => `• *${raid.id}* · ${raid.boss.name} · ${Object.keys(raid.participants).length}/${raid.maxPlayers}`).join('\n')}` : '📋 No hay raids abiertas. Crea una con *.raid crear dragon*.'); }
    if (action === 'crear') { if (current) return imageReply(sock, chatId, msg, 'raid', '❌ Ya estás en una raid activa o en un lobby.'); const key = String(args[1] || 'dragon').toLowerCase(); const boss = RAID_BOSSES[key === 'dragon' ? 'dragon_ancient' : key === 'reyliche' ? 'lich' : key]; if (!boss) return imageReply(sock, chatId, msg, 'raid', '❌ Jefe desconocido. Usa: *dragon*, *titan* o *lich*.'); if (Number(ensureRpg(user).level) < boss.minLevel) return imageReply(sock, chatId, msg, 'raid', `❌ Necesitas nivel *${boss.minLevel}* para retar a ${boss.name}.`); const id = `raid-${Date.now().toString(36).slice(-6)}`; botData.rpgRaids[id] = { id, chatId, creator: jid, status: 'lobby', maxPlayers: 8, boss: { ...boss, currentHp: boss.hp }, participants: { [jid]: { jid, name: msg?.pushName || jid.split('@')[0], damage: 0 } }, actions: {}, round: 1, createdAt: new Date().toISOString() }; save(); return imageReply(sock, chatId, msg, 'raid', `🐉 *RAID CREADA*\n\nJefe: *${boss.name}*\nID: *${id}*\n\nComparte el ID y usa *${prefix}raid unirse ${id}*. Cuando haya 2+ jugadores: *${prefix}raid iniciar ${id}*.`); }
    if (action === 'unirse') { const raid = botData.rpgRaids[String(args[1] || '')]; if (!raid || raid.chatId !== chatId || raid.status !== 'lobby') return imageReply(sock, chatId, msg, 'raid', '❌ No encontré un lobby abierto con ese ID.'); if (raid.participants[jid]) return imageReply(sock, chatId, msg, 'raid', '✅ Ya estás dentro de esta raid.'); if (Object.keys(raid.participants).length >= raid.maxPlayers) return imageReply(sock, chatId, msg, 'raid', '❌ La raid está llena.'); raid.participants[jid] = { jid, name: msg?.pushName || jid.split('@')[0], damage: 0 }; save(); return imageReply(sock, chatId, msg, 'raid', `✅ Te uniste a *${raid.boss.name}*.\n\n${raidStatus(raid)}\n\nEl creador puede iniciar con *${prefix}raid iniciar ${raid.id}*.`); }
    const raid = current || (args[1] && botData.rpgRaids[args[1]]);
    if (action === 'estado') return imageReply(sock, chatId, msg, 'raid', raid ? `🐉 *${raid.boss.name}* · ${raid.status.toUpperCase()}\n\n${raidStatus(raid)}` : 'ℹ️ No estás en una raid.');
    if (action === 'salir') { if (!raid) return imageReply(sock, chatId, msg, 'raid', 'ℹ️ No estás en una raid.'); if (raid.status !== 'lobby') return imageReply(sock, chatId, msg, 'raid', '❌ No puedes salir cuando la batalla ya comenzó.'); if (raid.creator === jid) { delete botData.rpgRaids[raid.id]; } else delete raid.participants[jid]; save(); return imageReply(sock, chatId, msg, 'raid', '↩️ Saliste del lobby de la raid.'); }
    if (action === 'iniciar') { const target = botData.rpgRaids[String(args[1] || '')] || raid; if (!target || target.chatId !== chatId) return imageReply(sock, chatId, msg, 'raid', '❌ No encontré esa raid.'); if (target.creator !== jid) return imageReply(sock, chatId, msg, 'raid', '❌ Solo quien creó la raid puede iniciarla.'); if (Object.keys(target.participants).length < 2) return imageReply(sock, chatId, msg, 'raid', '❌ Necesitan al menos 2 jugadores para comenzar.'); target.status = 'active'; target.startedAt = new Date().toISOString(); save(); return imageReply(sock, chatId, msg, 'raid', `🔥 *RAID INICIADA*\n\n${target.boss.name} despertó. Cada jugador puede atacar una vez por ronda.\n\n${raidStatus(target)}\n\nUsen *${prefix}raid atacar*.`); }
    if (action === 'atacar' || action === 'attack') { if (!raid || raid.status !== 'active') return imageReply(sock, chatId, msg, 'raid', '❌ No tienes una raid activa.'); if (raid.actions[jid] === raid.round) return imageReply(sock, chatId, msg, 'raid', '⏳ Ya atacaste en esta ronda. Espera a tus compañeros.'); const rpg = ensureRpg(user); const damage = Math.max(20, power(user) + Math.floor(Math.random() * 35)); raid.round ||= 1; raid.actions[jid] = raid.round; raid.participants[jid].damage += damage; raid.boss.currentHp = Math.max(0, raid.boss.currentHp - damage); if (raid.boss.currentHp <= 0) { const total = Object.values(raid.participants).reduce((sum, member) => sum + member.damage, 0); const rewards = []; for (const member of Object.values(raid.participants)) { const memberUser = Object.values(botData.economy?.[chatId]?.users || {}).find(candidate => candidate && candidate.rpg?.raidJid === member.jid) || botData.economy?.[chatId]?.users?.[member.jid]; if (!memberUser) continue; const share = Math.floor(raid.boss.reward / Object.keys(raid.participants).length + (raid.boss.reward * ((member.damage || 0) / Math.max(1, total)) * .35)); memberUser.coins = (Number(memberUser.coins) || 0) + share; const memberRpg = ensureRpg(memberUser); addXp(memberUser, raid.boss.xp); memberRpg.materials[raid.boss.drop] = (Number(memberRpg.materials[raid.boss.drop]) || 0) + 1; memberRpg.stats.raidsWon = (Number(memberRpg.stats.raidsWon) || 0) + 1; if (Number(memberRpg.stats.raidsWon) >= 3) grantTitle(memberUser, 'Cazador de jefes'); rewards.push(`${member.name}: +${fmt(share)} monedas`); } raid.status = 'victory'; raid.finishedAt = new Date().toISOString(); save(); return imageReply(sock, chatId, msg, 'raid', `🏆 *¡JEFE DERROTADO!*\n\n${raid.boss.name} cayó después de ${raid.round || 1} rondas.\n📦 Drop épico para todos: *${raid.boss.drop}*\n\n${rewards.join('\n')}`); } const targetJids = Object.keys(raid.participants); const target = targetJids[Math.floor(Math.random() * targetJids.length)]; const targetUser = botData.economy?.[chatId]?.users?.[target]; const taken = Math.max(8, Math.floor(raid.boss.attack * (.75 + Math.random() * .35))); if (targetUser) { const targetRpg = ensureRpg(targetUser); targetRpg.hp = Math.max(1, targetRpg.hp - taken); } const everyoneActed = targetJids.every(member => raid.actions[member] === raid.round); if (everyoneActed) { raid.round = (raid.round || 1) + 1; raid.actions = {}; } save(); return imageReply(sock, chatId, msg, 'raid', `⚔️ *${msg?.pushName || 'Jugador'}* causó *${damage} de daño* a ${raid.boss.name}.\n💥 El jefe golpeó a *${raid.participants[target].name}* por *${taken} de daño*.\n\n${raidStatus(raid)}\n\n${everyoneActed ? `➡️ Comienza la ronda ${raid.round}.` : 'Los demás jugadores pueden atacar.'}`); }
    return imageReply(sock, chatId, msg, 'raid', `ℹ️ Usa *${prefix}raid ayuda* para ver los comandos.`);
}

async function handleExpansion({ sock, chatId, msg, canonical, args, user, jid, botData, save, prefix = '.' }) {
    const command = String(canonical || '').toLowerCase();
    if (command === 'raid') return handleRaid({ sock, chatId, msg, args, user, jid, botData, save, prefix });
    if (!['combat', 'inventory', 'craft', 'quest', 'title', 'market', 'season', 'skills', 'potion', 'rpgstatus'].includes(command)) return false;
    const rpg = ensureRpg(user);
    updateTitles(user);
    if (command === 'inventory') { const gearResponse = handleGearAction(sock, chatId, msg, args, user, rpg, save, prefix); if (gearResponse) return gearResponse; return imageReply(sock, chatId, msg, 'inventory', itemText(user, prefix)); }
    if (command === 'rpgstatus') return reply(sock, chatId, msg, `📊 *ESTADO DEL AVENTURERO*\n\n${classLabel(user)} · Nivel ${rpg.level}\n❤️ Vida: *${rpg.hp}/${rpg.maxHp}*\n⚡ Energía: *${rpg.energy}/${rpg.maxEnergy}*\n⚔️ Poder: *${power(user)}*\n🏆 Títulos: *${rpg.titles.length ? rpg.titles.join(', ') : 'Ninguno'}*\n🏅 PvP: *${rpg.pvp.wins}V-${rpg.pvp.losses}D* · ELO *${rpg.pvp.elo}*`);
    if (command === 'skills') { const skills = CLASS_SKILLS[classKey(user)] || []; return reply(sock, chatId, msg, `✨ *HABILIDADES DE ${classLabel(user).toUpperCase()}*\n\n${skills.map(skill => `• *${prefix}combate habilidad ${skill.id}* — ${skill.name} (${skill.cost}⚡)\n  ${skill.description}`).join('\n')}`); }
    if (command === 'potion') { const amount = Number(rpg.inventory.potion || 0); if (amount < 1) return reply(sock, chatId, msg, `❌ No tienes pociones. Fabrica una con *${prefix}fabricar pocion*.`); rpg.inventory.potion = amount - 1; const healed = Math.min(45, rpg.maxHp - rpg.hp); rpg.hp += healed; save(); return reply(sock, chatId, msg, `🧪 Usaste una poción y recuperaste *${healed} HP*. ❤️ ${rpg.hp}/${rpg.maxHp}`); }
    if (command === 'combat') {
        botData.rpgBattles ||= {}; botData.rpgBattles[chatId] ||= {};
        let battle = battleFor(botData, chatId, jid); const action = String(args[0] || 'estado').toLowerCase();
        if (['iniciar', 'start', 'buscar'].includes(action)) { if (battle) return reply(sock, chatId, msg, `⚔️ Ya estás luchando contra *${battle.enemy.name}*. Usa *${prefix}combate atacar*.`); const enemy = enemyFor(user); battle = { enemy: { ...enemy, currentHp: enemy.hp }, turn: 1, guard: false, startedAt: Date.now() }; botData.rpgBattles[chatId][jid] = battle; save(); return reply(sock, chatId, msg, `⚔️ *COMBATE INICIADO*\n\n👾 Enemigo: *${enemy.name}* · Nivel ${enemy.level}\n❤️ Vida: *${enemy.hp}/${enemy.hp}*\n\nUsa *${prefix}combate atacar*, *${prefix}combate habilidad <id>*, *${prefix}combate defender* o *${prefix}combate huir*.`); }
        if (!battle) return reply(sock, chatId, msg, `ℹ️ No tienes combate activo. Inicia uno con *${prefix}combate iniciar*.`);
        if (['huir', 'flee'].includes(action)) { delete botData.rpgBattles[chatId][jid]; save(); return reply(sock, chatId, msg, '🏃 Escapaste del combate.'); }
        if (action === 'estado') return reply(sock, chatId, msg, `⚔️ *COMBATE CONTRA ${battle.enemy.name.toUpperCase()}*\n\n❤️ Tú: ${rpg.hp}/${rpg.maxHp}\n👾 Enemigo: ${battle.enemy.currentHp}/${battle.enemy.hp}\n⚡ Energía: ${rpg.energy}/${rpg.maxEnergy}`);
        let damage = Math.max(8, power(user) + Math.floor(Math.random() * 16) - 8), message = '';
        if (action !== 'defender') {
            const energy = consumeEnergy(user, action === 'habilidad' || action === 'skill' ? 10 : 3);
            if (!energy.ok) return reply(sock, chatId, msg, `⚡ No tienes suficiente energía. Necesitas *${action === 'habilidad' || action === 'skill' ? 10 : 3}* y tienes *${energy.energy}/${energy.maxEnergy}*.`);
        }
        if (action === 'defender') { rpg.energy = Math.min(rpg.maxEnergy, rpg.energy + 6); battle.guard = true; message = '🛡️ Adoptaste una postura defensiva.'; }
        else if (action === 'habilidad' || action === 'skill') { const skill = (CLASS_SKILLS[classKey(user)] || []).find(item => item.id === String(args[1] || '').toLowerCase()); if (!skill) return reply(sock, chatId, msg, `ℹ️ Usa *${prefix}habilidades* para ver tus habilidades.`); if (rpg.energy < skill.cost) return reply(sock, chatId, msg, '❌ No tienes suficiente energía.'); rpg.energy -= skill.cost; damage = Math.floor(damage * (skill.power || 1)); if (skill.heal) rpg.hp = Math.min(rpg.maxHp, rpg.hp + skill.heal); message = `✨ Usaste *${skill.name}* y causaste *${damage} de daño*.`; }
        else { const critical = Math.random() < 0.12; if (critical) damage = Math.floor(damage * 1.7); message = `${critical ? '💥 ¡Golpe crítico!' : '⚔️ Atacaste'} Causaste *${damage} de daño*.`; }
        if (action !== 'defender') battle.enemy.currentHp = Math.max(0, battle.enemy.currentHp - damage);
        if (battle.enemy.currentHp <= 0) { user.coins += battle.enemy.reward; const xp = addXp(user, battle.enemy.xp); recordMissionEvent(user, 'combat', 1); rpg.materials[battle.enemy.drop] = (Number(rpg.materials[battle.enemy.drop]) || 0) + 1; rpg.materials.hierba = (Number(rpg.materials.hierba) || 0) + 1; rpg.materials.agua = (Number(rpg.materials.agua) || 0) + 1; rpg.materials.carbon = (Number(rpg.materials.carbon) || 0) + (Math.random() < .5 ? 1 : 0); if (rpg.quest && !rpg.quest.claimed) rpg.quest.progress = Math.min(rpg.quest.target, Number(rpg.quest.progress || 0) + 1); const welcomeText = completeWelcomeMission(user); delete botData.rpgBattles[chatId][jid]; save(); return reply(sock, chatId, msg, `${message}\n\n🏆 *VICTORIA* contra ${battle.enemy.name}\n🪙 +${fmt(battle.enemy.reward)} monedas · ✨ +${battle.enemy.xp} XP${levelUpText(xp)}\n📦 Drop: *${battle.enemy.drop}*${welcomeText ? `\n\n${welcomeText}` : ''}`); }
        const incoming = Math.max(1, battle.enemy.attack + Math.floor(Math.random() * 12) - 6 - defense(user)); const taken = battle.guard ? Math.floor(incoming * .45) : incoming; rpg.hp = Math.max(0, rpg.hp - taken); battle.guard = false; battle.turn += 1; if (rpg.hp <= 0) { rpg.hp = Math.ceil(rpg.maxHp * .35); delete botData.rpgBattles[chatId][jid]; save(); return reply(sock, chatId, msg, `${message}\n💥 ${battle.enemy.name} te derrotó. Recuperaste ${rpg.hp} HP, pero no obtuviste recompensa.`); } save(); return reply(sock, chatId, msg, `${message}\n👾 Contraataque: recibiste *${taken} de daño*.\n❤️ Tu vida: *${rpg.hp}/${rpg.maxHp}*\n👾 Enemigo: *${battle.enemy.currentHp}/${battle.enemy.hp}*`);
    }
    if (command === 'craft') {
        const recipe = RECIPES[String(args[0] || '').toLowerCase()];
        if (!recipe) return reply(sock, chatId, msg, `🔨 *RECETAS*\n${Object.entries(RECIPES).map(([id, item]) => `• *${prefix}fabricar ${id}* — ${item.name}: ${Object.entries(item.materials).map(([m, n]) => `${m} x${n}`).join(', ')} + ${fmt(item.coins)} monedas`).join('\n')}`);
        if (user.coins < recipe.coins) return reply(sock, chatId, msg, `❌ Necesitas ${fmt(recipe.coins)} monedas.`);
        if (Object.entries(recipe.materials).some(([material, needed]) => Number(rpg.materials[material] || 0) < needed)) return reply(sock, chatId, msg, '❌ Te faltan materiales. Consíguelos combatiendo y explorando.');
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
        return reply(sock, chatId, msg, `🔨 Fabricaste *${recipe.name}* correctamente.\n\n${itemText(user, prefix)}`);
    }
    if (command === 'quest') { rpg.quest ||= { id: 'la_amenaza', title: 'La amenaza del bosque', objective: 'Derrota 3 enemigos', progress: 0, target: 3, reward: 900, claimed: false }; if (actionIs(args, ['nueva', 'new'])) { rpg.quest = { id: `quest-${Date.now()}`, title: 'La amenaza del bosque', objective: 'Derrota 3 enemigos', progress: 0, target: 3, reward: 900, claimed: false }; save(); } if (args[0] === 'reclamar' && rpg.quest.progress >= rpg.quest.target && !rpg.quest.claimed) { rpg.quest.claimed = true; user.coins += rpg.quest.reward; save(); return reply(sock, chatId, msg, `🎉 Misión completada. Recompensa: *${fmt(rpg.quest.reward)} monedas*`); } return reply(sock, chatId, msg, `📜 *${rpg.quest.title}*\n${rpg.quest.objective}\nProgreso: *${rpg.quest.progress}/${rpg.quest.target}*\nRecompensa: *${fmt(rpg.quest.reward)} monedas*\n${rpg.quest.progress >= rpg.quest.target ? `Reclama con *${prefix}campaña reclamar*` : 'Explora y combate para avanzar.'}`); }
    if (command === 'title') { const action = String(args[0] || '').toLowerCase(); updateTitles(user); if (action === 'usar' && args[1] && rpg.titles.includes(args.slice(1).join(' '))) rpg.activeTitle = args.slice(1).join(' '); save(); return reply(sock, chatId, msg, `🏷️ *TÍTULOS DEL AVENTURERO*\n\n${rpg.titles.length ? rpg.titles.map(title => `${rpg.activeTitle === title ? '✅' : '▫️'} ${title}`).join('\n') : 'Aún no tienes títulos.'}`); }
    if (command === 'market') { botData.rpgMarket ||= {}; const action = String(args[0] || 'ver').toLowerCase(); if (action === 'ver' || action === 'listado') { const listings = Object.values(botData.rpgMarket).filter(item => item.status === 'open').slice(0, 20); return imageReply(sock, chatId, msg, 'market', listings.length ? `🛒 *MERCADO DEL REINO*\n\n${listings.map(item => `#${item.id} · ${item.sellerName} vende *${item.item}* por *${fmt(item.price)}*`).join('\n')}` : '🛒 El mercado está vacío.'); } if (action === 'publicar') { const item = String(args[1] || '').toLowerCase(), price = Number(args[2]); if (!item || !Number.isSafeInteger(price) || price < 100) return imageReply(sock, chatId, msg, 'market', `ℹ️ Uso: *${prefix}mercado publicar <objeto> <precio>*`); if (!rpg.inventory[item]) return imageReply(sock, chatId, msg, 'market', '❌ No tienes ese objeto.'); const id = `m-${Date.now().toString(36)}`; rpg.inventory[item] -= 1; botData.rpgMarket[id] = { id, item, price, seller: jid, sellerName: msg?.pushName || jid.split('@')[0], status: 'open', createdAt: new Date().toISOString() }; save(); return imageReply(sock, chatId, msg, 'market', `✅ Publicaste *${item}* por *${fmt(price)} monedas*. ID: *${id}*`); } if (action === 'comprar') { const id = args[1], listing = botData.rpgMarket[id]; if (!listing || listing.status !== 'open') return imageReply(sock, chatId, msg, 'market', '❌ Publicación no disponible.'); if (listing.seller === jid) return imageReply(sock, chatId, msg, 'market', '❌ No puedes comprarte a ti mismo.'); if (user.coins < listing.price) return imageReply(sock, chatId, msg, 'market', '❌ No tienes suficientes monedas.'); const tax = Math.max(25, Math.ceil(listing.price * .05)); user.coins -= listing.price; const seller = Object.values(botData.economy?.[chatId]?.users || {}).find(item => item && item.rpg?.marketOwner === listing.seller) || null; const sellerUser = botData.economy?.[chatId]?.users?.[listing.seller]; if (sellerUser) sellerUser.coins = (Number(sellerUser.coins) || 0) + listing.price - tax; rpg.inventory[listing.item] = (Number(rpg.inventory[listing.item]) || 0) + 1; listing.status = 'sold'; listing.buyer = jid; listing.tax = tax; save(); return imageReply(sock, chatId, msg, 'market', `✅ Compraste *${listing.item}* por *${fmt(listing.price)}*. Tasa: *${fmt(tax)}*`); } return imageReply(sock, chatId, msg, 'market', `ℹ️ Usa *${prefix}mercado ver*, *publicar* o *comprar*.`); }
    if (command === 'season') { const users = Object.values(botData.economy?.[chatId]?.users || {}).map(item => ({ user: item, rpg: ensureRpg(item) })).sort((a,b) => (b.rpg.pvp.elo||0) - (a.rpg.pvp.elo||0)).slice(0,10); return reply(sock, chatId, msg, `🏆 *TEMPORADA DEL REINO*\n\n${users.length ? users.map((item,i) => `${i+1}. ${classLabel(item.user)} · ELO ${item.rpg.pvp.elo} · ${item.rpg.pvp.wins}V-${item.rpg.pvp.losses}D`).join('\n') : 'Aún no hay competidores.'}\n\nLa temporada se renueva mensualmente.`); }
    return false;
}
function actionIs(args, values) { return values.includes(String(args[0] || '').toLowerCase()); }
module.exports = { handleExpansion, ensureRpg, addXp, updateTitles, activateWelcomeMission, completeWelcomeMission, CLASS_SKILLS };
