const DEFAULT_MESSAGE = `📢 *NIKU MD — Canal oficial*\n\nÚnete al canal oficial de WhatsApp para recibir novedades, actualizaciones y avisos del bot:\n\n🔗 https://whatsapp.com/channel/0029Vb5s0hbADTO8E0xtQI1l\n\n✨ NIKU MD • Comunidad oficial`;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function botIsAdmin(metadata, botJid) {
    const normalize = value => String(value || '').split(':')[0].split('@')[0].replace(/\D/g, '');
    const normalized = normalize(botJid);
    const participant = metadata?.participants?.find(item => normalize(item.id) === normalized);
    return Boolean(participant?.admin === 'admin' || participant?.admin === 'superadmin');
}

async function runPromotion(sock, state = {}) {
    if (state.running) throw new Error('Ya hay una promoción en curso.');
    if (Date.now() - (state.lastRun || 0) < 15 * 60 * 1000) {
        const minutes = Math.ceil((15 * 60 * 1000 - (Date.now() - state.lastRun)) / 60000);
        throw new Error(`La promoción ya fue ejecutada recientemente. Intenta de nuevo en ${minutes} minuto(s).`);
    }

    state.running = true;
    state.lastRun = Date.now();
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    try {
        const groups = typeof sock.groupFetchAllParticipating === 'function'
            ? await sock.groupFetchAllParticipating()
            : {};
        const entries = Object.entries(groups || {});
        const botJid = sock.user?.id || '';
        for (const [jid, group] of entries) {
            try {
                const metadata = group?.participants ? group : await sock.groupMetadata(jid);
                const writable = !metadata?.announce || botIsAdmin(metadata, botJid);
                if (!writable) { skipped++; continue; }
                await sock.sendMessage(jid, { text: DEFAULT_MESSAGE });
                sent++;
                await sleep(1200);
            } catch (error) {
                failed++;
            }
        }
        return { sent, skipped, failed, total: entries.length };
    } finally {
        state.running = false;
    }
}

module.exports = async function promoNikuMd(sock, from, msg, isOwner, state = {}) {
    const reply = text => sock.sendMessage(from, { text }, { quoted: msg });
    if (!isOwner) return reply('🔒 Este comando está reservado para el propietario del bot.');
    try {
        const result = await runPromotion(sock, state);
        return reply(`✅ *Promoción completada*\n\n📨 Enviada: ${result.sent}\n⏭️ Omitidos por permisos: ${result.skipped}\n❌ Fallidos: ${result.failed}\n👥 Grupos revisados: ${result.total}`);
    } catch (error) {
        return reply(`⚠️ ${error.message}`);
    }
};

module.exports.DEFAULT_MESSAGE = DEFAULT_MESSAGE;
module.exports.botIsAdmin = botIsAdmin;
module.exports.runPromotion = runPromotion;
