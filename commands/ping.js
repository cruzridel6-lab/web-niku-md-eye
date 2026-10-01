async function pingCommand(sock, from, msg) {
    const start = Date.now();
    const { key } = await sock.sendMessage(from, { text: 'Probando velocidad...' }, { quoted: msg });
    const end = Date.now();
    await sock.sendMessage(from, { text: `⚡ *Velocidad de respuesta:* ${end - start}ms`, edit: key });
}

module.exports = pingCommand;
