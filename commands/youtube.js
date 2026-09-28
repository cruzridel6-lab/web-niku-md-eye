const videoCommand = require('./video');

module.exports = async function(sock, chatId, msg, q) {
    if (!q) return await sock.sendMessage(chatId, { text: '\u26A0\uFE0F .youtube <search query/link>' }, { quoted: msg });

    // Keep .youtube as a backwards-compatible alias, but use the maintained
    // multi-provider flow from .video instead of the retired Siputzx endpoint.
    const youtubeMessage = {
        ...msg,
        message: { ...(msg.message || {}), conversation: `.video ${q}` }
    };
    return videoCommand(sock, chatId, youtubeMessage);
};
