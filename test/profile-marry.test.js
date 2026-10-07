const test = require('node:test');
const assert = require('node:assert/strict');
const profileCommand = require('../commands/profile');

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

test('acepta una solicitud de matrimonio normal y elimina la invitación pendiente', async () => {
    const ctx = harness();
    const proposer = '15550000001@s.whatsapp.net';
    const recipient = '15550000002@s.whatsapp.net';

    await profileCommand(ctx.sock, 'grupo@g.us', message(proposer, {}, { mentionedJid: [recipient] }), 'marry', '', ctx.botData, () => {}, '.');
    assert.deepEqual(buttonIds(ctx), ['cmd_marry aceptar', 'cmd_marry rechazar']);
    await profileCommand(ctx.sock, 'grupo@g.us', message(recipient), 'marry', '', ctx.botData, () => {}, '.');

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
        '',
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
