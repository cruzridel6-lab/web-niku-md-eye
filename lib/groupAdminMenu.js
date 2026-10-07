'use strict';

const { sendActionButtons } = require('./interactiveActions');

const CONTROL_DEFINITIONS = Object.freeze({
    antilink: {
        title: '🔗 Antienlace',
        status: data => data.antilinkGroups?.[data.__groupId]
            ? (data.antilinkGroups[data.__groupId] === 'del' ? 'ACTIVADO · solo borra enlaces' : 'ACTIVADO · borra y expulsa')
            : 'DESACTIVADO',
        actions: [['✅ Borrar y expulsar', 'antilink on'], ['🧹 Solo borrar', 'antilink del'], ['⛔ Desactivar', 'antilink off']]
    },
    antiventas: { title: '🛍️ Antiventas', state: data => Boolean(data.antiSalesGroups?.[data.__groupId]), command: 'antiventas' },
    antibot: { title: '🤖 Antibot', state: data => Boolean(data.antiBotGroups?.[data.__groupId]), command: 'antibot' },
    antiestafa: { title: '🛡️ Antiestafa', state: data => Boolean(data.antiScamGroups?.[data.__groupId]), command: 'estaf' },
    antiporno: { title: '🚫 Antiporno', state: data => Boolean(data.antiPornGroups?.[data.__groupId]), command: 'antiporno' },
    antistatus: { title: '📵 Anti-Status', state: data => Boolean(data.antiStatusGroups?.[data.__groupId]), command: 'antistatus' },
    antisticker: { title: '🧩 Antispam de stickers', state: data => Boolean(data.antiStickerGroups?.[data.__groupId]?.enabled), command: 'antiestiker' },
    antiprivado: { title: '🔒 Antiprivado en grupos', state: data => Boolean(data.antiPrivate?.groupEnabled), command: 'antiprivado', args: 'grupo ' },
    anticall: { title: '📵 AntiCall · todo el bot', state: data => Boolean(data.antiCall?.[data.__userId]), command: 'anticall', scope: 'Afecta a las llamadas de todo el bot, no solo a este grupo.' },
    modoestricto: { title: '🛡️ Modo estricto', state: data => Boolean(data.strictGroups?.[data.__groupId]), command: 'modoestricto' },
    onlyadmin: { title: '🔐 Solo administradores', state: data => Boolean(data.adminOnlyGroups?.[data.__groupId]), command: 'onlyadmin' },
    alertas: { title: '🔔 Alertas del grupo', state: data => Boolean(data.groupAlerts?.[data.__groupId]), command: 'alertas' },
    welcome: { title: '👋 Bienvenida automática', state: data => Boolean(data.groupWelcome?.[data.__groupId]), command: 'welcome' },
    bye: { title: '👋 Despedida automática', state: data => Boolean(data.groupBye?.[data.__groupId]), command: 'bye' }
});

const CONTROL_ALIASES = Object.freeze({ estaf: 'antiestafa', strictmode: 'modoestricto', antiestiker: 'antisticker' });

function commandButton(prefix, label, command) {
    return { label, command: `${prefix}${command}` };
}
function routeButton(prefix, label, route) {
    return commandButton(prefix, label, `groupmenu ${route}`);
}
function groupStatus(data, groupId, key) {
    const schedules = data.groupSchedules?.[groupId];
    if (key === 'horario') return !schedules ? 'SIN CONFIGURAR' : schedules.enabled === false ? 'DESACTIVADO' : 'ACTIVADO';
    return '';
}

