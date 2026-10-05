'use strict';

const SALE_GROUPS = [
    /\b(vendo|venta|ventas|vender|vendemos|se\s+vende|se\s+venden|a\s+la\s+venta|en\s+venta|compro|compra|comprar|negocio|negocios|emprendimiento|ofrezco|oferta|ofertas|permuto|intercambio|interesad[oa]s?|mayoreo|minorista|delivery|envio|envíos|envia|envía|recarga|recargas|pack|packs|combo|combos|catalogo|catálogo|producto|productos|articulo|artículo|pedido|pedidos|encargo|encargos|stock|disponible|disponibles|existencia|proveedor|distribuidor|cliente|clientes)\b/i,
    /\b(precio|precios|precio\s+de\s+(?:eso|esto|ese|este)|que\s+precio|qué\s+precio|costo|costos|cuanto\s+cuesta|cuánto\s+cuesta|cuanto\s+sale|cuánto\s+sale|a\s+cuanto|a\s+cuánto|en\s+cuanto|en\s+cuánto|valor|valores|tarifa|tarifas|cotizacion|cotización|presupuesto|descuento|descuentos|promocion|promoción|promo|rebaja|barato|barata|gratis|regal[oó]|2x1|sorteo)\b/i,
    /\b(pago|pagar|pagas|cobro|cobrar|cobran|transferencia|transferir|deposito|depósito|depositar|giro|efectivo|dolares|dólares|usd|usdt|eur|cup|mxn|paypal|nequi|zelle|banc[oó]|tarjeta|yape|plin|bizum|bitcoin|cripto|crypto|saldo|recarga)\b/i,
    /\b(dm|privado|inbox|escribeme|escríbeme|contactame|contáctame|contacto|whatsapp|telegram|link|enlace|manda|mando|reservar|reserva|separar|apartado|últimas unidades|ultimas unidades)\b/i
];
const STRONG_SALE = /\b(vendo|vendemos|venta|ventas|comprar|compro|ofrezco|oferta|promocion|promoción|recarga|recargas|vendo saldo|servicio|servicios|curso|cursos|cuenta|cuentas|perfil|perfiles|seguidores|likes|suscripcion|suscripción|premium|licencia|codigo|código|acceso|mayoreo|delivery)\b/i;
const PAYMENT = /\b(pago|pagar|transferencia|transferir|deposito|depósito|efectivo|paypal|nequi|zelle|usdt|bitcoin|cripto|crypto|yape|plin|bizum|tarjeta|saldo|recarga)\b/i;
const PRICE_QUERY = /\b(precio\s+de\s+(?:eso|esto|ese|este)|que\s+precio|qué\s+precio|cuanto\s+cuesta|cuánto\s+cuesta|cuanto\s+sale|cuánto\s+sale|a\s+cuanto|a\s+cuánto|en\s+cuanto|en\s+cuánto)\b/i;
const SALE_CONTEXT = /\b(se\s+vende|se\s+venden|a\s+la\s+venta|en\s+venta|producto|productos|articulo|artículo|servicio|servicios|stock|disponible|disponibles|comprar|vendo|ofrezco)\b/i;
const DIRECT_SALE = /\b(vendo|vendemos|se\s+vende|se\s+venden|a\s+la\s+venta|en\s+venta)\b/i;
function isSalesMessage(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!text) return false;
    const hits = SALE_GROUPS.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
    const hasMoney = /(?:\$|€|£|🪙|\b\d+[\s.]?(?:usd|dolares|dólares|pesos|cup|mxn|eur|usdt)\b)/i.test(text);
    const hasLink = /https?:\/\//i.test(text);
    return hits >= 2 || (STRONG_SALE.test(text) && (PAYMENT.test(text) || hasMoney || hasLink)) || (PRICE_QUERY.test(text) && SALE_CONTEXT.test(text)) || (DIRECT_SALE.test(text) && SALE_CONTEXT.test(text));
}
async function antiSalesCommand(sock, from, msg, isAdmin, botData, saveBotData, args = []) {
    if (!from.endsWith('@g.us')) return sock.sendMessage(from, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: msg });
    if (!isAdmin) return sock.sendMessage(from, { text: '❌ Solo los administradores pueden configurar antiventas.' }, { quoted: msg });
    botData.antiSalesGroups ||= {};
    const action = String(args[0] || '').toLowerCase();
    if (['on', 'activar', 'enable'].includes(action)) {
        botData.antiSalesGroups[from] = true;
        saveBotData();
        return sock.sendMessage(from, { text: '✅ *Antiventas activado.*\n\nLos mensajes que parezcan ventas, promociones o comercio serán borrados y el remitente será expulsado.' }, { quoted: msg });
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
