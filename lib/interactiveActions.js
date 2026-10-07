'use strict';

const {
    generateWAMessageFromContent,
    generateMessageIDV2,
    isJidGroup
} = require('@whiskeysockets/baileys');

function normalizeButtons(buttons = []) {
    return buttons.filter(Boolean).slice(0, 3).map(button => ({
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({
            display_text: String(button.label || '').slice(0, 24),
            id: `cmd_${String(button.command || '').trim().replace(/^[^\p{L}\p{N}_]+/u, '')}`
        })
    }));
}

function extractInteractiveResponseId(message) {
    const queue = [message];
    const visited = new Set();
    while (queue.length) {
        const content = queue.shift();
        if (!content || typeof content !== 'object' || visited.has(content)) continue;
        visited.add(content);
        const selectedId = content.listResponseMessage?.singleSelectReply?.selectedRowId ||
            content.buttonsResponseMessage?.selectedButtonId ||
            content.templateButtonReplyMessage?.selectedId;
        if (selectedId) return String(selectedId);
        const paramsJson = content.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
        if (paramsJson) {
            try {
                const params = typeof paramsJson === 'string' ? JSON.parse(paramsJson) : paramsJson;
                const id = params?.id || params?.selectedId || params?.selected_id || params?.buttonId || params?.button_id;
                if (typeof id === 'string' && id.trim()) return id.trim();
            } catch (error) {}
        }
        for (const key of ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'documentWithCaptionMessage', 'editedMessage']) {
            const nested = content[key]?.message;
            if (nested && typeof nested === 'object') queue.push(nested);
        }
    }
    return '';
}

async function sendActionButtons(sock, jid, body, buttons, quoted) {
    const nativeButtons = normalizeButtons(buttons);
    if (!nativeButtons.length || typeof sock?.relayMessage !== 'function') return false;
    const content = {
        interactiveMessage: {
            body: { text: String(body || '') },
            footer: { text: 'NIKU MD • Selecciona una opción' },
            nativeFlowMessage: { buttons: nativeButtons, messageVersion: 1 }
        }
    };
    const userJid = sock.user?.id;
    const fullMessage = generateWAMessageFromContent(jid, content, {
        logger: sock.logger,
        userJid,
        messageId: generateMessageIDV2(userJid),
        timestamp: new Date()
    });
    const additionalNodes = [{
        tag: 'biz', attrs: {}, content: [{
            tag: 'interactive', attrs: { type: 'native_flow', v: '1' }, content: [
                { tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }
            ]
        }]
    }];
    if (!isJidGroup(jid)) additionalNodes.push({ tag: 'bot', attrs: { biz_bot: '1' } });
    try {
        await sock.relayMessage(jid, fullMessage.message, {
            messageId: fullMessage.key.id,
            additionalNodes
        });
        return true;
    } catch (error) {
        console.error('Interactive action buttons failed:', error.message);
        return false;
    }
}

module.exports = { sendActionButtons, extractInteractiveResponseId };
