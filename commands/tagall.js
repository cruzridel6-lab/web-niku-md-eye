async function tagallCommand(sock, from, msg, isAdmin, q) {
    if (!isAdmin || !from.endsWith('@g.us')) return await sock.sendMessage(from, { text: "❌ Only admin can use this command in groups." }, { quoted: msg });
    if (!String(q || '').trim()) return await sock.sendMessage(from, { text: '✍️ Escribe el mensaje que quieres enviar: *.tagall <mensaje>*.' }, { quoted: msg });
    
    const groupMetadata = await sock.groupMetadata(from);
    const participants = groupMetadata.participants;
    
    let tagText = `📢 *AVISO A TODO EL GRUPO*\n\n*Mensaje:* ${q}\n\n`;
    for (let mem of participants) {
        tagText += `🔹 @${mem.id.split('@')[0]}\n`;
    }
    
    await sock.sendMessage(from, { 
        text: tagText, 
        mentions: participants.map(p => p.id) 
    }, { quoted: msg });
}

module.exports = tagallCommand;
