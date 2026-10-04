'use strict';

function normalizeJid(value) {
    return String(value || '').split(':')[0].trim();
}
function numberOf(value) {
    return normalizeJid(value).split('@')[0].replace(/\D/g, '');
}
function targetFromMessage(msg, args = []) {
    const context = msg?.message?.extendedTextMessage?.contextInfo || {};
    const target = context.participant || context.mentionedJid?.[0] || context.quotedMessage?.key?.participant;
    if (target) return normalizeJid(target);
    const number = String(args[0] || '').replace(/\D/g, '');
    return number.length >= 7 ? `${number}@s.whatsapp.net` : null;
}
function displayTarget(jid) { return numberOf(jid) ? `@${numberOf(jid)}` : 'ese usuario'; }

async function warnCommand(sock, from, msg, isAdmin, botData, saveBotData, args = []) {
    if (!from.endsWith('@g.us')) return sock.sendMessage(from, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: msg });
    if (!isAdmin) return sock.sendMessage(from, { text: '❌ Solo los administradores pueden usar las advertencias.' }, { quoted: msg });

    botData.groupWarnings ||= {};
    botData.groupWarnings[from] ||= {};
    const action = String(args[0] || '').toLowerCase();
    if (['lista', 'list', 'ver'].includes(action)) {
        const rows = Object.entries(botData.groupWarnings[from]).filter(([, data]) => Number(data?.count) > 0);
        const text = rows.length ? `⚠️ *ADVERTENCIAS DEL GRUPO*\n\n${rows.map(([jid, data]) => `• ${displayTarget(jid)}: *${Number(data.count)}/3*`).join('\n')}` : '✅ No hay advertencias activas en este grupo.';
        return sock.sendMessage(from, { text, mentions: rows.map(([jid]) => jid) }, { quoted: msg });
    }
    if (['quitar', 'remove', 'clear'].includes(action)) {
        const target = targetFromMessage(msg, args.slice(1));
        if (!target) return sock.sendMessage(from, { text: 'ℹ️ Uso: .advertir quitar @usuario o responde a su mensaje.' }, { quoted: msg });
        delete botData.groupWarnings[from][target];
        saveBotData();
        return sock.sendMessage(from, { text: `✅ Se eliminaron las advertencias de ${displayTarget(target)}.`, mentions: [target] }, { quoted: msg });
    }

    const target = targetFromMessage(msg, args);
    if (!target) return sock.sendMessage(from, { text: 'ℹ️ Uso: .advertir @usuario motivo\nTambién puedes responder al mensaje del usuario.' }, { quoted: msg });
    const metadata = await sock.groupMetadata(from).catch(() => null);
    const participant = metadata?.participants?.find(item => normalizeJid(item.id) === target || normalizeJid(item.jid) === target);
    const botJid = normalizeJid(sock.user?.id);
    if (participant?.admin || target === botJid || (numberOf(target) && numberOf(target) === numberOf(botJid))) return sock.sendMessage(from, { text: '❌ Los administradores y el bot están protegidos de las advertencias.' }, { quoted: msg });
    if (!participant) return sock.sendMessage(from, { text: '❌ Ese usuario no pertenece al grupo.' }, { quoted: msg });

    const entry = botData.groupWarnings[from][target] ||= { count: 0, history: [] };
    entry.count = Math.min(3, Number(entry.count) + 1);
    entry.history ||= [];
    entry.history.push({ reason: String(args.slice(contextTargetPresent(msg) ? 0 : 1).join(' ') || 'Sin motivo').slice(0, 180), createdAt: new Date().toISOString() });
    entry.history = entry.history.slice(-10);
    const reason = String(args.slice(1).join(' ') || 'Incumplimiento de las normas').slice(0, 180);
    saveBotData();

    if (entry.count >= 3) {
        try {
            await sock.groupParticipantsUpdate(from, [target], 'remove');
            delete botData.groupWarnings[from][target];
            saveBotData();
            return sock.sendMessage(from, { text: `🚫 ${displayTarget(target)} recibió su advertencia *3/3* y fue expulsado del grupo.\n📝 Motivo: ${reason}`, mentions: [target] }, { quoted: msg });
        } catch (error) {
            return sock.sendMessage(from, { text: `⚠️ ${displayTarget(target)} llegó a *3/3*, pero no pude expulsarlo. Verifica que el bot sea administrador.`, mentions: [target] }, { quoted: msg });
        }
    }
    return sock.sendMessage(from, { text: `⚠️ *ADVERTENCIA ${entry.count}/3*\n\n${displayTarget(target)}, respeta las normas del grupo.\n📝 Motivo: ${reason}\n\nAl llegar a 3 advertencias serás expulsado.`, mentions: [target] }, { quoted: msg });
}
function contextTargetPresent(msg) {
    const context = msg?.message?.extendedTextMessage?.contextInfo || {};
    return Boolean(context.participant || context.mentionedJid?.length || context.quotedMessage);
}
module.exports = warnCommand;
