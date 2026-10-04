function validTime(value) {
    const match = String(value || '').trim().match(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
    return match ? match[0] : null;
}

function validTimeZone(value) {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
        return String(value);
    } catch (_) {
        return null;
    }
}

function describe(schedule) {
    if (!schedule) return '⏰ No hay un horario automático configurado.';
    const state = schedule.enabled === false ? 'desactivado' : 'activo';
    return `⏰ *Horario automático: ${state}*\n\n` +
        `🔓 Apertura: *${schedule.openAt || 'no configurada'}*\n` +
        `🔒 Cierre: *${schedule.closeAt || 'no configurado'}*\n` +
        `🌐 Zona horaria: *${schedule.timeZone || 'America/New_York'}*\n\n` +
        'Usa *.horario abrir HH:MM*, *.horario cerrar HH:MM*, *.horario zona Area/City* o *.horario off*.';
}

module.exports = async function groupScheduleCommand(sock, chatId, msg, isAdmin, botData, saveBotData, args = [], sessionId) {
    if (!chatId.endsWith('@g.us')) return sock.sendMessage(chatId, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: msg });
    if (!isAdmin) return sock.sendMessage(chatId, { text: '❌ Solo los administradores pueden configurar el horario del grupo.' }, { quoted: msg });

    botData.groupSchedules ||= {};
    const current = botData.groupSchedules[chatId] || {
        openAt: null,
        closeAt: null,
        timeZone: process.env.GROUP_SCHEDULE_TIMEZONE || 'America/New_York',
        enabled: true,
        lastOpenKey: null,
        lastCloseKey: null,
        sessionId: sessionId || null
    };
    if (sessionId) current.sessionId = sessionId;

    const action = String(args[0] || '').toLowerCase();
    const value = String(args[1] || '').trim();
    if (!action || ['ver', 'status', 'estado'].includes(action)) {
        return sock.sendMessage(chatId, { text: describe(current) }, { quoted: msg });
    }
    if (['off', 'apagar', 'desactivar', 'disable'].includes(action)) {
        current.enabled = false;
        botData.groupSchedules[chatId] = current;
        saveBotData();
        return sock.sendMessage(chatId, { text: '⏸️ Horario automático desactivado. Puedes reactivarlo con *.horario on*.' }, { quoted: msg });
    }
    if (['on', 'activar', 'enable'].includes(action)) {
        current.enabled = true;
        botData.groupSchedules[chatId] = current;
        saveBotData();
        return sock.sendMessage(chatId, { text: '▶️ Horario automático activado.' }, { quoted: msg });
    }
    if (['limpiar', 'clear', 'reset'].includes(action)) {
        delete botData.groupSchedules[chatId];
        saveBotData();
        return sock.sendMessage(chatId, { text: '🗑️ Horario automático eliminado.' }, { quoted: msg });
    }
    if (['abrir', 'open'].includes(action)) {
        const time = validTime(value);
        if (!time) return sock.sendMessage(chatId, { text: '❌ Hora inválida. Usa el formato de 24 horas, por ejemplo: *.horario abrir 08:00*.' }, { quoted: msg });
        current.openAt = time;
    } else if (['cerrar', 'close'].includes(action)) {
        const time = validTime(value);
        if (!time) return sock.sendMessage(chatId, { text: '❌ Hora inválida. Usa el formato de 24 horas, por ejemplo: *.horario cerrar 22:00*.' }, { quoted: msg });
        current.closeAt = time;
    } else if (['zona', 'zona horaria', 'timezone', 'tz'].includes(action)) {
        const zone = validTimeZone(value);
        if (!zone) return sock.sendMessage(chatId, { text: '❌ Zona horaria inválida. Ejemplo: *.horario zona America/New_York*.' }, { quoted: msg });
        current.timeZone = zone;
    } else {
        return sock.sendMessage(chatId, { text: '⏰ Uso:\n*.horario abrir 08:00*\n*.horario cerrar 22:00*\n*.horario zona America/New_York*\n*.horario ver*\n*.horario on/off*' }, { quoted: msg });
    }

    current.enabled = true;
    botData.groupSchedules[chatId] = current;
    saveBotData();
    return sock.sendMessage(chatId, { text: `✅ Configuración guardada.\n\n${describe(current)}` }, { quoted: msg });
};

module.exports.validTime = validTime;
module.exports.validTimeZone = validTimeZone;