function page(route, prefix) {
    switch (route) {
        case '':
        case 'inicio':
            return ['👥 ADMINISTRACIÓN DEL GRUPO\nElige qué quieres configurar:', [
                routeButton(prefix, '🛡️ Protecciones', 'protecciones'),
                routeButton(prefix, '⚙️ Ajustes del grupo', 'ajustes'),
                routeButton(prefix, '👤 Participantes', 'participantes')
            ]];
        case 'protecciones':
            return ['🛡️ PROTECCIONES\nElige un control para ver sus opciones:', [
                routeButton(prefix, '🔗 AntiLink', 'antilink'),
                routeButton(prefix, '🛍️ Antiventas', 'antiventas'),
                routeButton(prefix, '➡️ Más protecciones', 'protecciones2')
            ]];
        case 'protecciones2':
            return ['🛡️ MÁS PROTECCIONES', [
                routeButton(prefix, '🤖 Antibot', 'antibot'),
                routeButton(prefix, '🚫 Antiestafa', 'antiestafa'),
                routeButton(prefix, '➡️ Siguiente', 'protecciones3')
            ]];
        case 'protecciones3':
            return ['🛡️ PROTECCIÓN DE CONTENIDO', [
                routeButton(prefix, '🔞 Antiporno', 'antiporno'),
                routeButton(prefix, '📵 Anti-Status', 'antistatus'),
                routeButton(prefix, '➡️ Siguiente', 'protecciones4')
            ]];
        case 'protecciones4':
            return ['🛡️ MÁS CONTROLES', [
                routeButton(prefix, '🧩 Antistickers', 'antisticker'),
                routeButton(prefix, '🔒 Antiprivado', 'antiprivado'),
                routeButton(prefix, '➡️ Más', 'protecciones5')
            ]];
        case 'protecciones5':
            return ['🛡️ ÚLTIMOS CONTROLES', [
                routeButton(prefix, '⚠️ Modo estricto', 'modoestricto'),
                routeButton(prefix, '📵 AntiCall', 'anticall'),
                routeButton(prefix, '⬅️ Volver', 'protecciones4')
            ]];
        case 'ajustes':
            return ['⚙️ AJUSTES DEL GRUPO', [
                routeButton(prefix, '🔓 Abrir / cerrar', 'acceso'),
                routeButton(prefix, '👋 Bienvenida y avisos', 'mensajes'),
                routeButton(prefix, '🕒 Horario y datos', 'herramientas')
            ]];
        case 'acceso':
            return ['🔓 ACCESO DEL GRUPO\nLos botones ejecutan solo la acción elegida:', [
                commandButton(prefix, '🔓 Abrir grupo', 'open'),
                commandButton(prefix, '🔒 Cerrar grupo', 'close'),
                routeButton(prefix, '🔐 Solo administradores', 'onlyadmin')
            ]];
        case 'mensajes':
            return ['👋 MENSAJES Y AVISOS', [
                routeButton(prefix, '👋 Bienvenida', 'welcome'),
                routeButton(prefix, '🚪 Despedida', 'bye'),
                routeButton(prefix, '🔔 Alertas', 'alertas')
            ]];
        case 'herramientas':
            return ['🕒 HORARIO Y DATOS DEL GRUPO', [
                routeButton(prefix, '🕒 Horario automático', 'horario'),
                commandButton(prefix, 'ℹ️ Información del grupo', 'groupinfo'),
                routeButton(prefix, '✏️ Editar datos', 'datosgrupo')
            ]];
        case 'datosgrupo':
            return ['✏️ DATOS DEL GRUPO\nElige una acción; los datos nuevos se escriben manualmente:', [
                commandButton(prefix, '📝 Cambiar descripción', 'setdesc'),
                commandButton(prefix, '🖼️ Cambiar foto', 'setppgc'),
                routeButton(prefix, '🧪 Probar bienvenida', 'pruebas')
            ]];
        case 'pruebas':
            return ['🧪 PRUEBAS DE MENSAJES', [
                commandButton(prefix, '👋 Probar bienvenida', 'testwelcome'),
                commandButton(prefix, '🚪 Probar despedida', 'testbye'),
                routeButton(prefix, '✍️ Editar textos', 'textos')
            ]];
        case 'textos':
            return ['✍️ TEXTOS AUTOMÁTICOS\nEl bot responderá con las instrucciones para escribir el texto:', [
                commandButton(prefix, '✏️ Texto de bienvenida', 'setwelcome'),
                commandButton(prefix, '✏️ Texto de despedida', 'setbye'),
                routeButton(prefix, '🕒 Ver horario', 'horario')
            ]];
        case 'participantes':
            return ['👤 ADMINISTRACIÓN DE PARTICIPANTES', [
                routeButton(prefix, '🪪 Roles', 'roles'),
                routeButton(prefix, '🛡️ Moderación', 'moderacion'),
                routeButton(prefix, '📢 Avisos y consulta', 'avisos')
            ]];
        case 'roles':
            return ['🪪 ROLES Y PARTICIPACIÓN\nAl elegir una acción, el bot pedirá que menciones o respondas al usuario:', [
                commandButton(prefix, '➕ Agregar', 'add'),
                commandButton(prefix, '⬆️ Promover', 'promote'),
                commandButton(prefix, '⬇️ Degradar', 'demote')
            ]];
        case 'moderacion':
            return ['🛡️ MODERACIÓN\nPara acciones sobre una persona, menciona al usuario o responde a su mensaje:', [
                commandButton(prefix, '🚪 Expulsar usuario', 'kick'),
                commandButton(prefix, '⚠️ Advertir usuario', 'advertir'),
                routeButton(prefix, '🔇 Silenciar usuario', 'silenciar')
            ]];
        case 'silenciar':
            return ['🔇 SILENCIAR\nPara silenciar a una persona escribe .mute @usuario o responde a su mensaje. Los botones de abajo solo abren o cierran el grupo.', [
                commandButton(prefix, '🔒 Cerrar grupo', 'mute grupo'),
                commandButton(prefix, '🔓 Abrir grupo', 'unmute grupo'),
                commandButton(prefix, '📋 Ver silenciados', 'mutelist')
            ]];
        case 'quitar_silencio':
            return ['🔊 QUITAR SILENCIO\nEscribe .unmute @usuario o responde al mensaje. No se ejecuta sin un usuario para evitar abrir el grupo por accidente.', [
                commandButton(prefix, '📋 Ver silenciados', 'mutelist'),
                routeButton(prefix, '⬅️ Moderación', 'moderacion'),
                routeButton(prefix, '🏠 Panel', '')
            ]];
        case 'avisos':
            return ['📢 AVISOS Y CONSULTAS', [
                commandButton(prefix, '📋 Ver advertencias', 'advertencias'),
                commandButton(prefix, '🧹 Quitar advertencia', 'quitaradvertencia'),
                routeButton(prefix, '➡️ Más acciones', 'avisos2')
            ]];
        case 'avisos2':
            return ['📢 MÁS AVISOS Y ENLACES', [
                routeButton(prefix, '📣 Avisos al grupo', 'etiquetas'),
                routeButton(prefix, '🔗 Enlaces del grupo', 'enlaces'),
                routeButton(prefix, '⬅️ Participantes', 'participantes')
            ]];
        case 'enlaces':
            return ['🔗 ENLACES E INFORMACIÓN', [
                commandButton(prefix, '🔗 Ver enlace', 'grouplink'),
                commandButton(prefix, '♻️ Renovar enlace', 'revoke'),
                commandButton(prefix, 'ℹ️ Información', 'groupinfo')
            ]];
        case 'etiquetas':
            return ['📣 AVISOS A PARTICIPANTES\nElige el comando y después escribe el mensaje que quieras enviar. No se menciona a nadie sin un texto explícito.', [
                commandButton(prefix, '📣 Etiquetar a todos', 'tagall'),
                commandButton(prefix, '🙈 Aviso silencioso', 'hidetag'),
                routeButton(prefix, '⬅️ Participantes', 'participantes')
            ]];
        default:
            return null;
    }
}

