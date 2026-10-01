const COIN = '🪙 Niku Coin';
const MIN_BET = 200;
const PREMIUM_SHOP = {
    1: { price: 10000, label: '1 día Premium' },
    2: { price: 18000, label: '2 días Premium' },
    3: { price: 25000, label: '3 días Premium' },
    4: { price: 32000, label: '4 días Premium' },
    5: { price: 38000, label: '5 días Premium' }
};
const RPG_LEVEL_XP = level => Math.max(0, (level - 1) * (level - 1) * 100);
const MINING_REWARDS = [120, 180, 250, 400, 650, 900, 1400];
const FISHING_REWARDS = [100, 160, 240, 350, 500, 800, 1200];
const HUNTING_REWARDS = [180, 260, 380, 550, 800, 1100, 1600];
const DUNGEON_REWARDS = [700, 900, 1200, 1600, 2200];
const MERCHANT_ITEMS = {
    pico: { name: '⛏️ Pico', price: 2500, durability: 15, aliases: ['pico', 'pickaxe'] },
    espada: { name: '⚔️ Espada', price: 3000, durability: 12, aliases: ['espada', 'sword'] },
    cana: { name: '🎣 Caña de pescar', price: 2200, durability: 15, aliases: ['cana', 'caña', 'vara', 'rod'] }
};

const ALIASES = {
    balance: ['balance', 'bal', 'coins'],
    baltop: ['baltop', 'eboard', 'economytop'],
    coinflip: ['coinflip', 'cf', 'flip'],
    crime: ['crime'],
    daily: ['daily'],
    deposit: ['deposit', 'dep', 'd'],
    einfo: ['einfo', 'economyinfo', 'cooldowns'],
    pay: ['pay', 'transfer', 'give'],
    roulette: ['roulette', 'rt', 'ruleta', 'rtl'],
    reward: ['reward', 'regalo', 'premio'],
    shop: ['tienda'],
    level: ['level', 'nivel', 'xp', 'experiencia'],
    mine: ['mine', 'minar', 'mineria'],
    fish: ['fish', 'pescar', 'pesca'],
    hunt: ['hunt', 'cazar', 'caza'],
    merchant: ['mercader', 'mercado'],
    dungeon: ['dungeon', 'mazmorra', 'mazmorras'],
    mission: ['mission', 'mision', 'misiones'],
    clan: ['clan', 'clanes'],
    goldtop: ['goldtop', 'orotop', 'toporo', 'riqueza'],
    slut: ['slut'],
    steal: ['steal', 'rob', 'robar'],
    withdraw: ['withdraw', 'with', 'retirar', 'wd'],
    work: ['work', 'w']
};

const HELP = {
    balance: 'balance | bal', baltop: 'baltop [página]', coinflip: 'cf <cantidad>', crime: 'crime',
    daily: 'daily', deposit: 'deposit <cantidad|all>', einfo: 'einfo', pay: 'pay <cantidad> @usuario',
    roulette: 'rt <cantidad> <rojo|negro>', reward: 'regalo <token>', shop: 'tienda [1-5]', level: 'nivel', mine: 'minar', fish: 'pescar', hunt: 'cazar', merchant: 'mercader [pico|espada|cana]', dungeon: 'mazmorra', mission: 'misiones [nueva]', clan: 'clan <crear|unirse|salir|info>', goldtop: 'orotop', slut: 'slut', steal: 'rob @usuario',
    withdraw: 'with <cantidad|all>', work: 'work'
};

