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

const RECIPES = {
    pocion: { name: 'Poción de vida', materials: { hierba: 1, agua: 1 }, coins: 80, gives: { potion: 1 } },
    espada_hierro: { name: 'Espada de hierro', materials: { hierro: 5, carbon: 2 }, coins: 250, gives: { sword_iron: 1 } },
    armadura: { name: 'Armadura reforzada', materials: { hierro: 8, piel: 3 }, coins: 500, gives: { armor_reinforced: 1 } }
};

function fmt(value) { return Number(value || 0).toLocaleString('es-ES'); }
function reply(sock, chatId, msg, text, extra = {}) { return sock.sendMessage(chatId, { text, ...extra }, { quoted: msg }); }
function ensureRpg(user) {
    user.rpg ||= { xp: 0, level: 1, lastXp: 0 };
    user.rpg.stats ||= {};
    user.rpg.inventory ||= { potion: 2 };
    user.rpg.materials ||= {};
    user.rpg.equipment ||= {};
    user.rpg.skills ||= {};
    user.rpg.titles ||= [];
    user.rpg.pvp ||= { wins: 0, losses: 0, elo: 1000, streak: 0 };
    user.rpg.hp = Math.max(0, Math.min(Number(user.rpg.hp ?? 100), Number(user.rpg.maxHp || 100)));
    user.rpg.maxHp = Math.max(100, Number(user.rpg.maxHp) || 100);
    user.rpg.energy = Math.max(0, Math.min(Number(user.rpg.energy ?? 50), Number(user.rpg.maxEnergy || 50)));
    user.rpg.maxEnergy = Math.max(50, Number(user.rpg.maxEnergy) || 50);
    if (!user.rpg.hp) user.rpg.hp = user.rpg.maxHp;
    return user.rpg;
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
    rpg.xp = Math.max(0, Number(rpg.xp) || 0) + Math.max(1, Math.floor(amount));
    rpg.level = Math.max(1, Math.floor(Math.sqrt(rpg.xp / 100)) + 1);
    rpg.hp = rpg.maxHp = 100 + (rpg.level - 1) * 12;
    rpg.energy = rpg.maxEnergy = 50 + (rpg.level - 1) * 4;
    updateTitles(user);
}
function classLabel(user) { return ({ guerrero: '⚔️ Guerrero', mago: '🔮 Mago', picaro: '🗡️ Pícaro', tirador: '🏹 Tirador' })[classKey(user)] || '🧭 Aventurero'; }
function enemyFor(user) { const level = Number(ensureRpg(user).level) || 1; const pool = ENEMIES.filter(enemy => enemy.level <= level + 2); return pool[Math.floor(Math.random() * pool.length)] || ENEMIES[0]; }
function battleFor(botData, chatId, jid) { botData.rpgBattles ||= {}; botData.rpgBattles[chatId] ||= {}; return botData.rpgBattles[chatId][jid]; }
function power(user) { const rpg = ensureRpg(user); return 32 + (Number(rpg.level) || 1) * 7 + (rpg.equipment.sword_iron ? 18 : 0) + (rpg.equipment.armor_reinforced ? 12 : 0); }
function itemText(user) { const rpg = ensureRpg(user); const inv = Object.entries(rpg.inventory).filter(([, count]) => Number(count) > 0).map(([id, count]) => `${id}: ${count}`).join(' · ') || 'Vacío'; const mats = Object.entries(rpg.materials).filter(([, count]) => Number(count) > 0).map(([id, count]) => `${id}: ${count}`).join(' · ') || 'Ninguno'; const gear = Object.keys(rpg.equipment).filter(id => rpg.equipment[id]).join(' · ') || 'Sin equipo'; return `🎒 *INVENTARIO*\n\n🧪 Consumibles: ${inv}\n🧱 Materiales: ${mats}\n⚔️ Equipado: ${gear}`; }