function controlStatus(route, definition, botData, groupId, userId) {
    if (route === 'horario') return groupStatus(botData, groupId, 'horario');
    const view = { ...botData, __groupId: groupId, __userId: userId };
    if (definition.status) return definition.status(view);
    return definition.state(view) ? 'ACTIVADO' : 'DESACTIVADO';
}

async function sendGroupAdminMenu(sock, groupId, msg, input = '', botData = {}, prefix = '.', isAdmin = true, userId = '') {
    if (!String(groupId || '').endsWith('@g.us')) {
        return sock.sendMessage(groupId, { text: '❌ Este panel solo funciona dentro de un grupo.' }, { quoted: msg });
    }
    if (!isAdmin) {
        return sock.sendMessage(groupId, { text: '❌ Solo los administradores del grupo pueden abrir este panel.' }, { quoted: msg });
    }
    const route = String(input || '').trim().toLowerCase().split(/\s+/)[0];
    let definition = CONTROL_DEFINITIONS[route] || CONTROL_DEFINITIONS[CONTROL_ALIASES[route]];
    if (route === 'horario') {
        definition = {
            title: '🕒 Horario automático',
            status: data => groupStatus(data, groupId, 'horario'),
            actions: [['▶️ Activar horario', 'horario on'], ['⏸️ Desactivar horario', 'horario off'], ['ℹ️ Ver instrucciones', 'horario ver']]
        };
    }
    if (definition) {
        const status = controlStatus(route, definition, botData, groupId, userId);
        const buttons = (definition.actions || [
            [`✅ Activar ${definition.title.replace(/^\S+\s*/, '')}`, `${definition.command} ${definition.args || ''}on`],
            [`⛔ Desactivar`, `${definition.command} ${definition.args || ''}off`]
        ]).map(([label, command]) => commandButton(prefix, label, command));
        const scope = definition.scope ? `\n${definition.scope}` : '';
        return sendActionButtons(sock, groupId, `${definition.title}\nEstado actual: *${status}*${scope}\nElige una acción:`, buttons, msg);
    }
    const result = page(route, prefix);
    if (!result) return sendActionButtons(sock, groupId, '👥 Panel de administración del grupo:', [routeButton(prefix, '🏠 Abrir panel', '')], msg);
    let [body, buttons] = result;
    return sendActionButtons(sock, groupId, body, buttons, msg);
}

module.exports = { sendGroupAdminMenu, CONTROL_DEFINITIONS };
