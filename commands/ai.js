async function aiCommand(sock, from, msg, isAdmin, session, args) {
    const action = args[0]?.toLowerCase();
    if (action === 'on') {
        session.aiEnabled = true;
        await sock.sendMessage(from, { text: "✅ AI Auto-Reply Enabled!" }, { quoted: msg });
    } else if (action === 'off') {
        session.aiEnabled = false;
        await sock.sendMessage(from, { text: "❌ AI Auto-Reply Disabled!" }, { quoted: msg });
    } else if (args.length > 0) {
        // Direct query to AI
        const query = args.join(' ');
        try {
            await sock.sendMessage(from, { react: { text: '🤖', key: msg.key } });
            const response = await session.getAIResponse(from, query);
            await sock.sendMessage(from, { text: response }, { quoted: msg });
        } catch (e) {
            const status = e?.status || e?.response?.status;
            const text = status === 429
                ? '⏳ La IA alcanzó el límite temporal de solicitudes del proveedor.'
                : '❌ La IA no pudo responder ahora. Inténtalo de nuevo más tarde.';
            await sock.sendMessage(from, { text }, { quoted: msg });
        }
    } else {
        await sock.sendMessage(from, { text: "❌ Usage:\n.ai [on/off] - Toggle Auto-Reply\n.ai [query] - Ask AI something" }, { quoted: msg });
    }
}

module.exports = aiCommand;
