const test = require('node:test');
const assert = require('node:assert/strict');
const profileCommand = require('../commands/profile');
const { parseCommandInput } = require('../lib/commandParser');

function harness() {
    const botData = { profiles: {}, phoneAliases: {}, pendingMarriages: {} };
    const messages = [];
    const relayed = [];
    const sock = {
        user: { id: '15550000000:1@s.whatsapp.net' },
        sendMessage: async (_chatId, payload) => {
            messages.push(payload);
            return { key: { id: String(messages.length) } };
        },
        relayMessage: async (_chatId, payload) => { relayed.push(payload); return { status: 200 }; }
    };
    return { botData, messages, relayed, sock };
}

function message(participant, extras = {}, contextInfo = {}) {
    return {
        key: { participant, ...extras },
        message: { extendedTextMessage: { contextInfo } },
        pushName: 'Aventurero'
    };
}

function buttonIds(ctx) {
    return ctx.relayed.flatMap(payload => payload.interactiveMessage?.nativeFlowMessage?.buttons || [])
        .map(button => JSON.parse(button.buttonParamsJson).id);
}

test('el registro se completa escribiendo el nombre y no muestra botones de alta', async () => {
    const ctx = harness();
    const player = '15550000099@s.whatsapp.net';
    const parsed = parseCommandInput('.registrarse Carlos', '.');
    await profileCommand(ctx.sock, 'grupo@g.us', message(player), parsed.commandName, parsed.q, ctx.botData, () => {}, '.');

    assert.equal(ctx.botData.profiles[player].name, 'Carlos');
    assert.equal(ctx.botData.profiles[player].registered, true);
    assert.match(ctx.messages.at(-1).text, /registro completado/i);
    const progressEdits = ctx.messages.filter(payload => payload.edit);
    assert.ok(progressEdits.length >= 3, 'la animación muestra progreso antes de terminar');
    assert.ok(progressEdits.every(payload => payload.edit.id === '1'), 'la animación actualiza la misma burbuja');
    assert.deepEqual(buttonIds(ctx), []);
});

test('acepta una solicitud de matrimonio normal y elimina la invitación pendiente', async () => {
    const ctx = harness();
    const proposer = '15550000001@s.whatsapp.net';
    const recipient = '15550000002@s.whatsapp.net';

    await profileCommand(ctx.sock, 'grupo@g.us', message(proposer, {}, { mentionedJid: [recipient] }), 'marry', '', ctx.botData, () => {}, '.');
    assert.deepEqual(buttonIds(ctx), ['cmd_marry aceptar', 'cmd_marry rechazar']);
    await profileCommand(ctx.sock, 'grupo@g.us', message(recipient), 'marry', 'aceptar', ctx.botData, () => {}, '.');

    assert.equal(ctx.botData.profiles[proposer].partner, recipient);
    assert.equal(ctx.botData.profiles[recipient].partner, proposer);
    assert.equal(Object.keys(ctx.botData.pendingMarriages).length, 0);
    assert.match(ctx.messages.at(-1).text, /se han casado/i);
});

test('los botones de aceptar y rechazar resuelven correctamente la propuesta', async () => {
    const ctx = harness();
    const proposer = '15550000021@s.whatsapp.net';
    const recipient = '15550000022@s.whatsapp.net';

    await profileCommand(ctx.sock, 'grupo@g.us', message(proposer, {}, { mentionedJid: [recipient] }), 'marry', '', ctx.botData, () => {}, '.');
    await profileCommand(ctx.sock, 'grupo@g.us', message(recipient), 'marry', 'aceptar', ctx.botData, () => {}, '.');
    assert.equal(ctx.botData.profiles[recipient].partner, proposer);
    assert.equal(Object.keys(ctx.botData.pendingMarriages).length, 0);

    const rejectCtx = harness();
    const rejectProposer = '15550000031@s.whatsapp.net';
    const rejectRecipient = '15550000032@s.whatsapp.net';
    await profileCommand(rejectCtx.sock, 'grupo@g.us', message(rejectProposer, {}, { mentionedJid: [rejectRecipient] }), 'marry', '', rejectCtx.botData, () => {}, '.');
    await profileCommand(rejectCtx.sock, 'grupo@g.us', message(rejectRecipient), 'marry', 'rechazar', rejectCtx.botData, () => {}, '.');
    assert.equal(rejectCtx.botData.profiles[rejectRecipient].partner, null);
    assert.equal(Object.keys(rejectCtx.botData.pendingMarriages).length, 0);
    assert.match(rejectCtx.messages.at(-1).text, /rechazó la propuesta/i);
});

