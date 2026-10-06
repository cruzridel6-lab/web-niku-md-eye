const DAY = 86400000;

const RARITIES = {
    comun: { label: 'Común', icon: '⚪', multiplier: 1 },
    poco_comun: { label: 'Poco común', icon: '🟢', multiplier: 1.15 },
    raro: { label: 'Raro', icon: '🔵', multiplier: 1.4 },
    epico: { label: 'Épico', icon: '🟣', multiplier: 1.85 },
    legendario: { label: 'Legendario', icon: '🟠', multiplier: 2.6 }
};

const DAILY_MISSIONS = [
    { id: 'daily-work', title: '💼 Jornada del gremio', event: 'work', target: 3, reward: 900, xp: 35 },
    { id: 'daily-gather', title: '🌿 Recolector incansable', event: 'gather', target: 3, reward: 800, xp: 30 },
    { id: 'daily-combat', title: '⚔️ Entrenamiento', event: 'combat', target: 2, reward: 1000, xp: 45 },
    { id: 'daily-explore', title: '🧭 Explorador del día', event: 'explore', target: 2, reward: 850, xp: 35 }
];
const WEEKLY_MISSIONS = [
    { id: 'weekly-dungeon', title: '🏰 Conquistador de mazmorras', event: 'dungeon', target: 5, reward: 6500, xp: 180 },
    { id: 'weekly-hunt', title: '🏹 Gran cazador', event: 'hunt', target: 12, reward: 5000, xp: 150 },
    { id: 'weekly-mine', title: '⛏️ Vena de riquezas', event: 'mine', target: 12, reward: 5000, xp: 150 }
];

