const test = require('node:test');
const assert = require('node:assert/strict');
const profileCommand = require('../commands/profile');

function harness() {
    const botData = { profiles: {}, phoneAliases: {}, pendingMarriages: {} };
    const messages = [];
    const sock = {
        sendMessage: async (_chatId, payload) => {
            messages.push(payload);
            return { key: { id: String(messages.length) } };
        }
    };
    return { botData, messages, sock };
}

function message(participant, extras = {}, contextInfo = {}) {
    return {
        key: { participant, ...extras },
        message: { extendedTextMessage: { contextInfo } },
        pushName: 'Aventurero'
    };
}

test('acepta una solicitud de matrimonio normal y elimina la invitación pendiente', async () => {
    const ctx = harness();
    const proposer = '15550000001@s.whatsapp.net';
    const recipient = '15550000002@s.whatsapp.net';

    await profileCommand(ctx.sock, 'grupo@g.us', message(proposer, {}, { mentionedJid: [recipient] }), 'marry', '', ctx.botData, () => {}, '.');
    await profileCommand(ctx.sock, 'grupo@g.us', message(recipient), 'marry', '', ctx.botData, () => {}, '.');

    assert.equal(ctx.botData.profiles[proposer].partner, recipient);
    assert.equal(ctx.botData.profiles[recipient].partner, proposer);
    assert.equal(Object.keys(ctx.botData.pendingMarriages).length, 0);
    assert.match(ctx.messages.at(-1).text, /se han casado/i);
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