test('acepta una solicitud cuando WhatsApp entrega al destinatario como LID y también incluye su teléfono', async () => {
    const ctx = harness();
    const proposerPhone = '15550000011@s.whatsapp.net';
    const proposerLid = '9000011@lid';
    const recipientPhone = '15550000012@s.whatsapp.net';
    const recipientLid = '9000012@lid';

    await profileCommand(
        ctx.sock,
        'grupo@g.us',
        message(proposerLid, { participantAlt: proposerPhone }, { mentionedJid: [recipientLid] }),
        'marry',
        '',
        ctx.botData,
        () => {},
        '.'
    );
    assert.ok(ctx.botData.pendingMarriages[recipientLid], 'la solicitud debe quedar asociada al LID mencionado');

    await profileCommand(
        ctx.sock,
        'grupo@g.us',
        message(recipientLid, { participantAlt: recipientPhone }, { participant: proposerLid }),
        'marry',
        'aceptar',
        ctx.botData,
        () => {},
        '.'
    );

    assert.equal(ctx.botData.profiles[proposerPhone].partner, recipientPhone);
    assert.equal(ctx.botData.profiles[recipientPhone].partner, proposerPhone);
    assert.equal(Object.keys(ctx.botData.pendingMarriages).length, 0);
    assert.equal(ctx.botData.profiles[recipientLid], undefined, 'no debe dejar un perfil fantasma bajo el LID');
    assert.match(ctx.messages.at(-1).text, /se han casado/i);
});

test('mostrar una propuesta pendiente no la acepta sin una acción explícita', async () => {
    const ctx = harness();
    const proposer = '15550000041@s.whatsapp.net';
    const recipient = '15550000042@s.whatsapp.net';

    await profileCommand(ctx.sock, 'grupo@g.us', message(proposer, {}, { mentionedJid: [recipient] }), 'marry', '', ctx.botData, () => {}, '.');
    await profileCommand(ctx.sock, 'grupo@g.us', message(recipient), 'marry', '', ctx.botData, () => {}, '.');

    assert.equal(ctx.botData.profiles[recipient].partner, null);
    assert.deepEqual(buttonIds(ctx).slice(-2), ['cmd_marry aceptar', 'cmd_marry rechazar']);
    assert.match(ctx.messages.at(-1).text, /propuesta pendiente/i);
});

test('el divorcio exige confirmación y cancelar conserva el matrimonio', async () => {
    const ctx = harness();
    const one = '15550000051@s.whatsapp.net';
    const two = '15550000052@s.whatsapp.net';
    ctx.botData.profiles[one] = { name: 'Aventurero', registered: true, genre: 'hombre', partner: two, history: [{ partner: two, startedAt: Date.now(), start: 'hoy', end: null }] };
    ctx.botData.profiles[two] = { name: 'Aventurera', registered: true, genre: 'mujer', partner: one, history: [{ partner: one, startedAt: Date.now(), start: 'hoy', end: null }] };

    await profileCommand(ctx.sock, 'grupo@g.us', message(one), 'divorce', '', ctx.botData, () => {}, '.');
    assert.equal(ctx.botData.profiles[one].partner, two);
    assert.deepEqual(buttonIds(ctx).slice(-2), ['cmd_divorce confirmar', 'cmd_divorce cancelar']);
    await profileCommand(ctx.sock, 'grupo@g.us', message(one), 'divorce', 'cancelar', ctx.botData, () => {}, '.');
    assert.equal(ctx.botData.profiles[one].partner, two);
    await profileCommand(ctx.sock, 'grupo@g.us', message(one), 'divorce', 'confirmar', ctx.botData, () => {}, '.');
    assert.equal(ctx.botData.profiles[one].partner, null);
    assert.equal(ctx.botData.profiles[two].partner, null);
    assert.ok(ctx.botData.profiles[one].history[0].end);
});

test('el género ofrece botones y una biografía vacía no borra el texto anterior', async () => {
    const ctx = harness();
    const player = '15550000061@s.whatsapp.net';
    ctx.botData.profiles[player] = { name: 'Aventurero', registered: true, genre: '', description: 'Una historia de prueba', history: [] };

    await profileCommand(ctx.sock, 'grupo@g.us', message(player), 'setgenre', '', ctx.botData, () => {}, '.');
    assert.deepEqual(buttonIds(ctx).slice(-3), ['cmd_setgenero hombre', 'cmd_setgenero mujer', 'cmd_setgenero otro']);
    await profileCommand(ctx.sock, 'grupo@g.us', message(player), 'setbio', '', ctx.botData, () => {}, '.');
    assert.equal(ctx.botData.profiles[player].description, 'Una historia de prueba');
    await profileCommand(ctx.sock, 'grupo@g.us', message(player), 'setbio', 'borrar', ctx.botData, () => {}, '.');
    assert.equal(ctx.botData.profiles[player].description, '');
});