async function handleExpansion({ sock, chatId, msg, canonical, args, user, jid, botData, save, prefix = '.' }) {
    const command = String(canonical || '').toLowerCase();
    if (!['combat', 'inventory', 'craft', 'quest', 'title', 'market', 'season', 'skills', 'potion', 'rpgstatus'].includes(command)) return false;
    const rpg = ensureRpg(user);
    updateTitles(user);
    if (command === 'inventory') return reply(sock, chatId, msg, itemText(user));
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
        if (action === 'defender') { rpg.energy = Math.min(rpg.maxEnergy, rpg.energy + 6); battle.guard = true; message = '🛡️ Adoptaste una postura defensiva.'; }
        else if (action === 'habilidad' || action === 'skill') { const skill = (CLASS_SKILLS[classKey(user)] || []).find(item => item.id === String(args[1] || '').toLowerCase()); if (!skill) return reply(sock, chatId, msg, `ℹ️ Usa *${prefix}habilidades* para ver tus habilidades.`); if (rpg.energy < skill.cost) return reply(sock, chatId, msg, '❌ No tienes suficiente energía.'); rpg.energy -= skill.cost; damage = Math.floor(damage * (skill.power || 1)); if (skill.heal) rpg.hp = Math.min(rpg.maxHp, rpg.hp + skill.heal); message = `✨ Usaste *${skill.name}* y causaste *${damage} de daño*.`; }
        else { const critical = Math.random() < 0.12; if (critical) damage = Math.floor(damage * 1.7); message = `${critical ? '💥 ¡Golpe crítico!' : '⚔️ Atacaste'} Causaste *${damage} de daño*.`; }
        if (action !== 'defender') battle.enemy.currentHp = Math.max(0, battle.enemy.currentHp - damage);
        if (battle.enemy.currentHp <= 0) { user.coins += battle.enemy.reward; addXp(user, battle.enemy.xp); rpg.materials[battle.enemy.drop] = (Number(rpg.materials[battle.enemy.drop]) || 0) + 1; rpg.materials.hierba = (Number(rpg.materials.hierba) || 0) + 1; rpg.materials.agua = (Number(rpg.materials.agua) || 0) + 1; rpg.materials.carbon = (Number(rpg.materials.carbon) || 0) + (Math.random() < .5 ? 1 : 0); if (rpg.quest && !rpg.quest.claimed) rpg.quest.progress = Math.min(rpg.quest.target, Number(rpg.quest.progress || 0) + 1); delete botData.rpgBattles[chatId][jid]; save(); return reply(sock, chatId, msg, `${message}\n\n🏆 *VICTORIA* contra ${battle.enemy.name}\n🪙 +${fmt(battle.enemy.reward)} monedas · ✨ +${battle.enemy.xp} XP\n📦 Drop: *${battle.enemy.drop}*`); }
        const incoming = Math.max(1, battle.enemy.attack + Math.floor(Math.random() * 12) - 6); const taken = battle.guard ? Math.floor(incoming * .45) : incoming; rpg.hp = Math.max(0, rpg.hp - taken); battle.guard = false; battle.turn += 1; if (rpg.hp <= 0) { rpg.hp = Math.ceil(rpg.maxHp * .35); delete botData.rpgBattles[chatId][jid]; save(); return reply(sock, chatId, msg, `${message}\n💥 ${battle.enemy.name} te derrotó. Recuperaste ${rpg.hp} HP, pero no obtuviste recompensa.`); } save(); return reply(sock, chatId, msg, `${message}\n👾 Contraataque: recibiste *${taken} de daño*.\n❤️ Tu vida: *${rpg.hp}/${rpg.maxHp}*\n👾 Enemigo: *${battle.enemy.currentHp}/${battle.enemy.hp}*`);
    }
    if (command === 'craft') { const recipe = RECIPES[String(args[0] || '').toLowerCase()]; if (!recipe) return reply(sock, chatId, msg, `🔨 *RECETAS*\n${Object.entries(RECIPES).map(([id, item]) => `• *${prefix}fabricar ${id}* — ${item.name}: ${Object.entries(item.materials).map(([m,n]) => `${m} x${n}`).join(', ')} + ${fmt(item.coins)} monedas`).join('\n')}`); if (user.coins < recipe.coins) return reply(sock, chatId, msg, `❌ Necesitas ${fmt(recipe.coins)} monedas.`); if (Object.entries(recipe.materials).some(([material, needed]) => Number(rpg.materials[material] || 0) < needed)) return reply(sock, chatId, msg, '❌ Te faltan materiales. Consíguelos combatiendo y explorando.'); for (const [material, needed] of Object.entries(recipe.materials)) rpg.materials[material] -= needed; user.coins -= recipe.coins; for (const [id, amount] of Object.entries(recipe.gives)) rpg.inventory[id] = (Number(rpg.inventory[id]) || 0) + amount; if (recipe.gives.sword_iron) rpg.equipment.sword_iron = true; if (recipe.gives.armor_reinforced) rpg.equipment.armor_reinforced = true; save(); return reply(sock, chatId, msg, `🔨 Fabricaste *${recipe.name}* correctamente.\n\n${itemText(user)}`); }
    if (command === 'quest') { rpg.quest ||= { id: 'la_amenaza', title: 'La amenaza del bosque', objective: 'Derrota 3 enemigos', progress: 0, target: 3, reward: 900, claimed: false }; if (actionIs(args, ['nueva', 'new'])) { rpg.quest = { id: `quest-${Date.now()}`, title: 'La amenaza del bosque', objective: 'Derrota 3 enemigos', progress: 0, target: 3, reward: 900, claimed: false }; save(); } if (args[0] === 'reclamar' && rpg.quest.progress >= rpg.quest.target && !rpg.quest.claimed) { rpg.quest.claimed = true; user.coins += rpg.quest.reward; save(); return reply(sock, chatId, msg, `🎉 Misión completada. Recompensa: *${fmt(rpg.quest.reward)} monedas*`); } return reply(sock, chatId, msg, `📜 *${rpg.quest.title}*\n${rpg.quest.objective}\nProgreso: *${rpg.quest.progress}/${rpg.quest.target}*\nRecompensa: *${fmt(rpg.quest.reward)} monedas*\n${rpg.quest.progress >= rpg.quest.target ? `Reclama con *${prefix}campaña reclamar*` : 'Explora y combate para avanzar.'}`); }
    if (command === 'title') { const action = String(args[0] || '').toLowerCase(); updateTitles(user); if (action === 'usar' && args[1] && rpg.titles.includes(args.slice(1).join(' '))) rpg.activeTitle = args.slice(1).join(' '); save(); return reply(sock, chatId, msg, `🏷️ *TÍTULOS DEL AVENTURERO*\n\n${rpg.titles.length ? rpg.titles.map(title => `${rpg.activeTitle === title ? '✅' : '▫️'} ${title}`).join('\n') : 'Aún no tienes títulos.'}`); }
    if (command === 'market') { botData.rpgMarket ||= {}; const action = String(args[0] || 'ver').toLowerCase(); if (action === 'ver' || action === 'listado') { const listings = Object.values(botData.rpgMarket).filter(item => item.status === 'open').slice(0, 20); return reply(sock, chatId, msg, listings.length ? `🛒 *MERCADO DEL REINO*\n\n${listings.map(item => `#${item.id} · ${item.sellerName} vende *${item.item}* por *${fmt(item.price)}*`).join('\n')}` : '🛒 El mercado está vacío.'); } if (action === 'publicar') { const item = String(args[1] || '').toLowerCase(), price = Number(args[2]); if (!item || !Number.isSafeInteger(price) || price < 100) return reply(sock, chatId, msg, `ℹ️ Uso: *${prefix}mercado publicar <objeto> <precio>*`); if (!rpg.inventory[item]) return reply(sock, chatId, msg, '❌ No tienes ese objeto.'); const id = `m-${Date.now().toString(36)}`; rpg.inventory[item] -= 1; botData.rpgMarket[id] = { id, item, price, seller: jid, sellerName: msg?.pushName || jid.split('@')[0], status: 'open', createdAt: new Date().toISOString() }; save(); return reply(sock, chatId, msg, `✅ Publicaste *${item}* por *${fmt(price)} monedas*. ID: *${id}*`); } if (action === 'comprar') { const id = args[1], listing = botData.rpgMarket[id]; if (!listing || listing.status !== 'open') return reply(sock, chatId, msg, '❌ Publicación no disponible.'); if (listing.seller === jid) return reply(sock, chatId, msg, '❌ No puedes comprarte a ti mismo.'); if (user.coins < listing.price) return reply(sock, chatId, msg, '❌ No tienes suficientes monedas.'); const tax = Math.max(25, Math.ceil(listing.price * .05)); user.coins -= listing.price; const seller = Object.values(botData.economy?.[chatId]?.users || {}).find(item => item && item.rpg?.marketOwner === listing.seller) || null; const sellerUser = botData.economy?.[chatId]?.users?.[listing.seller]; if (sellerUser) sellerUser.coins = (Number(sellerUser.coins) || 0) + listing.price - tax; rpg.inventory[listing.item] = (Number(rpg.inventory[listing.item]) || 0) + 1; listing.status = 'sold'; listing.buyer = jid; listing.tax = tax; save(); return reply(sock, chatId, msg, `✅ Compraste *${listing.item}* por *${fmt(listing.price)}*. Tasa: *${fmt(tax)}*`); } return reply(sock, chatId, msg, `ℹ️ Usa *${prefix}mercado ver*, *publicar* o *comprar*.`); }
    if (command === 'season') { const users = Object.values(botData.economy?.[chatId]?.users || {}).map(item => ({ user: item, rpg: ensureRpg(item) })).sort((a,b) => (b.rpg.pvp.elo||0) - (a.rpg.pvp.elo||0)).slice(0,10); return reply(sock, chatId, msg, `🏆 *TEMPORADA DEL REINO*\n\n${users.length ? users.map((item,i) => `${i+1}. ${classLabel(item.user)} · ELO ${item.rpg.pvp.elo} · ${item.rpg.pvp.wins}V-${item.rpg.pvp.losses}D`).join('\n') : 'Aún no hay competidores.'}\n\nLa temporada se renueva mensualmente.`); }
    return false;
}
function actionIs(args, values) { return values.includes(String(args[0] || '').toLowerCase()); }
module.exports = { handleExpansion, ensureRpg, addXp, updateTitles, CLASS_SKILLS };
