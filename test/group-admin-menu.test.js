const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeActionCommand, parseCommandInput } = require('../lib/commandParser');
const { sendGroupAdminMenu, CONTROL_DEFINITIONS } = require('../lib/groupAdminMenu');

const GROUP = 'admin-menu-tests@g.us';
const SESSION = 'admin-session-1';
const BOT = '15550000000:1@s.whatsapp.net';
const MENU_ROUTES = [
    '', 'protecciones', 'protecciones2', 'protecciones3', 'protecciones4', 'protecciones5',
    'ajustes', 'acceso', 'mensajes', 'herramientas', 'datosgrupo', 'pruebas', 'textos',
    'participantes', 'roles', 'moderacion', 'silenciar', 'quitar_silencio', 'avisos', 'avisos2',
    'enlaces', 'etiquetas', ...Object.keys(CONTROL_DEFINITIONS), 'horario'
];

function context() {
    const sent = [];
    const relayed = [];
    const botData = {};
    let saves = 0;
    const sock = {
        user: { id: BOT },
        sendMessage: async (_jid, payload) => { sent.push(payload); return { key: { id: String(sent.length) } }; },
        relayMessage: async (jid, message, options) => { relayed.push({ jid, message, options }); return { status: 200 }; }
    };
    const msg = { key: { remoteJid: GROUP, participant: '15550000001@s.whatsapp.net' } };
    return { sent, relayed, botData, sock, msg, save: () => { saves += 1; }, get saves() { return saves; } };
}

function buttonCommands(ctx) {
    const buttons = ctx.relayed[0]?.message?.interactiveMessage?.nativeFlowMessage?.buttons || [];
    return buttons.map(button => JSON.parse(button.buttonParamsJson).id);
}

