'use strict';

const SCAM_PATTERNS = [
    /te\s+(ganaste|has\s+ganado|toc[oó]|corresponde)\s+(un\s+)?(premio|bono|regalo)/i,
    /duplic(ar|o|amos)\s+(tu\s+)?(saldo|dinero|inversi[oó]n)/i,
    /(inversi[oó]n|negocio)\s+(segur[oa]|garantizad[oa]|sin\s+riesgo)/i,
    /(env[ií]a|manda|comparte)\s+(el\s+)?(c[oó]digo|otp|pin|contrase[nñ]a)/i,
    /(verifica|confirma|activa)\s+(tu\s+)?(cuenta|n[uú]mero|premio).{0,80}(link|enlace|aqu[ií])/i,
    /(gana|ganar).{0,40}(dinero|d[oó]lares|euros).{0,40}(f[aá]cil|r[aá]pido|garantizado)/i,
    /(whatsapp|telegram).{0,50}(soporte|seguridad|verificaci[oó]n).{0,50}(c[oó]digo|pin|enlace)/i
];
const SCAM_TERMS = /\b(estafa|estafas|fraude|phishing|premio|inversi[oó]n|duplicar|duplico|c[oó]digo otp|c[oó]digo de verificaci[oó]n|gana dinero|dinero f[aá]cil)\b/i;
const LINK = /https?:\/\/|www\.|wa\.me\//i;

function isScamMessage(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return false;
    if (SCAM_PATTERNS.some(pattern => pattern.test(text))) return true;
    return SCAM_TERMS.test(text) && LINK.test(text);
}

async function estafCommand(sock, from, msg, isAdmin, botData, saveBotData, args = []) {
    if (!String(from || '').endsWith('@g.us')) return sock.sendMessage(from, { text: '❌ Este comando solo funciona dentro de un grupo.' }, { quoted: msg });
    if (!isAdmin) return sock.sendMessage(from, { text: '🔐 Solo los administradores pueden configurar antiestafa.' }, { quoted: msg });
    botData.antiScamGroups ||= {};
    const action = String(args[0] || '').toLowerCase();
    if (['on', 'activar', 'enable'].includes(action)) {
        botData.antiScamGroups[from] = true;
        saveBotData();
        return sock.sendMessage(from, { text: '╭━━〔 🛡️ *ANTIESTAFA ACTIVADO* 〕━━╮\n┃\n┃ Se bloquearán mensajes que intenten\n┃ engañar, robar códigos o promocionar\n┃ premios e inversiones fraudulentas.\n┃\n┃ El bot eliminará el mensaje y expulsará\n┃ al remitente cuando detecte una coincidencia.\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━╯' }, { quoted: msg });
    }
    if (['off', 'desactivar', 'disable'].includes(action)) {
        delete botData.antiScamGroups[from];
        saveBotData();
        return sock.sendMessage(from, { text: '❌ *Antiestafa desactivado.*' }, { quoted: msg });
    }
    const active = Boolean(botData.antiScamGroups[from]);
    return sock.sendMessage(from, { text: `🛡️ *ANTIESTAFA:* ${active ? 'ACTIVADO ✅' : 'DESACTIVADO ❌'}\n\nUso:\n• *.estaf on*\n• *.estaf off*` }, { quoted: msg });
}

module.exports = estafCommand;
module.exports.isScamMessage = isScamMessage;
module.exports.aliases = ['antiestafa'];
