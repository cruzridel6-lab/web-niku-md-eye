async function hidetagCommand(sock, from, msg, isAdmin, q) {
    if (!isAdmin || !from.endsWith('@g.us')) return await sock.sendMessage(from, { text: "❌ Only admin can use this command in groups." }, { quoted: msg });
    if (!String(q || '').trim()) return await sock.sendMessage(from, { text: '✍️ Escribe el mensaje para enviar una mención silenciosa: *.hidetag <mensaje>*.' }, { quoted: msg });
    
    const groupMetadata = await sock.groupMetadata(from);
    const participants = groupMetadata.participants.map(p => p.id);
    
    await sock.sendMessage(from, { 
        text: q,
        mentions: participants 
    });
}

module.exports = hidetagCommand;
