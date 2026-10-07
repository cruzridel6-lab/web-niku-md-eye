const pendingMarriages = new Map();
const { classImagePath, sendImageCaption } = require('../lib/rpgMedia');

const ALIASES = {
    register: ['registrarse', 'registrar', 'register', 'registro'],
    profile: ['profile', 'perfil', 'user'],
    marry: ['marry', 'casar', 'casarse', 'matrimonio'],
    divorce: ['divorce', 'divorciar', 'separarse'],
    history: ['history', 'historial', 'historialmatrimonial', 'marryhistory'],
    pfp: ['pfp', 'getpfp', 'foto', 'fotoperfil', 'foto perfil', 'avatar'],
    setbirth: ['setbirth', 'setcumple', 'setbirthday', 'cumple', 'cumpleanos', 'cumpleaños', 'birthday'],
    setdesc: ['setbio', 'setdescription', 'setdescperfil'],
    setgenre: ['setgenre', 'setgenero']
};
const ALIAS_TO_COMMAND = Object.fromEntries(Object.entries(ALIASES).flatMap(([key, values]) => values.map(value => [value, key])));
const profileAliases = Object.values(ALIASES).flat();
const MONTHS = { enero: 1, january: 1, febrero: 2, february: 2, marzo: 3, march: 3, abril: 4, april: 4, mayo: 5, may: 5, junio: 6, june: 6, julio: 7, july: 7, agosto: 8, august: 8, septiembre: 9, september: 9, octubre: 10, october: 10, noviembre: 11, november: 11, diciembre: 12, december: 12 };
const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function numberOf(jid) { return String(jid || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, ''); }
function canonicalJid(jid) {
    const number = numberOf(jid);
    return number ? `${number}@s.whatsapp.net` : String(jid || '').trim();
}
function rememberMessageIdentity(botData, msg, chatId) {
    botData.phoneAliases ||= {};
    const lid = msg?.key?.participant || (!msg?.key?.fromMe && String(chatId || '').endsWith('@lid') ? chatId : '');
    const phone = msg?.key?.participantAlt || msg?.key?.senderPn;
    if (/@lid$/i.test(String(lid)) && /@s\.whatsapp\.net$/i.test(String(phone))) {
        const number = numberOf(phone);
        if (number && botData.phoneAliases[number] !== lid) botData.phoneAliases[number] = lid;
    }
}
function resolvePhoneNumber(botData, jid) {
    const wanted = numberOf(jid);
    if (!wanted) return '';
    for (const [phone, lid] of Object.entries(botData?.phoneAliases || {})) {
        if (numberOf(phone) === wanted || numberOf(lid) === wanted) return numberOf(phone);
    }
    const profile = Object.entries(botData?.profiles || {}).find(([key, value]) => numberOf(key) === wanted || numberOf(value?.phoneNumber) === wanted);
    return numberOf(profile?.[1]?.phoneNumber || profile?.[0]) || wanted;
}
function jidOf(msg, chatId, botData) {
    const candidate = msg?.key?.participantAlt || msg?.key?.senderPn || msg?.key?.participant || (msg?.key?.fromMe ? msg?.key?.remoteJid : chatId);
    return canonicalJid(resolvePhoneNumber(botData, candidate) || candidate);
}
function reply(sock, chatId, msg, text, extra = {}) { return sock.sendMessage(chatId, { text, ...extra }, { quoted: msg }); }
function contextTarget(msg) {
    const context = msg?.message?.extendedTextMessage?.contextInfo || {};
    return context.mentionedJid?.[0] || context.participant || context.quotedMessage?.key?.participant || context.quotedMessage?.key?.sender || null;
}
function findTarget(msg, q, own) {
    const context = contextTarget(msg);
    if (context) return context;
    const match = String(q || '').match(/@?(\d{7,16})/);
    return match ? `${match[1]}@s.whatsapp.net` : own;
}
function ensure(botData, jid, name = 'Usuario') {
    botData.profiles ||= {};
    const key = canonicalJid(jid);
    if (!botData.profiles[key]) {
        const legacyKey = Object.keys(botData.profiles).find(item => numberOf(item) && numberOf(item) === numberOf(key));
        if (legacyKey) botData.profiles[key] = botData.profiles[legacyKey];
    }
    botData.profiles[key] ||= { name, registered: false, description: '', genre: '', birth: '', partner: null, history: [] };
    const profile = botData.profiles[key];
    profile.name ||= name;
    profile.registered = Boolean(profile.registered);
    profile.description ||= '';
    profile.genre ||= '';
    profile.birth ||= profile.birthday || profile.birthDate || profile.cumpleanos || profile.cumpleaños || '';
    profile.birthday = profile.birth;
    profile.phoneNumber ||= numberOf(key);
    profile.history = Array.isArray(profile.history) ? profile.history : [];
    return profile;
}
function normalizeName(name) {
    return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
function editDistance(a, b) {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let previous = row[0]; row[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const current = row[j];
            row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
            previous = current;
        }
    }
    return row[b.length];
}
function isSimilarName(candidate, existing) {
    const a = normalizeName(candidate); const b = normalizeName(existing);
    if (!a || !b) return false;
    if (a === b) return true;
    const shorter = Math.min(a.length, b.length);
    if (shorter >= 4 && (a.includes(b) || b.includes(a))) return true;
    return shorter >= 4 && editDistance(a, b) <= Math.max(1, Math.floor(shorter * 0.2));
}
function findNameConflict(botData, name, ownJid) {
    const ownNumber = numberOf(ownJid);
    return Object.entries(botData.profiles || {}).find(([jid, profile]) =>
        numberOf(jid) !== ownNumber && profile?.registered && profile?.name && isSimilarName(name, profile.name)
    );
}
function displayGenre(value) { return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Sin especificar'; }
function spouseWord(genre) { return genre === 'mujer' ? 'casada' : genre === 'hombre' ? 'casado' : 'casade'; }
function parseBirth(input) {
    const clean = String(input || '').trim().toLowerCase();
    const parts = clean.split(/[\s/.-]+/).filter(Boolean);
    if (parts.length < 2 || parts.length > 3) return null;
    let month, day, year = parts[2] || '';
    if (MONTHS[parts[0]]) { month = MONTHS[parts[0]]; day = Number(parts[1]); }
    else if (MONTHS[parts[1]]) { day = Number(parts[0]); month = MONTHS[parts[1]]; }
    else { const a = Number(parts[0]); const b = Number(parts[1]); month = a > 12 ? b : a; day = a > 12 ? a : b; }
    if (!Number.isInteger(day) || !Number.isInteger(month) || month < 1 || month > 12 || day < 1 || day > 31) return null;
    if (year && (!/^\d{4}$/.test(year) || Number(year) < 1900 || Number(year) > new Date().getFullYear())) return null;
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}${year ? `/${year}` : ''}`;
}
function formatBirth(value) {
    if (!value) return 'Sin especificar';
    const parts = value.split('/');
    const day = Number(parts[0]); const month = Number(parts[1]);
    return `${day} de ${MONTH_NAMES[month - 1] || 'mes desconocido'}${parts[2] ? ` de ${parts[2]}` : ''}`;
}
function targetName(botData, jid) {
    const wanted = numberOf(jid);
    const match = Object.entries(botData.profiles || {}).find(([key, profile]) => numberOf(key) === wanted && profile?.name);
    return match?.[1]?.name || `+${wanted}`;
}
function economyFor(botData, chatId, jid) {
    const users = botData.economy?.[chatId]?.users || {};
    const wanted = numberOf(jid);
    const aliases = botData.phoneAliases || {};
    const identityNumbers = new Set([wanted]);
    const mappedLid = aliases[wanted];
    if (mappedLid) identityNumbers.add(numberOf(mappedLid));
    for (const [phone, lid] of Object.entries(aliases)) {
        if (numberOf(lid) === wanted) identityNumbers.add(numberOf(phone));
    }
    const addProfileIdentity = (key, profile) => {
        const values = [numberOf(key), numberOf(profile?.phoneNumber)].filter(Boolean);
        if (values.some(value => identityNumbers.has(value))) values.forEach(value => identityNumbers.add(value));
    };
    for (const [key, profile] of Object.entries(botData.profiles || {})) addProfileIdentity(key, profile);
    const samePlayer = item => identityNumbers.has(numberOf(item));
    const key = Object.keys(users).find(samePlayer);
    if (key) {
        const current = users[key];
        if (current?.rpg?.class || current?.rpg?.classKey || current?.classKey) return current;
    }
    const matches = [];
    for (const state of Object.values(botData.economy || {})) {
        const stateUsers = state?.users || {};
        const stateKey = Object.keys(stateUsers).find(samePlayer);
        if (stateKey) matches.push(stateUsers[stateKey]);
    }
    return matches.find(user => user?.rpg?.class || user?.rpg?.classKey || user?.classKey) || (key ? users[key] : matches[0] || {});
}
function profileMenu(prefix = '.') {
    return `╭───〔 👤 PERFIL 〕───╮\n│\n│ 📝 ${prefix}registrarse nombre · Registrarte\n│ 👤 ${prefix}perfil · Ver perfil\n│ 💍 ${prefix}marry @usuario · Casarse\n│ 💔 ${prefix}divorce · Divorciarse\n│ 📜 ${prefix}historial · Historial matrimonial\n│ 🖼️ ${prefix}pfp · Ver foto de perfil\n│ 🎂 ${prefix}setbirth DD/MM/AAAA · Cumpleaños\n│ ✍️ ${prefix}setbio · Descripción\n│ ⚧️ ${prefix}setgenre · Género\n│\n╰────────────────────╯`;
}

async function profileCommand(sock, chatId, msg, command = 'profile', q = '', botData, saveBotData, prefix = '.') {
    const canonical = ALIAS_TO_COMMAND[String(command || '').toLowerCase()] || 'profile';
    rememberMessageIdentity(botData, msg, chatId);
    const own = jidOf(msg, chatId, botData);
    const ownProfile = ensure(botData, own, msg?.pushName || 'Usuario');
    botData.pendingMarriages ||= {};
    const save = () => saveBotData();
    if (canonical === 'register') {
        const name = String(q || '').trim().replace(/\s+/g, ' ');
        if (name.length < 2 || name.length > 32) return reply(sock, chatId, msg, `╭━━〔 ⚠️ *NOMBRE NO VÁLIDO* 〕━━╮\n┃\n┃ Usa un nombre de 2 a 32 caracteres.\n┃\n┃ 📌 Ejemplo:\n┃ ➜ *${prefix}registrarse Valentina*\n┃\n╰━━〔 🪙 NIKU MD 〕━━╯`);
        if (ownProfile.registered) return reply(sock, chatId, msg, `❌ Ya estás registrado como *${ownProfile.name}*. Cada número de WhatsApp solo puede registrarse una vez.`);
        const conflict = findNameConflict(botData, name, own);
        if (conflict) return reply(sock, chatId, msg, `❌ El nombre *${name}* ya está ocupado o es demasiado parecido a *${conflict[1].name}*. Elige otro nombre único.`);
        ownProfile.name = name;
        ownProfile.registered = true;
        save();
        return reply(sock, chatId, msg, `╭━━━〔 ✅ *REGISTRO COMPLETADO* 〕━━━╮\n┃\n┃ 🎉 Bienvenido a *NIKU MD*, *${name}*\n┃\n┃ Tu perfil ya está activo y tu nombre\n┃ aparecerá en los rankings públicos.\n┃\n┃ 🪙 Economía: *monedas de oro*\n┃ 🏆 Sistema: *RPG · clanes · logros*\n┃\n┃ Escribe *.menu* para comenzar.\n┃\n╰━━━〔 🤖 *NIKU MD BOT* 〕━━━╯`);
    }
    if (canonical === 'profile' && !q && !contextTarget(msg)) return showProfile(sock, chatId, msg, own, ownProfile, botData);
    if (canonical === 'profile') {
        const target = findTarget(msg, q, own); return showProfile(sock, chatId, msg, target, ensure(botData, target), botData);
    }
    if (canonical === 'pfp') {
        const target = findTarget(msg, q, own);
        try {
            const url = await sock.profilePictureUrl(target, 'image');
            return sock.sendMessage(chatId, { image: { url }, caption: `🖼️ Foto de perfil de @${numberOf(target)}`, mentions: [target] }, { quoted: msg });
        } catch { return reply(sock, chatId, msg, `❌ No se pudo obtener la foto de perfil de @${numberOf(target)}.`, { mentions: [target] }); }
    }
    if (canonical === 'setdesc') {
        const value = String(q || '').trim();
        if (!value) { ownProfile.description = ''; save(); return reply(sock, chatId, msg, '✍️ Se eliminó tu descripción.'); }
        if (value.length > 180) return reply(sock, chatId, msg, '❌ La descripción no puede superar 180 caracteres.');
        ownProfile.description = value.replace(/\bname\b/gi, msg?.pushName || 'Usuario'); save();
        return reply(sock, chatId, msg, '✅ Descripción actualizada.');
    }
    if (canonical === 'setgenre') {
        const value = String(q || '').trim().toLowerCase();
        if (!['hombre', 'mujer', 'otro'].includes(value)) return reply(sock, chatId, msg, `ℹ️ Uso: *${prefix}setgenre hombre|mujer|otro*`);
        ownProfile.genre = value; save(); return reply(sock, chatId, msg, `✅ Género actualizado a *${displayGenre(value)}*.`);
    }
    if (canonical === 'setbirth') {
        const birth = parseBirth(q);
        if (!birth) return reply(sock, chatId, msg, `ℹ️ Usa una fecha válida, por ejemplo: *${prefix}setbirth 25/12/2000* o *${prefix}setbirth 25 diciembre*.`);
        ownProfile.birth = birth; save(); return reply(sock, chatId, msg, `🎂 Cumpleaños guardado: *${formatBirth(birth)}*.`);
    }
    if (canonical === 'history') {
        const target = findTarget(msg, q, own); const profile = ensure(botData, target);
        const current = profile.partner ? `💍 Estado actual: *${spouseWord(profile.genre)} con ${targetName(botData, profile.partner)}*` : '💔 Estado actual: sin pareja';
        const history = profile.history.length ? profile.history.map((item, i) => `${i + 1}. ${targetName(botData, item.partner)} · ${item.start} → ${item.end || 'presente'}${item.duration ? ` (${item.duration})` : ''}`).join('\n') : 'Sin matrimonios anteriores.';
        return reply(sock, chatId, msg, `📜 *HISTORIAL MATRIMONIAL DE ${profile.name}*\n\n${current}\n\n${history}`, { mentions: profile.partner ? [target, profile.partner] : [target] });
    }
    if (canonical === 'divorce') {
        if (!ownProfile.partner) return reply(sock, chatId, msg, `💔 No estás ${spouseWord(ownProfile.genre)} con nadie.`);
        const partner = ownProfile.partner; const partnerProfile = ensure(botData, partner); const end = new Date().toLocaleString('es-ES');
        const record = ownProfile.history.find(item => item.partner === partner && !item.end);
        if (record) { record.end = end; record.duration = `${Math.max(1, Math.ceil((Date.now() - record.startedAt) / 86400000))} días`; }
        const partnerRecord = partnerProfile.history.find(item => item.partner === own && !item.end);
        if (partnerRecord) { partnerRecord.end = end; partnerRecord.duration = record?.duration || 'duración desconocida'; }
        ownProfile.partner = null; partnerProfile.partner = null; save();
        return reply(sock, chatId, msg, `💔 @${numberOf(own)} y @${numberOf(partner)} se han divorciado.`, { mentions: [own, partner] });
    }
    if (canonical === 'marry') {
        const explicitTarget = contextTarget(msg) || String(q || '').match(/@?\d{7,16}/)?.[0];
        const pending = botData.pendingMarriages[own];
        const accepting = pending && pending.expires > Date.now() && (!explicitTarget || numberOf(explicitTarget) === numberOf(pending.from));
        const target = accepting ? pending.from : findTarget(msg, q, own);
        if (!target || target === own) return reply(sock, chatId, msg, `💍 Menciona o responde al usuario. Ejemplo: *${prefix}marry @usuario*`);
        const targetProfile = ensure(botData, target);
        if (ownProfile.partner) return reply(sock, chatId, msg, `💍 Ya estás ${spouseWord(ownProfile.genre)} con ${targetName(botData, ownProfile.partner)}.`);
        if (targetProfile.partner) return reply(sock, chatId, msg, '💍 Esa persona ya tiene pareja.');
        if (accepting && pending.from === target) {
            const startedAt = Date.now(); const start = new Date(startedAt).toLocaleString('es-ES');
            ownProfile.partner = target; targetProfile.partner = own;
            ownProfile.history.push({ partner: target, start, startedAt, end: null });
            targetProfile.history.push({ partner: own, start, startedAt, end: null });
            delete botData.pendingMarriages[own]; save();
            return reply(sock, chatId, msg, `💍 ¡Se han casado @${numberOf(own)} y @${numberOf(target)}!\n\nQue disfruten su nueva etapa.`, { mentions: [own, target] });
        }
        botData.pendingMarriages[target] = { from: own, expires: Date.now() + 30 * 60 * 1000 };
        const expirationTimer = setTimeout(() => { const current = botData.pendingMarriages[target]; if (current?.from === own) { delete botData.pendingMarriages[target]; save(); } }, 30 * 60 * 1000);
        expirationTimer.unref?.();
        return reply(sock, chatId, msg, `💌 @${numberOf(target)}, @${numberOf(own)} te propone matrimonio. Responde mencionándolo con *${prefix}marry* para aceptar.`, { mentions: [target, own] });
    }
    return reply(sock, chatId, msg, profileMenu(prefix));
}

async function showProfile(sock, chatId, msg, jid, profile, botData) {
    const economy = economyFor(botData, chatId, jid);
    const rpg = economy.rpg || { level: 1, xp: 0, class: '' };
    const classKey = rpg.class || rpg.classKey || economy.classKey || profile.rpg?.class || profile.rpg?.classKey || profile.classKey || '';
    const classes = { guerrero: '⚔️ Guerrero', mago: '🔮 Mago', picaro: '🗡️ Pícaro', tirador: '🏹 Tirador', paladin: '🛡️ Paladín' };
    const characterClass = classes[classKey] || '🧭 Sin clase — usa .clase para elegir';
    const partner = profile.partner ? `💍 ${spouseWord(profile.genre)} con *${targetName(botData, profile.partner)}*` : '💍 Sin pareja';
    const birth = profile.birth || profile.birthday || profile.birthDate || economy.birth || economy.birthday || '';
    const text = `👤 *PERFIL RPG DE ${profile.name}*\n\n${profile.description ? `✍️ ${profile.description}\n\n` : ''}🛡️ Clase: *${characterClass}*\n⭐ Nivel: *${Number(rpg.level) || 1}*\n✨ Experiencia: *${Number(rpg.xp) || 0} XP*\n🎂 Cumpleaños: *${formatBirth(birth)}*\n⚧️ Género: *${displayGenre(profile.genre)}*\n${partner}\n\n🪙 Bolsa: *${Number(economy.coins || 0).toLocaleString()}*\n🏦 Cofre: *${Number(economy.bank || 0).toLocaleString()}*\n📜 Matrimonios: *${profile.history.length}*`;
    const mentions = profile.partner ? [jid, profile.partner] : [jid];
    const classImage = classImagePath(classKey);
    if (classImage) return sendImageCaption(sock, chatId, msg, classImage, text, { mentions });
    try {
        const image = await sock.profilePictureUrl(jid, 'image');
        return sock.sendMessage(chatId, { image: { url: image }, caption: text, mentions }, { quoted: msg });
    } catch { return sock.sendMessage(chatId, { text, mentions }, { quoted: msg }); }
}

module.exports = profileCommand;
module.exports.aliases = profileAliases;
module.exports.menu = profileMenu;
