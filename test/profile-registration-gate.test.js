const test = require('node:test');
const assert = require('node:assert/strict');
const {
    registeredProfileForMessage,
    rememberPhoneAlias
} = require('../lib/profileRegistration');

const PHONE = '15550000041@s.whatsapp.net';
const LID = '700000041@lid';
const PROFILE = { name: 'Carlos', registered: true };

test('reconoce en chat directo un perfil por remoteJidAlt cuando el emisor llega como LID', () => {
    const botData = { profiles: { [PHONE]: PROFILE }, phoneAliases: {} };
    const msg = { key: { remoteJid: LID, remoteJidAlt: PHONE } };

    assert.equal(registeredProfileForMessage(botData, msg, LID), PROFILE);
    assert.equal(rememberPhoneAlias(botData, msg, LID), true);
    assert.equal(botData.phoneAliases['15550000041'], LID);
    assert.equal(registeredProfileForMessage(botData, { key: { remoteJid: LID } }, LID), PROFILE);
});

test('acepta la identidad alternativa del participante en grupo, pero no remoteJidAlt del grupo', () => {
    const botData = {
        profiles: { [PHONE]: PROFILE },
        phoneAliases: {}
    };
    const groupMsg = {
        key: {
            remoteJid: '120363000000000000@g.us',
            remoteJidAlt: PHONE,
            participant: LID,
            participantAlt: PHONE
        }
    };

    assert.equal(registeredProfileForMessage(botData, groupMsg, LID), PROFILE);
    assert.equal(rememberPhoneAlias(botData, groupMsg, LID), true);
    assert.equal(botData.phoneAliases['15550000041'], LID);

    const unrelatedRegisteredPhone = '15550000042@s.whatsapp.net';
    botData.profiles[unrelatedRegisteredPhone] = { name: 'Otra persona', registered: true };
    const unregisteredSender = '700000099@lid';
    const unrelatedGroupMsg = {
        key: {
            remoteJid: '120363000000000001@g.us',
            remoteJidAlt: unrelatedRegisteredPhone,
            participant: unregisteredSender
        }
    };
    assert.equal(registeredProfileForMessage(botData, unrelatedGroupMsg, unregisteredSender), null);
    assert.equal(rememberPhoneAlias(botData, unrelatedGroupMsg, unregisteredSender), false);
    assert.equal(botData.phoneAliases['15550000042'], undefined);
});

test('reconoce perfiles si el chat directo trae primero el teléfono y como alterno el LID', () => {
    const botData = { profiles: { [LID]: PROFILE }, phoneAliases: {} };
    const msg = { key: { remoteJid: PHONE, remoteJidAlt: LID } };

    assert.equal(registeredProfileForMessage(botData, msg, PHONE), PROFILE);
    assert.equal(rememberPhoneAlias(botData, msg, PHONE), true);
    assert.equal(botData.phoneAliases['15550000041'], LID);
});
