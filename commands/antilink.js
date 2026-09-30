async function antilinkCommand(sock, from, msg, isAdmin, botData, saveBotData, args) {
    if (!isAdmin || !from.endsWith('@g.us')) return await sock.sendMessage(from, { text: "❌ Only admin can use this command in groups." }, { quoted: msg });
    botData.antilinkGroups ||= {};
    
    const action = args[0]?.toLowerCase();
    if (action === 'on' || action === 'del') {
        botData.antilinkGroups[from] = 'del';
        saveBotData();
        await sock.sendMessage(from, { text: "✅ Antienlace activado: borrar enlaces." }, { quoted: msg });
    } else if (action === 'kick') {
        botData.antilinkGroups[from] = 'kick';
        saveBotData();
        await sock.sendMessage(from, { text: "✅ Antienlace activado: borrar y expulsar." }, { quoted: msg });
    } else if (action === 'off') {
        delete botData.antilinkGroups[from];
        saveBotData();
        await sock.sendMessage(from, { text: "❌ Antienlace desactivado." }, { quoted: msg });
    } else {
        await sock.sendMessage(from, { text: "ℹ️ Uso: .antilink on | off | kick" }, { quoted: msg });
    }
}

module.exports = antilinkCommand;
