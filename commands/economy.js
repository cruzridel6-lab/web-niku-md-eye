const COIN = '🪙 Niku Coin';
const MIN_BET = 200;

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
    slut: ['slut'],
    steal: ['steal', 'rob', 'robar'],
    withdraw: ['withdraw', 'with', 'retirar', 'wd'],
    work: ['work', 'w']
};

const HELP = {
    balance: 'balance | bal', baltop: 'baltop [página]', coinflip: 'cf <cantidad>', crime: 'crime',
    daily: 'daily', deposit: 'deposit <cantidad|all>', einfo: 'einfo', pay: 'pay <cantidad> @usuario',
    roulette: 'rt <cantidad> <rojo|negro>', slut: 'slut', steal: 'rob @usuario',
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
    return `╭───〔 🪙 ECONOMÍA 〕───╮\n│\n│ 💰 ${prefix}balance · Ver saldo\n│ 🏆 ${prefix}baltop · Ranking\n│ 🎁 ${prefix}daily · Recompensa diaria\n│ 💼 ${prefix}work · Trabajar\n│ 🏦 ${prefix}deposit · Depositar\n│ 💳 ${prefix}withdraw · Retirar\n│ 💸 ${prefix}pay · Transferir\n│ 🎰 ${prefix}coinflip · Cara o cruz\n│ 🎡 ${prefix}roulette · Ruleta\n│ 🕵️ ${prefix}crime · Cometer crimen\n│ 🦹 ${prefix}rob · Robar a un usuario\n│ 🎭 ${prefix}slut · Trabajo de riesgo\n│ ⏱️ ${prefix}einfo · Cooldowns\n│\n╰────────────────────────╯`;
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
