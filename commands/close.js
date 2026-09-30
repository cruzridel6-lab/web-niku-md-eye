const timers = new Map();

module.exports = async function closeCommand(sock, chatId, msg, isAdmin, q = '') {
    if (!chatId.endsWith('@g.us')) return sock.sendMessage(chatId, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: msg });
    if (!isAdmin) return sock.sendMessage(chatId, { text: '❌ Solo los administradores pueden cerrar el grupo.' }, { quoted: msg });
    const match = String(q).trim().match(/^(\d+)(s|m|h)$/i);
    try {
        if (!match) {
            await sock.groupSettingUpdate(chatId, 'announcement');
            return sock.sendMessage(chatId, { text: '🔒 El grupo está cerrado. Solo los administradores pueden enviar mensajes.' }, { quoted: msg });
        }
        const value = Number(match[1]);
        const unit = match[2].toLowerCase();
        const delay = value * (unit === 's' ? 1000 : unit === 'm' ? 60000 : 3600000);
        if (timers.has(chatId)) clearTimeout(timers.get(chatId));
        const timer = setTimeout(async () => {
            try {
                await sock.groupSettingUpdate(chatId, 'announcement');
                await sock.sendMessage(chatId, { text: '🔒 El temporizador terminó. El grupo está cerrado.' });
            } catch (error) { console.error('Error cerrando grupo:', error.message); }
            timers.delete(chatId);
        }, delay);
        timer.unref?.();
        timers.set(chatId, timer);
        return sock.sendMessage(chatId, { text: `⏱️ El grupo se cerrará automáticamente en *${value}${unit}*.` }, { quoted: msg });
    } catch (error) {
        return sock.sendMessage(chatId, { text: '❌ No pude cerrar el grupo. Verifica que el bot sea administrador.' }, { quoted: msg });
    }
};
