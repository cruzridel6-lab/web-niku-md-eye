const test = require('node:test');
const assert = require('node:assert/strict');
const profileCommand = require('../commands/profile');

test('`.setgenero`, `.setgender` y `.setgenre` configuran el mismo género', async () => {
    for (const command of ['setgenero', 'setgender', 'setgenre']) {
        const jid = '15550000021@s.whatsapp.net';
        const botData = { profiles: {}, pendingMarriages: {} };
        const replies = [];
        const sock = { sendMessage: async (_chat, payload) => { replies.push(payload); return {}; } };

        await profileCommand(sock, 'chat@g.us', { key: { participant: jid } }, command, 'mujer', botData, () => {}, '.');

        assert.equal(botData.profiles[jid].genre, 'mujer', `${command} debe guardar el género`);
        assert.match(replies.at(-1).text, /Género actualizado a \*Mujer\*/);
    }
});

test('la ayuda de perfil recomienda el comando español `.setgenero`', () => {
    assert.match(profileCommand.menu('.'), /\.setgenero hombre\|mujer\|otro/);
});