test('adminmenu y cada botón interno usan el prefijo, llegan a un case real y pasan el gate administrativo', async () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
    const dispatchCases = new Set([...source.matchAll(/\bcase\s+'([^']+)'\s*:/g)].map(match => match[1]));
    const gateBlock = source.match(/const adminCommands = new Set\(\[([\s\S]*?)\]\);/)?.[1];
    assert.ok(gateBlock, 'debe existir la lista de comandos exentos del requisito de perfil RPG');
    const adminAllowed = new Set([...gateBlock.matchAll(/'([^']+)'/g)].map(match => match[1]));
    assert.match(source, /case 'groupmenu': await sendGroupAdminMenu\(this\.sock, from, msg, q, botData, commandPrefix, isAdmin, this\.userId\)/);
    assert.match(source, /case 'admin': case 'adminmenu': await sendGroupAdminMenu\(this\.sock, from, msg, q, botData, commandPrefix, isAdmin, this\.userId\)/);

    for (const route of MENU_ROUTES) {
        const ctx = context();
        await sendGroupAdminMenu(ctx.sock, GROUP, ctx.msg, route, ctx.botData, '!', true, SESSION);
        assert.equal(ctx.relayed.length, 1, `${route || 'inicio'}: debe responder con una sola pantalla`);
        const actions = buttonCommands(ctx);
        assert.ok(actions.length > 0 && actions.length <= 3, `${route || 'inicio'}: debe respetar el límite de botones`);
        for (const id of actions) {
            const actionText = normalizeActionCommand(id, '!');
            const parsed = parseCommandInput(actionText, '!');
            assert.ok(parsed, `${id}: el ID se debe convertir en comando`);
            assert.ok(dispatchCases.has(parsed.commandName), `${id}: falta case '${parsed.commandName}' en index.js`);
            assert.ok(adminAllowed.has(parsed.commandName), `${id}: falta '${parsed.commandName}' en la excepción administrativa`);
        }
    }

    const customPrefix = context();
    await sendGroupAdminMenu(customPrefix.sock, GROUP, customPrefix.msg, 'silenciar', customPrefix.botData, '!', true, SESSION);
    assert.match(customPrefix.relayed[0].message.interactiveMessage.body.text, /!mute @usuario/);
    await sendGroupAdminMenu(customPrefix.sock, GROUP, customPrefix.msg, 'quitar_silencio', customPrefix.botData, '!', true, SESSION);
    assert.match(customPrefix.relayed[1].message.interactiveMessage.body.text, /!unmute @usuario/);
});

const ACTION_HANDLERS = {
    antilink: require('../commands/antilink'),
    antiventas: require('../commands/antisales'),
    antibot: require('../commands/antibot'),
    estaf: require('../commands/estaf'),
    antiporno: require('../commands/antiporn'),
    antistatus: require('../commands/antistatus'),
    antiestiker: require('../commands/antisticker'),
    antiprivado: require('../commands/antiprivado'),
    anticall: require('../commands/anticall'),
    modoestricto: require('../commands/strictmode'),
    onlyadmin: require('../commands/onlyadmin'),
    alertas: require('../commands/alertas'),
    welcome: require('../commands/welcome'),
    bye: require('../commands/bye'),
    horario: require('../commands/groupschedule')
};

async function runAction(ctx, command, prefix = '.') {
    const parsed = parseCommandInput(`${prefix}${command}`, prefix);
    const handler = ACTION_HANDLERS[parsed.commandName];
    assert.equal(typeof handler, 'function', `${parsed.commandName} debe resolver a un handler real`);
    const common = [ctx.sock, GROUP, ctx.msg, true, ctx.botData, ctx.save];
    if (parsed.commandName === 'anticall') return handler(...common, SESSION, parsed.args.slice(1));
    if (parsed.commandName === 'horario') return handler(...common, parsed.args.slice(1), SESSION);
    return handler(...common, parsed.args.slice(1));
}

async function assertControlStatus(ctx, route, expected) {
    ctx.relayed.length = 0;
    await sendGroupAdminMenu(ctx.sock, GROUP, ctx.msg, route, ctx.botData, '.', true, SESSION);
    const text = ctx.relayed[0]?.message?.interactiveMessage?.body?.text || '';
    assert.match(text, new RegExp(`Estado actual: \\*${expected}`), `${route}: el panel debe mostrar el estado ${expected}`);
}

test('todos los controles de protección y ajustes activan, guardan y desactivan su estado real', async () => {
    for (const [route, definition] of Object.entries(CONTROL_DEFINITIONS)) {
        const ctx = context();
        const on = definition.actions?.find(([, command]) => /\bon$/.test(command))?.[1] || `${definition.command} ${definition.args || ''}on`;
        const off = definition.actions?.find(([, command]) => /\boff$/.test(command))?.[1] || `${definition.command} ${definition.args || ''}off`;
        assert.ok(on && off, `${route}: debe ofrecer acciones on y off`);

        await runAction(ctx, on);
        assert.ok(ctx.saves > 0, `${route}: activar debe persistir el estado`);
        await assertControlStatus(ctx, route, 'ACTIVADO');

        await runAction(ctx, off);
        assert.ok(ctx.saves > 1, `${route}: desactivar debe persistir el estado`);
        await assertControlStatus(ctx, route, 'DESACTIVADO');
    }

    const schedule = context();
    await runAction(schedule, 'horario on');
    assert.equal(schedule.botData.groupSchedules[GROUP].enabled, true);
    await assertControlStatus(schedule, 'horario', 'ACTIVADO');
    await runAction(schedule, 'horario off');
    assert.equal(schedule.botData.groupSchedules[GROUP].enabled, false);
    await assertControlStatus(schedule, 'horario', 'DESACTIVADO');
});

test('acciones que requieren datos muestran cómo continuar y no mutan valores vacíos', async () => {
    const ctx = context();
    const setDesc = require('../commands/setdesc');
    const setPhoto = require('../commands/setppgc');
    const setWelcome = require('../commands/setwelcome');
    const setBye = require('../commands/setbye');

    await setDesc(ctx.sock, GROUP, ctx.msg, true, '', '!');
    assert.match(ctx.sent.at(-1).text, /!setdesc <descripción>/);
    await setPhoto(ctx.sock, GROUP, ctx.msg, true, '!');
    assert.match(ctx.sent.at(-1).text, /!setppgc/);
    await setWelcome(ctx.sock, GROUP, ctx.msg, true, ctx.botData, ctx.save, [], '!');
    assert.match(ctx.sent.at(-1).text, /!setwelcome/);
    await setBye(ctx.sock, GROUP, ctx.msg, true, ctx.botData, ctx.save, [], '!');
    assert.match(ctx.sent.at(-1).text, /!setbye/);
    assert.deepEqual(ctx.botData.groupWelcomeText || {}, {});
    assert.deepEqual(ctx.botData.groupByeText || {}, {});
});
