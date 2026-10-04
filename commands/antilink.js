async function antilinkCommand(sock, from, msg, isAdmin, botData, saveBotData, args) {
    if (!isAdmin || !from.endsWith('@g.us')) return await sock.sendMessage(from, { text: "❌ Only admin can use this command in groups." }, { quoted: msg });
    botData.antilinkGroups ||= {};
    
    const action = args[0]?.toLowerCase();
    if (action === 'on' || action === 'kick' || action === 'remove') {
        botData.antilinkGroups[from] = 'kick';
        saveBotData();
        await sock.sendMessage(from, { text: "✅ Antienlace activado: borrar enlaces y expulsar al remitente." }, { quoted: msg });
    } else if (action === 'del' || action === 'delete' || action === 'borrar') {
        botData.antilinkGroups[from] = 'del';
        saveBotData();
        await sock.sendMessage(from, { text: "✅ Antienlace activado: solo borrar enlaces." }, { quoted: msg });
    } else if (action === 'off') {
        delete botData.antilinkGroups[from];
        saveBotData();
        await sock.sendMessage(from, { text: "❌ Antienlace desactivado." }, { quoted: msg });
    } else {
        await sock.sendMessage(from, { text: "ℹ️ Uso: .antilink on | del | off\n\n• on: borrar y expulsar\n• del: solo borrar" }, { quoted: msg });
    }
}

module.exports = antilinkCommand;
