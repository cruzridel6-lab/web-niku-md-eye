'use strict';

const SALE_TERMS = [
    /\b(vendo|venta|vender|compro|comprar|disponible|oferta|ofrezco|permuto|interesad[oa]s?|mayoreo|delivery|recarga|pack)\b/i,
    /\b(precio|costo|valor|pago|pagar|transferencia|paypal|nequi|zelle|usdt|bitcoin|efectivo|deposito|depósito)\b/i,
    /\b(dm|privado| inbox|escribeme|escríbeme|contacto)\b/i
];
function isSalesMessage(value) {
    const text = String(value || '').toLowerCase();
    if (!text.trim()) return false;
    const hits = SALE_TERMS.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
    const hasPayment = /\b(transferencia|paypal|nequi|zelle|usdt|bitcoin|efectivo|pago|deposito|depósito)\b/i.test(text);
    const hasMoney = /(?:\$|€|£|🪙|\b\d+[\s.]?(?:usd|dolares|dólares|pesos|cup|eur)\b)/i.test(text);
    const hasLink = /https?:\/\//i.test(text);
    return hits >= 2 || (hasPayment && (hasMoney || hasLink));
}
async function antiSalesCommand(sock, from, msg, isAdmin, botData, saveBotData, args = []) {
    if (!from.endsWith('@g.us')) return sock.sendMessage(from, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: msg });
    if (!isAdmin) return sock.sendMessage(from, { text: '❌ Solo los administradores pueden configurar antiventas.' }, { quoted: msg });
    botData.antiSalesGroups ||= {};
    const action = String(args[0] || '').toLowerCase();
    if (['on', 'activar', 'enable'].includes(action)) {
        botData.antiSalesGroups[from] = true;
        saveBotData();
        return sock.sendMessage(from, { text: '✅ *Antiventas activado.*\n\nLos mensajes que parezcan ventas serán borrados y el remitente será expulsado.' }, { quoted: msg });
    }
    if (['off', 'desactivar', 'disable'].includes(action)) {
        delete botData.antiSalesGroups[from];
        saveBotData();
        return sock.sendMessage(from, { text: '❌ Antiventas desactivado.' }, { quoted: msg });
    }
    const active = Boolean(botData.antiSalesGroups[from]);
    return sock.sendMessage(from, { text: `🛍️ *Antiventas:* ${active ? 'ACTIVADO' : 'DESACTIVADO'}\n\nUso: *.antiventas on* | *.antiventas off*` }, { quoted: msg });
}
module.exports = antiSalesCommand;
module.exports.isSalesMessage = isSalesMessage;
