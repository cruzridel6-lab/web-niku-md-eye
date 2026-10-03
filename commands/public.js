async function publicCommand(sock, from, msg, canUsePublic, session) {
    if (!canUsePublic) return await sock.sendMessage(from, { text: "❌ Solo el propietario o un usuario Premium activo puede usar este comando." }, { quoted: msg });
    
    session.isPublic = true;
    await sock.sendMessage(from, { text: "🌍 El bot ahora está en modo PÚBLICO. Todos pueden usarlo." }, { quoted: msg });
}

module.exports = publicCommand;