function fmt(value) { return Number(value || 0).toLocaleString('es-ES'); }
function reply(sock, chatId, msg, text, extra = {}) {
    return sock.sendMessage(chatId, { text, ...extra }, { quoted: msg });
}
function getSender(msg, chatId) {
    return msg?.key?.participant || (msg?.key?.fromMe ? msg?.key?.remoteJid : chatId);
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
    user.dungeon ||= { day: dayKey(), runs: 0 };
    if (user.dungeon.day !== dayKey()) user.dungeon = { day: dayKey(), runs: 0 };
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
        await new Promise(resolve => setTimeout(resolve, 450));
        try { sent = await sock.sendMessage(chatId, { text: frame, edit: sent.key }); } catch (e) { /* Compatibilidad */ }
    }
    return sent;
}
const JOB_MESSAGES = {
    work: {
        gain: ['Trabajaste para el gran sistema capitalista y fuiste recompensado con', 'Cargaste cajas en el mercado toda la tarde y ganaste', 'Repartiste pizzas bajo la lluvia y recibiste', 'Programaste toda la noche y tu jefe te pagó', 'Limpiaste oficinas a escondidas y conseguiste', 'Vendiste limonada en el parque y juntaste', 'Ayudaste a una anciana a cruzar y te dio', 'Ganaste un mini torneo de barrio y te llevaste', 'Hiciste un mandado urgente y te pagaron', 'Tradujiste un texto aburrido y cobraste', 'Paseaste doce perros y todos regresaron con sus dueños', 'Arreglaste el Wi-Fi del vecino y te recompensaron con', 'Vendiste empanadas caseras y juntaste', 'Fuiste extra en una película y cobraste', 'Cuidaste un gato que te juzgó durante ocho horas y recibiste', 'Organizaste el caos de una mudanza y ganaste', 'Probaste colchones profesionalmente y te pagaron', 'Te pusiste casco, chaleco y protección para trabajar seguro y recibiste', 'Rescataste una cometa del árbol y te dieron', 'Encontraste las llaves perdidas del jefe y cobraste', 'Hiciste de fotógrafo en una boda y conseguiste', 'Reparaste una bicicleta con cinta adhesiva y te pagaron', 'Vendiste globos en el parque y regresaste con', 'Lavaste un auto tan bien que el dueño no lo reconoció y te dio', 'Trabajaste en un turno nocturno con toda la protección y ganaste'],
        loss: ['Intentaste trabajar, pero tu jefe te estafó y perdiste', 'Te robaron la cartera camino al trabajo y perdiste', 'Invertiste en un negocio trucho y perdiste', 'Te multaron por estacionar mal y perdiste', 'Un cliente no te pagó y perdiste', 'Tropezaste y se te cayeron las monedas, perdiste', 'El banco te cobró comisiones y perdiste', 'Te salió mal el trabajo y perdiste', 'El gato que cuidabas te despidió y perdiste', 'Te pusiste todo el equipo de protección, pero olvidaste cobrar y perdiste', 'El repartidor se quedó con tu propina y perdiste', 'Tu invento explotó de forma cómica y perdiste', 'Lavaste un auto y accidentalmente lo dejaste más sucio, perdiste', 'El cliente pidió reembolso porque trabajaste demasiado bien y perdiste', 'Tu primer día fue tan desastroso que pagaste por capacitación']
    },
    crime: {
        gain: ['Robaste una tienda de conveniencia y escapaste con', 'Estafaste a un millonario distraído y conseguiste', 'Hackeaste una cuenta bancaria ficticia y te llevaste', 'Vendiste mercancía robada en el mercado negro y ganaste', 'Asaltaste un banco sin disparos y huiste con', 'Participaste en una pelea clandestina y ganaste', 'Falsificaste documentos y los vendiste por', 'Traficaste con boletos falsos y juntaste', 'Vendiste una colección de memes como arte moderno y cobraste', 'Convenciste a un guardia de que eras parte del tour y ganaste', 'Hiciste contrabando de dulces en la escuela y recibiste', 'Encontraste un maletín sospechoso lleno de cupones y ganaste', 'Organizaste una fuga de palomas mensajeras y cobraste', 'Venciste al jefe final del mercado negro y te llevaste', 'Vendiste el mismo secreto tres veces y juntaste', 'Robaste el protagonismo en una reunión y te pagaron', 'Hiciste una entrega secreta con casco y protección y recibiste', 'Negociaste con un villano de caricatura y ganaste', 'Intercambiaste una piedra común por una supuesta joya y cobraste', 'Entraste por la puerta principal con cara de seguridad y te dieron'],
        loss: ['Te atraparon robando en una tienda y pagaste la fianza de', 'La policía te detuvo y tuviste que sobornar con', 'Un socio te traicionó y te robó', 'Intentaste estafar al equivocado y te hizo pagar', 'Te cayó la policía en plena operación y perdiste', 'Compraste mercancía falsa y perdiste', 'Te hackearon de vuelta y perdiste', 'Tu plan falló y terminaste pagando', 'El guardia te pidió identificación y olvidaste tu propio nombre, perdiste', 'Tu disfraz era tan malo que el villano te reconoció y perdiste', 'La paloma mensajera entregó el plan a la policía y perdiste', 'Intentaste escapar con protección, pero olvidaste las llaves y perdiste', 'Vendiste un secreto que ya era público y perdiste', 'El maletín estaba lleno de recibos y perdiste', 'Te persiguió un perro pequeño y abandonaste todo, perdiste']
    },
    slut: {
        gain: ['Atendiste a un cliente vistiendo su cosplay favorito y te dieron', 'Un cliente generoso te pagó una noche completa y recibiste', 'Grabaste contenido exclusivo y lo vendiste por', 'Un extranjero te pagó por una noche en su hotel y ganaste', 'Atendiste a un político famoso y te dejó', 'Hiciste un show privado por webcam y juntaste', 'Un cliente te pagó por acompañarlo a una cena y ganaste', 'Te contrataron para una despedida de soltero y conseguiste', 'Un cliente rico te dio una propina generosa:', 'Triunfaste con tu último cliente y ganaste', 'Trabajaste con discreción, protección y una sonrisa profesional y recibiste', 'Te contrataron para bailar con un disfraz ridículo y te pagaron', 'Acompañaste a alguien a una cena y fingiste entender de vinos, ganaste', 'Vendiste fotos de tus calcetines y juntaste', 'Hiciste un show temático de superhéroes y conseguiste', 'Un cliente pidió un servicio premium y te dejó', 'Te contrataron para una fiesta elegante y recibiste', 'Hiciste una sesión nocturna con todo el equipo de protección y ganaste', 'Consolaste a alguien que solo quería hablar y te dio', 'Te pagaron por enseñar un baile que tú tampoco sabías hacer', 'Te convertiste en la estrella de una despedida y cobraste', 'Un fan del cosplay te dejó una propina enorme y ganaste', 'Trabajaste de forma segura, protegida y profesional y recibiste', 'Un cliente pidió discreción y pagó por adelantado', 'Cerraste la noche con estilo y juntaste'],
        loss: ['Un cliente se escapó sin pagarte y perdiste', 'Te cayó la policía en plena noche y tuviste que sobornar con', 'Un cliente abusivo te estafó y perdiste', 'La cuenta se te bloqueó y perdiste', 'Un cliente te grabó sin permiso y pagaste para que borrara', 'Te robaron en la habitación del hotel y perdiste', 'Te cancelaron el show y perdiste', 'La plataforma te cobró comisiones y perdiste', 'El cliente pidió reembolso porque bailaste mirando al techo y perdiste', 'Tu disfraz se rompió antes del show y perdiste', 'Llevaste toda la protección, pero olvidaste el pago y perdiste', 'La cámara estaba apagada durante todo el show y perdiste', 'Te contrataron para cenar y solo hablaste de economía, perdiste', 'El cliente confundió tu nombre y la propina, perdiste', 'Tu coreografía fue tan moderna que nadie la entendió y perdiste', 'Te quedaste dormido durante la sesión y perdiste', 'La plataforma cobró una comisión absurda y perdiste', 'El cliente quería discreción, pero tú llegaste con una banda musical y perdiste']
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
function menu(prefix = '.') {
    return `╭───〔 🪙 ECONOMÍA 〕───╮\n│\n│ 💰 ${prefix}balance · Ver saldo\n│ 🏆 ${prefix}baltop · Ranking\n│ 🌍 ${prefix}orotop · Top global de oro\n│ ⭐ ${prefix}nivel · Ver XP y nivel\n│ 🧑‍🌾 ${prefix}mercader · Comprar herramientas\n│ ⛏️ ${prefix}minar · Minería RPG\n│ 🎣 ${prefix}pescar · Pesca RPG\n│ 🏹 ${prefix}cazar · Caza RPG\n│ 🏰 ${prefix}mazmorra · Mazmorra diaria\n│ 📜 ${prefix}misiones · Ver misión\n│ ⚔️ ${prefix}clan · Crear o unirse\n│ 🎁 ${prefix}daily · Recompensa diaria\n│ 💼 ${prefix}work · Trabajar\n│ 🏦 ${prefix}deposit · Depositar\n│ 💳 ${prefix}withdraw · Retirar\n│ 💸 ${prefix}pay · Transferir\n│ 🎰 ${prefix}coinflip · Cara o cruz\n│ 🎡 ${prefix}roulette · Ruleta\n│ 🕵️ ${prefix}crime · Cometer crimen\n│ 🦹 ${prefix}rob · Robar a un usuario\n│ 🎭 ${prefix}slut · Trabajo de riesgo\n│ 🎁 ${prefix}premio · Reclamar regalo\n│ 🛒 ${prefix}tienda · Canjear Premium\n│ ⏱️ ${prefix}einfo · Cooldowns\n│\n╰────────────────────────╯`;
}

async function runEconomy(sock, chatId, msg, command, q = '', botData, saveBotData, prefix = '.') {
    if (command === 'economy' || command === 'economymenu') return reply(sock, chatId, msg, menu(prefix));
    const canonical = Object.keys(ALIASES).find(key => ALIASES[key].includes(command)) || command;
    if (!ALIASES[canonical]) return reply(sock, chatId, msg, menu(prefix));
    const sender = getSender(msg, chatId);
    const { state, user, jid } = ensureState(botData, chatId, sender);
    const args = String(q || '').trim().split(/\s+/).filter(Boolean);
    const save = () => saveBotData();
    const mention = [jid];
    const xpEvent = addXp(user, (canonical === 'mine' || canonical === 'fish') ? 20 : 5);
    if (xpEvent.gained) save();

    if (canonical === 'shop') {
        const selected = Number(args[0]);
        if (!Number.isInteger(selected) || !PREMIUM_SHOP[selected]) {
            const options = Object.entries(PREMIUM_SHOP).map(([, item]) => `⭐ *${item.label}* — ${fmt(item.price)} ${COIN}`).join('\n');
            return reply(sock, chatId, msg, `🛒 *TIENDA PREMIUM*\n\n${options}\n\nCanjea con: *${prefix}tienda <días>*\nEjemplo: *${prefix}tienda 3*`);
        }
        const item = PREMIUM_SHOP[selected];
        if (user.coins < item.price) return reply(sock, chatId, msg, `❌ No tienes suficientes ${COIN}.\nNecesitas: *${fmt(item.price)}*\nTienes: *${fmt(user.coins)}*`);
        botData.premiumUsers ||= {};
        const current = botData.premiumUsers[jid];
        if (current && (!current.expiresAt || new Date(current.expiresAt).getTime() > Date.now())) {
            if (!current.expiresAt) return reply(sock, chatId, msg, '✅ Ya tienes Premium permanente; no necesitas comprar días.');
        }
        const start = current?.expiresAt && new Date(current.expiresAt).getTime() > Date.now() ? new Date(current.expiresAt).getTime() : Date.now();
        const expiresAt = new Date(start + selected * 86400000).toISOString();
        user.coins -= item.price;
        botData.premiumUsers[jid] = { grantedAt: current?.grantedAt || new Date().toISOString(), expiresAt, source: 'tienda' };
        save();
        return reply(sock, chatId, msg, `✅ *Canje realizado*\n\n⭐ Premium por: *${item.label}*\n🪙 Pagaste: *${fmt(item.price)} ${COIN}*\n💰 Saldo restante: *${fmt(user.coins)} ${COIN}*\n📅 Disponible hasta: *${new Date(expiresAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}*`);
    }

    if (canonical === 'merchant') {
        const selected = toolFor(args[0]);
        if (!selected) {
            const offers = Object.entries(MERCHANT_ITEMS).map(([key, item]) => {
                const current = user.tools?.[key];
                const durability = current?.durability > 0 ? ` · tienes ${current.durability}/${item.durability}` : '';
                return `🛍️ *${item.name}* — *${fmt(item.price)} ${COIN}* · ${item.durability} usos${durability}`;
            }).join('\n');
            return reply(sock, chatId, msg, `🧑‍🌾 *MERCADER RPG*\n\n${offers}\n\nComprar: *${prefix}mercader <pico|espada|cana>*\n⛏️ Minar requiere pico\n⚔️ Cazar requiere espada\n🎣 Pescar requiere caña`);
        }
        const item = MERCHANT_ITEMS[selected];
        if (user.coins < item.price) return reply(sock, chatId, msg, `❌ No tienes suficientes ${COIN}.\nNecesitas: *${fmt(item.price)}*\nTienes: *${fmt(user.coins)}*`);
        user.tools ||= {};
        user.coins -= item.price;
        user.tools[selected] = { durability: item.durability, maxDurability: item.durability, boughtAt: new Date().toISOString() };
        save();
        return reply(sock, chatId, msg, `✅ Compraste ${item.name}\n\n💸 Precio: *${fmt(item.price)} ${COIN}*\n🔧 Durabilidad: *${item.durability}/${item.durability} usos*\n💰 Saldo: *${fmt(user.coins)} ${COIN}*`);
    }

    if (canonical === 'mission') {
        const action = String(args[0] || '').toLowerCase();
        if (action === 'nueva' && user.mission && !user.mission.completed) return reply(sock, chatId, msg, '📜 Ya tienes una misión activa. Complétala antes de pedir otra.');
        const hadMission = Boolean(user.mission);
        const current = action === 'nueva' ? ensureMission(user, true) : (user.mission || ensureMission(user));
        if (action === 'nueva' || !hadMission) save();
        const dungeon = ensureDungeonState(user);
        if (current.completed) return reply(sock, chatId, msg, `📜 *MISIÓN COMPLETADA*\n\n🏰 Mata *${current.target} monstruos* en la mazmorra.\n🎁 Recompensa recibida: *${fmt(current.reward)} ${COIN}*\n\nEscribe *${prefix}misiones nueva* para obtener otra misión.`);
        return reply(sock, chatId, msg, `📜 *MISIÓN DE MAZMORRA*\n\n🏰 Derrota monstruos: *${current.progress}/${current.target}*\n🎁 Recompensa: *${fmt(current.reward)} ${COIN}*\n🚪 Entradas hoy: *${dungeon.runs}/3*\n\nUsa *${prefix}mazmorra* para avanzar.`);
    }

    if (canonical === 'dungeon') {
        const dungeon = ensureDungeonState(user);
        if (user.mission?.completed) return reply(sock, chatId, msg, `🎉 Ya completaste tu misión actual de *${user.mission.target} monstruos*.\nUsa *${prefix}misiones nueva* para recibir otra misión.`);
        const mission = ensureMission(user);
        if (dungeon.runs >= 3) return reply(sock, chatId, msg, `🚪 Ya bajaste a la mazmorra *3/3 veces* hoy.\nVuelve mañana para continuar la misión.`);
        const sword = toolState(user, 'espada');
        if (!sword) return reply(sock, chatId, msg, `❌ Necesitas una ⚔️ *espada* para entrar a la mazmorra.\nUsa *${prefix}mercader espada* para comprar una.`);
        const remaining = Math.max(0, mission.target - mission.progress);
        const runsLeft = 3 - dungeon.runs;
        const kills = runsLeft === 1 ? remaining : Math.min(remaining, 5 + Math.floor(Math.random() * 8));
        const used = consumeTool(user, 'espada');
        dungeon.runs += 1;
        mission.progress += kills;
        const reward = random(DUNGEON_REWARDS);
        user.coins += reward;
        let completion = '';
        if (mission.progress >= mission.target) {
            mission.progress = mission.target;
            mission.completed = true;
            user.coins += mission.reward;
            completion = `\n\n🎉 *¡Misión completada!*\n🎁 Bonus: *${fmt(mission.reward)} ${COIN}*`;
        }
        save();
        await animate(sock, chatId, msg, ['🏰 Las puertas de la mazmorra se abren...', '👾 Monstruos detectados... ▰▱▱▱▱▱▱▱▱▱', `⚔️ Derrotando monstruos... *${kills} eliminados*`, '🏆 ¡Has sobrevivido a la expedición!']);
        return reply(sock, chatId, msg, `✅ Expedición completada\n\n👾 Monstruos derrotados: *${kills}*\n🪙 Recompensa: *${fmt(reward)} ${COIN}*\n📜 Misión: *${mission.progress}/${mission.target}*\n🚪 Entradas hoy: *${dungeon.runs}/3*\n🔧 Espada: *${used.durability}/12 usos*${used.broken ? '\n💥 Tu espada se rompió. Compra otra en el mercader.' : ''}${completion}`);
    }

    if (canonical === 'level') {
        return reply(sock, chatId, msg, `🧙 *PERFIL RPG*\n\n👤 @${numberOf(jid)}\n⭐ Nivel: *${user.rpg.level}*\n✨ XP total: *${fmt(user.rpg.xp)}*\n${levelBar(user)}`, { mentions: [jid] });
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
            return reply(sock, chatId, msg, `❌ Necesitas comprar un ${names[toolKey]} para poder ${isMine ? 'minar' : isFish ? 'pescar' : 'cazar'}.\nUsa *${prefix}mercader* para ver los precios.`);
        }
        const reward = random(isMine ? MINING_REWARDS : isFish ? FISHING_REWARDS : HUNTING_REWARDS);
        const item = isMine ? random(['carbón', 'hierro', 'oro', 'diamante', 'redstone']) : isFish ? random(['bacalao', 'salmón', 'pez globo', 'tesoro', 'libro encantado']) : random(['conejo', 'jabalí', 'ciervo', 'zorro', 'lobo salvaje']);
        const used = consumeTool(user, toolKey);
        user.coins += reward;
        user[waitKey] = Date.now();
        save();
        const frames = isMine
            ? [`⛏️ *${numberOf(jid)}* entra a una mina...`, '⛏️ Rompiendo piedra... ▰▱▱▱▱▱▱▱▱▱', '⛏️ Rompiendo piedra... ▰▰▰▰▰▱▱▱▱▱', `💎 ¡Encontraste ${item}!`]
            : isFish ? [`🎣 *${numberOf(jid)}* lanza la caña...`, '🎣 El agua se mueve... ▰▱▱▱▱▱▱▱▱▱', '🎣 ¡Algo mordió el anzuelo! ▰▰▰▰▰▰▱▱▱▱', `🐟 ¡Pescaste ${item}!`] : [`⚔️ *${numberOf(jid)}* se prepara para cazar...`, '⚔️ Siguiendo huellas... ▰▱▱▱▱▱▱▱▱▱', '⚔️ ¡La presa apareció! ▰▰▰▰▰▰▱▱▱▱', `🏹 ¡Cazaste un ${item}!`];
        await animate(sock, chatId, msg, frames);
        return reply(sock, chatId, msg, `✅ Recibiste *${fmt(reward)} ${COIN}*\n💰 Saldo: *${fmt(user.coins)}*\n🔧 ${toolKey}: *${used.durability}/${MERCHANT_ITEMS[toolKey].durability} usos*${used.broken ? `\n💥 Tu ${toolKey} se rompió. Compra otro en *${prefix}mercader*.` : ''}\n⭐ +${xpEvent.gained || 0} XP`);
    }

    if (canonical === 'clan') {
        botData.clans ||= {};
        const action = String(args[0] || 'lista').toLowerCase();
        const currentClan = getUserClan(botData.clans, jid);
        if (['crear', 'create'].includes(action)) {
            const displayName = args.slice(1).join(' ').trim().slice(0, 20);
            const key = clanKey(displayName);
            if (!key) return reply(sock, chatId, msg, `ℹ️ Uso: *${prefix}clan crear <nombre>*`);
            if (currentClan) return reply(sock, chatId, msg, `❌ Ya perteneces al clan *${currentClan.name}*.`);
            if (botData.clans[key]) return reply(sock, chatId, msg, '❌ Ese nombre de clan ya está ocupado.');
            const creationCost = 10000;
            if (user.coins < creationCost) return reply(sock, chatId, msg, `❌ Crear un clan cuesta *${fmt(creationCost)} ${COIN}*.`);
            user.coins -= creationCost;
            botData.clans[key] = { name: displayName, owner: jid, members: [jid], createdAt: new Date().toISOString() };
            save();
            return reply(sock, chatId, msg, `⚔️ *Clan creado*\n\n🏰 Nombre: *${displayName}*\n💸 Costo: *${fmt(creationCost)} ${COIN}*\n👥 Miembros: *1*`);
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
            return reply(sock, chatId, msg, `🏰 *CLAN ${clan.name.toUpperCase()}*\n\n👑 Líder: @${numberOf(clan.owner)}\n👥 Miembros: *${clan.members.length}*\n📅 Creado: *${new Date(clan.createdAt).toLocaleDateString('es-ES')}*`, { mentions: [clan.owner, ...clan.members] });
        }
        const clans = clanList(botData.clans);
        const listing = clans.length ? clans.slice(0, 10).map((clan, index) => `${index + 1}. 🏰 *${clan.name}* — ${clan.members.length} miembros`).join('\n') : 'Todavía no hay clanes creados.';
        return reply(sock, chatId, msg, `⚔️ *CLANES*\n\n${listing}\n\nCrear: *${prefix}clan crear <nombre>*\nUnirse: *${prefix}clan unirse <nombre>*\nSalir: *${prefix}clan salir*\nInfo: *${prefix}clan info [nombre]*`);
    }

    if (canonical === 'goldtop') {
        const wealth = new Map();
        for (const group of Object.values(botData.economy || {})) {
            for (const [key, value] of Object.entries(group?.users || {})) {
                const total = Math.max(0, Number(value.coins) || 0) + Math.max(0, Number(value.bank) || 0);
                wealth.set(numberOf(key), (wealth.get(numberOf(key)) || 0) + total);
            }
        }
        const rows = [...wealth.entries()].filter(([, total]) => total > 0).sort((a, b) => b[1] - a[1]);
        if (!rows.length) return reply(sock, chatId, msg, '🏆 Todavía no hay jugadores con oro registrado.');
        const text = rows.slice(0, 10).map(([number, total], index) => `${index + 1}. @${number} — *${fmt(total)} ${COIN}*`).join('\n');
        return reply(sock, chatId, msg, `🏆 *TOP GLOBAL DE ORO*\n\n👥 Jugadores con oro: *${rows.length}*\n\n${text}`, { mentions: rows.slice(0, 10).map(([number]) => `${number}@s.whatsapp.net`) });
    }

    if (canonical === 'balance') {
        const target = getTarget(msg, q, state) || { key: jid, user };
        const total = (target.user.coins || 0) + (target.user.bank || 0);
        return reply(sock, chatId, msg, `💰 *Economía de @${numberOf(target.key)}*\n\n💵 Efectivo: *${fmt(target.user.coins)} ${COIN}*\n🏦 Banco: *${fmt(target.user.bank)} ${COIN}*\n💎 Total: *${fmt(total)} ${COIN}*`, { mentions: [target.key] });
    }
    if (canonical === 'baltop') {
        const page = Math.max(1, Number(args[0]) || 1);
        const entries = Object.entries(state.users).map(([key, value]) => ({ key, total: (value.coins || 0) + (value.bank || 0) })).filter(x => x.total > 0).sort((a, b) => b.total - a.total);
        if (!entries.length) return reply(sock, chatId, msg, '🏆 Todavía no hay cuentas con saldo en este grupo.');
        const pages = Math.max(1, Math.ceil(entries.length / 10));
        const rows = entries.slice((page - 1) * 10, page * 10);
        if (!rows.length) return reply(sock, chatId, msg, `❌ Página inválida. Usa una página entre 1 y ${pages}.`);
        const text = rows.map((x, i) => `${(page - 1) * 10 + i + 1}. @${numberOf(x.key)} — *${fmt(x.total)} ${COIN}*`).join('\n');
        return reply(sock, chatId, msg, `🏆 *RANKING DE ECONOMÍA*\n\n${text}\n\n_Página ${page}/${pages}_`, { mentions: rows.map(x => x.key) });
    }
    if (canonical === 'daily') {
        const wait = cooldown(user, 'lastDaily', 24 * 60 * 60 * 1000);
        if (wait) return reply(sock, chatId, msg, `⏳ Ya reclamaste tu recompensa. Regresa en *${timeLeft(wait)}*.`);
        const streak = wait ? 0 : (Number(user.streak) || 0) + 1;
        const reward = 30000 + (streak - 1) * 5000;
        Object.assign(user, { coins: user.coins + reward, streak, lastDaily: Date.now() }); save();
        return reply(sock, chatId, msg, `🎁 Recibiste *${fmt(reward)} ${COIN}* por tu recompensa diaria.\n🔥 Racha actual: *${streak} días*`);
    }
    if (canonical === 'work' || canonical === 'crime' || canonical === 'slut') {
        const config = canonical === 'work' ? { key: 'lastWork', wait: 60e3, gain: [1, 10000], loss: [1000, 5000], chance: .25, label: 'trabajo' } : canonical === 'crime' ? { key: 'lastCrime', wait: 5 * 60e3, gain: [3000, 18000], loss: [3000, 15000], chance: .25, label: 'crimen' } : { key: 'lastSlut', wait: 4 * 60e3, gain: [1000, 11000], loss: [2000, 8000], chance: .30, label: 'trabajo de riesgo' };
        const wait = cooldown(user, config.key, config.wait);
        if (wait) return reply(sock, chatId, msg, `⏳ Debes esperar *${timeLeft(wait)}* para volver a usar este comando.`);
        const lost = Math.random() < config.chance;
        const range = config[ lost ? 'loss' : 'gain' ];
        const value = Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
        const real = lost ? Math.min(user.coins, value) : value;
        user.coins += lost ? -real : real;
        user[config.key] = Date.now(); save();
        const activity = randomJob(user, canonical, lost ? 'loss' : 'gain');
        return reply(sock, chatId, msg, lost ? `💥 ${activity} *${fmt(real)} ${COIN}*.\n💵 Efectivo: *${fmt(user.coins)}*` : `✅ ${activity} *${fmt(real)} ${COIN}*.\n💵 Efectivo: *${fmt(user.coins)}*`);
    }
    if (canonical === 'deposit' || canonical === 'withdraw') {
        const input = amount(args[0]);
        if (input === null) return reply(sock, chatId, msg, `ℹ️ Uso: *${prefix}${HELP[canonical]}*`);
        const available = canonical === 'deposit' ? user.coins : user.bank;
        const value = input === 'all' ? available : input;
        if (!value || value > available) return reply(sock, chatId, msg, `❌ No tienes suficientes ${COIN} disponibles.`);
        if (canonical === 'deposit') { user.coins -= value; user.bank += value; } else { user.bank -= value; user.coins += value; }
        save(); return reply(sock, chatId, msg, `${canonical === 'deposit' ? '🏦 Depositaste' : '💳 Retiraste'} *${fmt(value)} ${COIN}*.\n💵 Efectivo: *${fmt(user.coins)}* · Banco: *${fmt(user.bank)}*`);
    }
    if (canonical === 'pay') {
        const target = getTarget(msg, q, state);
        const value = amount(args[0]);
        if (!target || !value || value === 'all') return reply(sock, chatId, msg, `ℹ️ Uso: *${prefix}${HELP.pay}*`);
        if (target.key === jid) return reply(sock, chatId, msg, '❌ No puedes transferirte a ti mismo.');
        if (value < 1000 || user.bank < value) return reply(sock, chatId, msg, `❌ Necesitas al menos 1.000 ${COIN} en el banco para transferir.`);
        user.bank -= value; target.user.bank = (target.user.bank || 0) + value; save();
        return reply(sock, chatId, msg, `💸 Transferiste *${fmt(value)} ${COIN}* a @${numberOf(target.key)}.`, { mentions: [target.key] });
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
        if (won) user.coins += value; else user.coins -= value;
        save(); return reply(sock, chatId, msg, won ? `🎉 Ganaste *${fmt(value)} ${COIN}*!` : `😔 Perdiste *${fmt(value)} ${COIN}*.`);
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
        if (Math.random() < .5 && stolen > 0) { target.user.coins -= stolen; user.coins += stolen; save(); return reply(sock, chatId, msg, `🦹 Robaste *${fmt(stolen)} ${COIN}* a @${numberOf(target.key)}.`, { mentions: [target.key] }); }
        const fine = Math.min(user.coins, Math.floor(Math.random() * 4000) + 1000); user.coins -= fine; save(); return reply(sock, chatId, msg, `🚔 Te atraparon y perdiste *${fmt(fine)} ${COIN}*.`);
    }
    if (canonical === 'einfo') {
        const rows = [['work', 'lastWork', 60e3], ['crime', 'lastCrime', 5 * 60e3], ['rob', 'lastRob', 10 * 60e3], ['daily', 'lastDaily', 24 * 60 * 60e3], ['slut', 'lastSlut', 4 * 60e3]].map(([label, key, ms]) => `${label}: ${cooldown(user, key, ms) ? timeLeft(cooldown(user, key, ms)) : 'disponible'}`).join('\n');
        return reply(sock, chatId, msg, `⏱️ *TUS COOLDOWNS*\n\n${rows}`);
    }
}

module.exports = runEconomy;
module.exports.aliases = ALIASES;
module.exports.menu = menu;
