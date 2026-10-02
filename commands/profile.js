const pendingMarriages = new Map();

const ALIASES = {
    register: ['registrarse', 'registrar', 'register', 'registro'],
    profile: ['profile', 'perfil', 'user'],
    marry: ['marry', 'casar'],
    divorce: ['divorce', 'divorciar'],
    history: ['history', 'historial', 'historialmatrimonial', 'marryhistory'],
    pfp: ['pfp', 'getpfp', 'foto', 'avatar'],
    setbirth: ['setbirth', 'setcumple', 'setbirthday'],
    setdesc: ['setbio', 'setdescription', 'setdescperfil'],
    setgenre: ['setgenre', 'setgenero']
};
const ALIAS_TO_COMMAND = Object.fromEntries(Object.entries(ALIASES).flatMap(([key, values]) => values.map(value => [value, key])));
const profileAliases = Object.values(ALIASES).flat();
const MONTHS = { enero: 1, january: 1, febrero: 2, february: 2, marzo: 3, march: 3, abril: 4, april: 4, mayo: 5, may: 5, junio: 6, june: 6, julio: 7, july: 7, agosto: 8, august: 8, septiembre: 9, september: 9, octubre: 10, october: 10, noviembre: 11, november: 11, diciembre: 12, december: 12 };
const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function numberOf(jid) { return String(jid || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, ''); }
function jidOf(msg, chatId) { return msg?.key?.participant || (msg?.key?.fromMe ? msg?.key?.remoteJid : chatId); }
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
    botData.profiles[jid] ||= { name, registered: false, description: '', genre: '', birth: '', partner: null, history: [] };
    const profile = botData.profiles[jid];
    profile.name ||= name;
    profile.registered = Boolean(profile.registered);
    profile.description ||= '';
    profile.genre ||= '';
    profile.birth ||= '';
    profile.history = Array.isArray(profile.history) ? profile.history : [];
    return profile;
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
function targetName(botData, jid) { return botData.profiles?.[jid]?.name || `+${numberOf(jid)}`; }
function profileMenu(prefix = '.') {
    return `╭───〔 👤 PERFIL 〕───╮\n│\n│ 📝 ${prefix}registrarse nombre · Registrarte\n│ 👤 ${prefix}perfil · Ver perfil\n│ 💍 ${prefix}marry · Casarse\n│ 💔 ${prefix}divorce · Divorciarse\n│ 📜 ${prefix}historial · Historial matrimonial\n│ 🖼️ ${prefix}pfp · Ver foto de perfil\n│ 🎂 ${prefix}setbirth · Cumpleaños\n│ ✍️ ${prefix}setbio · Descripción\n│ ⚧️ ${prefix}setgenre · Género\n│\n╰────────────────────╯`;
}

async function profileCommand(sock, chatId, msg, command = 'profile', q = '', botData, saveBotData, prefix = '.') {
    const canonical = ALIAS_TO_COMMAND[String(command || '').toLowerCase()] || 'profile';
    const own = jidOf(msg, chatId);
    const ownProfile = ensure(botData, own, msg?.pushName || 'Usuario');
    const save = () => saveBotData();
    if (canonical === 'register') {
        const name = String(q || '').trim().replace(/\s+/g, ' ');
        if (name.length < 2 || name.length > 32) return reply(sock, chatId, msg, `📝 Para registrarte usa: *${prefix}registrarse Tu Nombre*\n\nTu nombre debe tener entre 2 y 32 caracteres.`);
        ownProfile.name = name;
        ownProfile.registered = true;
        save();
        return reply(sock, chatId, msg, `✅ *Registro completado*\n\nTu nombre público ahora es: *${name}*\nYa puedes usar *.menu* y todas las funciones del bot.`);
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
        const target = findTarget(msg, q, own);
        if (!target || target === own) return reply(sock, chatId, msg, `💍 Menciona o responde al usuario. Ejemplo: *${prefix}marry @usuario*`);
        const targetProfile = ensure(botData, target);
        if (ownProfile.partner) return reply(sock, chatId, msg, `💍 Ya estás ${spouseWord(ownProfile.genre)} con ${targetName(botData, ownProfile.partner)}.`);
        if (targetProfile.partner) return reply(sock, chatId, msg, '💍 Esa persona ya tiene pareja.');
        const pending = pendingMarriages.get(own);
        if (pending && pending.from === target && pending.expires > Date.now()) {
            const startedAt = Date.now(); const start = new Date(startedAt).toLocaleString('es-ES');
            ownProfile.partner = target; targetProfile.partner = own;
            ownProfile.history.push({ partner: target, start, startedAt, end: null });
            targetProfile.history.push({ partner: own, start, startedAt, end: null });
            pendingMarriages.delete(target); save();
            return reply(sock, chatId, msg, `💍 ¡Se han casado @${numberOf(own)} y @${numberOf(target)}!\n\nQue disfruten su nueva etapa.`, { mentions: [own, target] });
        }
        pendingMarriages.set(target, { from: own, expires: Date.now() + 30 * 60 * 1000 });
        const expirationTimer = setTimeout(() => { const current = pendingMarriages.get(target); if (current?.from === own) pendingMarriages.delete(target); }, 30 * 60 * 1000);
        expirationTimer.unref?.();
        return reply(sock, chatId, msg, `💌 @${numberOf(target)}, @${numberOf(own)} te propone matrimonio. Responde mencionándolo con *${prefix}marry* para aceptar.`, { mentions: [target, own] });
    }
    return reply(sock, chatId, msg, profileMenu(prefix));
}

async function showProfile(sock, chatId, msg, jid, profile, botData) {
    const economy = botData.economy?.[chatId]?.users?.[jid] || {};
    const partner = profile.partner ? `💍 ${spouseWord(profile.genre)} con *${targetName(botData, profile.partner)}*` : '💍 Sin pareja';
    const text = `👤 *PERFIL DE ${profile.name}*\n\n${profile.description ? `✍️ ${profile.description}\n\n` : ''}🎂 Cumpleaños: *${formatBirth(profile.birth)}*\n⚧️ Género: *${displayGenre(profile.genre)}*\n${partner}\n\n💰 Efectivo: *${Number(economy.coins || 0).toLocaleString()}*\n🏦 Banco: *${Number(economy.bank || 0).toLocaleString()}*\n📜 Matrimonios: *${profile.history.length}*`;
    try {
        const image = await sock.profilePictureUrl(jid, 'image');
        return sock.sendMessage(chatId, { image: { url: image }, caption: text, mentions: profile.partner ? [jid, profile.partner] : [jid] }, { quoted: msg });
    } catch { return sock.sendMessage(chatId, { text, mentions: profile.partner ? [jid, profile.partner] : [jid] }, { quoted: msg }); }
}

module.exports = profileCommand;
module.exports.aliases = profileAliases;
module.exports.menu = profileMenu;
