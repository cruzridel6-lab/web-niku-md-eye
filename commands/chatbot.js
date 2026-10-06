module.exports = async function(sock, chatId, msg, session, args) {
    const action = args[0]?.toLowerCase();
    
    if (action === 'on') {
        session.aiEnabled = true;
        await sock.sendMessage(chatId, { text: '🤖 IA local activada. Responderé automáticamente en este chat privado, sin usar APIs externas.\n\nDesactivar: *.chatbot off*' }, { quoted: msg });
    } else if (action === 'off') {
        session.aiEnabled = false;
        await sock.sendMessage(chatId, { text: '⛔ IA automática desactivada. El comando *.ai* seguirá disponible bajo demanda.' }, { quoted: msg });
    } else {
        await sock.sendMessage(chatId, { 
            text: `🤖 *CONFIGURACIÓN DE IA LOCAL*\n\n` +
                `Estado: ${session.aiEnabled ? 'ACTIVA' : 'DESACTIVADA'}\n` +
                `Proveedor: local, sin API externa\n\n` +
                `Usa *.chatbot on/off* para cambiar el modo automático.`
        }, { quoted: msg });
    }
};
