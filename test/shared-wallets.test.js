const test = require('node:test');
const assert = require('node:assert/strict');
const { ensureLocalWallet, mergeWalletRecords } = require('../lib/sharedWallets');
const { grantStarterPackToWallet } = require('../lib/starterPack');
const profileCommand = require('../commands/profile');

const PHONE = '15550000091@s.whatsapp.net';
const LID = '9988776655@lid';
const ALIASES = { '15550000091': LID };

function oldWallet({ coins, bank = 0, pico = 15, claimed = false }) {
    return {
        coins,
        bank,
        tools: { pico: { durability: pico, maxDurability: 15 } },
        starterPackClaimed: claimed
    };
}

test('retira el crédito duplicado del cofre si ya no queda suficiente saldo líquido', () => {
    const merged = mergeWalletRecords([
        oldWallet({ coins: 400, bank: 1200, claimed: true }),
        oldWallet({ coins: 300, bank: 500, claimed: true })
    ]);
    assert.equal(merged.coins, 0);
    assert.equal(merged.bank, 1400, 'se descuentan los 700 restantes del exceso de pack desde el banco');
});

test('migra y suma los saldos privados y grupales, descuenta el pack duplicado y enlaza los campos', () => {
    const botData = {
        phoneAliases: { ...ALIASES },
        profiles: { [PHONE]: { name: 'Aventurero', phoneNumber: PHONE, registered: true } },
        economy: {
            [PHONE]: { users: { [PHONE]: oldWallet({ coins: 1600, bank: 100, pico: 15, claimed: true }) } },
            'grupo-prueba@g.us': { users: { [LID]: oldWallet({ coins: 1400, bank: 200, pico: 8, claimed: true }) } }
        }
    };

    const privateWallet = ensureLocalWallet(botData, PHONE, PHONE).user;
    const groupWallet = ensureLocalWallet(botData, 'grupo-prueba@g.us', LID).user;

    assert.equal(privateWallet.coins, 2000, '1.600 + 1.400 menos el pack repetido de 1.000');
    assert.equal(groupWallet.coins, 2000);
    assert.equal(privateWallet.bank, 300);
    assert.equal(groupWallet.bank, 300);
    assert.equal(privateWallet.tools.pico.durability, 15);
    assert.equal(groupWallet.tools.pico.durability, 15, 'conserva la mejor durabilidad de los inventarios fusionados');
    assert.equal(privateWallet.starterPackClaimed, true);
    assert.equal(grantStarterPackToWallet(groupWallet), false, 'no se vuelve a entregar el pack en el otro chat');

    privateWallet.coins -= 125;
    assert.equal(groupWallet.coins, 1875, 'un gasto en privado se refleja inmediatamente en el grupo');

    const restored = JSON.parse(JSON.stringify(botData));
    const restoredPrivate = ensureLocalWallet(restored, PHONE, PHONE).user;
    const restoredGroup = ensureLocalWallet(restored, 'grupo-prueba@g.us', LID).user;
    assert.equal(restoredPrivate.coins, 1875);
    assert.equal(restoredGroup.coins, 1875, 'el vínculo sobrevive a guardar/cargar los datos del bot');
});

test('el pack nuevo se reclama una vez en privado y queda disponible en el grupo', () => {
    const botData = {
        phoneAliases: { ...ALIASES },
        profiles: { [PHONE]: { name: 'Aventurero', phoneNumber: PHONE, registered: true } },
        economy: {}
    };
    const privateWallet = ensureLocalWallet(botData, PHONE, PHONE).user;

    assert.equal(grantStarterPackToWallet(privateWallet), true);
    const groupWallet = ensureLocalWallet(botData, 'grupo-prueba@g.us', LID).user;
    assert.equal(grantStarterPackToWallet(groupWallet), false);
    assert.equal(groupWallet.coins, 1000);
    assert.equal(groupWallet.tools.pico.durability, 15);
    assert.equal(privateWallet.coins, groupWallet.coins);
});

test('perfil/bolsa muestra el mismo saldo al consultarse en privado y en grupo', async () => {
    const botData = {
        phoneAliases: { ...ALIASES },
        profiles: { [PHONE]: { name: 'Aventurero', phoneNumber: PHONE, registered: true, rpg: { class: '', level: 1, xp: 0 } } },
        economy: {
            'grupo-prueba@g.us': {
                users: {
                    [LID]: {
                        coins: 1750,
                        bank: 300,
                        rpg: { class: '', level: 1, xp: 0 }
                    }
                }
            }
        }
    };
    const messages = [];
    const sock = {
        sendMessage: async (_chat, payload) => { messages.push(payload); return { key: { id: String(messages.length) } }; },
        profilePictureUrl: async () => { throw new Error('sin foto para la prueba'); }
    };
    const privateMessage = { key: { remoteJid: PHONE, participant: PHONE }, pushName: 'Aventurero' };
    const groupMessage = { key: { remoteJid: 'grupo-prueba@g.us', participant: LID, participantAlt: PHONE }, pushName: 'Aventurero' };

    await profileCommand(sock, PHONE, privateMessage, 'profile', '', botData, () => {}, '.');
    const privateText = messages.at(-1).text;
    await profileCommand(sock, 'grupo-prueba@g.us', groupMessage, 'profile', '', botData, () => {}, '.');
    const groupText = messages.at(-1).text;

    assert.match(privateText, /Bolsa: \*1,750\*/);
    assert.match(groupText, /Bolsa: \*1,750\*/);
    assert.match(privateText, /Cofre: \*300\*/);
    assert.match(groupText, /Cofre: \*300\*/);
});
