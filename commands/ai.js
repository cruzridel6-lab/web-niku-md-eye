async function aiCommand(sock, from, msg) {
    return sock.sendMessage(from, {
        text: '⏳ La IA alcanzó el límite temporal de solicitudes del proveedor.'
    }, { quoted: msg });
}

module.exports = aiCommand;