function dateKey(now = Date.now()) { return new Date(now).toISOString().slice(0, 10); }
function weekKey(now = Date.now()) {
    const date = new Date(now);
    const first = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return `${date.getUTCFullYear()}-W${String(Math.ceil((((date - first) / DAY) + first.getUTCDay() + 1) / 7)).padStart(2, '0')}`;
}
function ensureFeatureState(user) {
    user.rpg ||= { xp: 0, level: 1 };
    user.rpg.featureState ||= { day: dateKey(), week: weekKey(), actions: {}, eventAt: 0 };
    const state = user.rpg.featureState;
    if (state.day !== dateKey()) { state.day = dateKey(); state.actions = {}; state.eventAt = 0; }
    if (state.week !== weekKey()) state.week = weekKey();
    user.rpg.energy = Math.max(0, Math.min(Number(user.rpg.energy ?? 50), Number(user.rpg.maxEnergy || 50)));
    user.rpg.maxEnergy = Math.max(50, Number(user.rpg.maxEnergy) || 50);
    const elapsed = Math.max(0, Date.now() - Number(state.energyAt || Date.now()));
    if (elapsed >= 60000) {
        user.rpg.energy = Math.min(user.rpg.maxEnergy, user.rpg.energy + Math.floor(elapsed / 60000) * 2);
        state.energyAt = Date.now();
    }
    return state;
}
function consumeEnergy(user, amount = 1) {
    const state = ensureFeatureState(user);
    const cost = Math.max(0, Math.floor(amount));
    if (user.rpg.energy < cost) return { ok: false, energy: user.rpg.energy, maxEnergy: user.rpg.maxEnergy };
    user.rpg.energy -= cost;
    state.energyAt = Date.now();
    return { ok: true, energy: user.rpg.energy, maxEnergy: user.rpg.maxEnergy };
}
function consumeAction(user, action, limit) {
    const state = ensureFeatureState(user);
    const used = Number(state.actions[action] || 0);
    if (used >= limit) return { ok: false, used, limit };
    state.actions[action] = used + 1;
    return { ok: true, used: used + 1, limit };
}
function rollRarity() {
    const roll = Math.random();
    if (roll < 0.01) return 'legendario';
    if (roll < 0.05) return 'epico';
    if (roll < 0.16) return 'raro';
    if (roll < 0.36) return 'poco_comun';
    return 'comun';
}
function rarityInfo(key) { return RARITIES[key] || RARITIES.comun; }
function rareDrop(user, baseId, baseName, value = 0) {
    const rarity = rollRarity();
    const info = rarityInfo(rarity);
    user.rpg.loot ||= {};
    const id = `${baseId}:${rarity}`;
    user.rpg.loot[id] = (Number(user.rpg.loot[id]) || 0) + 1;
    return { id, rarity, label: `${info.icon} ${info.label} ${baseName}`, value: Math.floor(value * info.multiplier) };
}
function ensureMissions(user) {
    const state = ensureFeatureState(user);
    user.rpg.missions ||= {};
    const create = (type, key, catalog) => {
        if (!user.rpg.missions[type] || user.rpg.missions[type].period !== key) {
            const chosen = catalog[Math.floor(Math.random() * catalog.length)];
            user.rpg.missions[type] = { ...chosen, period: key, progress: 0, claimed: false };
        }
        return user.rpg.missions[type];
    };
    return { daily: create('daily', state.day, DAILY_MISSIONS), weekly: create('weekly', state.week, WEEKLY_MISSIONS) };
}
function recordMissionEvent(user, event, amount = 1) {
    const missions = ensureMissions(user);
    const completed = [];
    for (const mission of Object.values(missions)) {
        if (mission.event !== event || mission.claimed) continue;
        mission.progress = Math.min(mission.target, Number(mission.progress || 0) + amount);
        if (mission.progress >= mission.target) {
            mission.claimed = true;
            user.coins = (Number(user.coins) || 0) + Number(mission.reward || 0);
            completed.push(mission);
        }
    }
    return completed;
}
function missionText(user, prefix = '.') {
    const missions = ensureMissions(user);
    return Object.values(missions).map(m => `${m.claimed ? '✅' : '📍'} *${m.title}*\n${m.progress}/${m.target} · +${Number(m.reward).toLocaleString('es-ES')} monedas · +${m.xp} XP${m.claimed ? ' · Reclamada' : ''}`).join('\n\n') + `\n\nUsa *${prefix}misiones* después de cada actividad.\n👉 Siguiente paso: *${prefix}work* para avanzar en tu misión diaria.`;
}
function recommendedNextStep(user, prefix = '.') {
    const rpg = user?.rpg || {};
    if (!rpg.class) return `🧭 Siguiente paso: elige tu clase con *${prefix}clase guerrero*.`;
    if (!user?.tools?.pico && !user?.tools?.espada && !user?.tools?.cana) return `🧭 Siguiente paso: visita *${prefix}mercader* para comprar tu primera herramienta.`;
    const missions = ensureMissions(user);
    const pending = Object.values(missions).find(m => !m.claimed);
    if (pending) return `🧭 Siguiente paso: *${prefix}${pending.event === 'work' ? 'work' : pending.event === 'gather' ? 'recolectar' : pending.event === 'combat' ? 'combate iniciar' : 'explorar'}* (${pending.progress}/${pending.target}).`;
    return `🧭 Siguiente paso: revisa tu progreso con *${prefix}misiones* o *${prefix}inventario*.`;
}
function maybeRandomEvent(user) {
    const state = ensureFeatureState(user);
    if (Date.now() - Number(state.eventAt || 0) < 10 * 60 * 1000 || Math.random() > 0.035) return null;
    state.eventAt = Date.now();
    const events = [
        ['🌠 *EVENTO: LLUVIA DE ESTRELLAS*', 500, 15],
        ['🧚 *EVENTO: HADA DEL BOSQUE*', 750, 20],
        ['💎 *EVENTO: COFRE MISTERIOSO*', 1200, 30]
    ];
    const [title, coins, xp] = events[Math.floor(Math.random() * events.length)];
    user.coins = (Number(user.coins) || 0) + coins;
    return { title, coins, xp };
}
function levelUpText(xpEvent) {
    return xpEvent?.levelUp ? `\n🎉 *¡SUBISTE AL NIVEL ${xpEvent.level}!*` : '';
}

module.exports = { ensureFeatureState, consumeEnergy, consumeAction, rareDrop, rarityInfo, ensureMissions, recordMissionEvent, missionText, recommendedNextStep, maybeRandomEvent, levelUpText };
