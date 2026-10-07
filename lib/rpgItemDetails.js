const { CLASS_EQUIPMENT, RPG_ITEMS, MERCHANT_ITEMS } = require('./rpgCatalog');
const { itemImagePath, sendItemCaption } = require('./rpgMedia');
const { RECIPES } = require('./rpgExpansion');

const CLASS_LABELS = {
    guerrero: '⚔️ Guerrero',
    mago: '🔮 Mago',
    picaro: '🗡️ Pícaro',
    tirador: '🏹 Tirador',
    paladin: '🛡️ Paladín'
};
const fmt = value => Number(value || 0).toLocaleString('es-ES');
function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
function guessGearType(name) {
    const clean = normalize(name);
    if (clean.includes('anillo') || clean.includes('reliquia')) return 'Accesorio';
    if (/(armadura|escudo|tunica|capa|corona|visor|coraza|egida)/.test(clean)) return 'Armadura';
    return 'Arma';
}
function catalogEntries() {
    const entries = [];
    for (const [id, item] of Object.entries(RPG_ITEMS)) {
        const recipe = Object.entries(RECIPES).find(([, value]) => Number(value.gives?.[id]) > 0);
        entries.push({ id, item, category: item.type || 'objeto', source: recipe ? `Fabricación: .fabricar ${recipe[0]}` : item.type === 'consumible' && item.price ? `Mercader: .comprar ${id}` : 'Inventario RPG' });
    }
    for (const [classId, items] of Object.entries(CLASS_EQUIPMENT)) {
        for (const item of items) {
            const type = item.type === 'arma' ? 'Arma' : item.type === 'armadura' ? 'Armadura' : item.type === 'reliquia' ? 'Accesorio' : guessGearType(item.name);
            entries.push({ id: item.id, item, category: type, classId, source: `Mercader: .mercader ${item.id}${item.dungeonDrop ? ' · También puede caer en mazmorra' : ''}` });
        }
    }
    for (const [id, item] of Object.entries(MERCHANT_ITEMS)) {
        entries.push({ id, item, category: 'Herramienta', source: `Mercader: .mercader ${id}` });
    }
    return entries;
}
const ENTRIES = catalogEntries();
function matchingItems(query) {
    const value = normalize(query);
    if (!value) return [];
    return ENTRIES.filter(({ id, item }) => {
        const normalizedId = normalize(id.replace(/_/g, ' '));
        const normalizedName = normalize(item.name);
        return normalizedId === value || normalizedName === value || normalizedId.includes(value) || normalizedName.includes(value);
    });
}
function itemCaption(entry, prefix = '.') {
    const { id, item, category, classId, source } = entry;
    const lines = ['╭━━〔 🧾 FICHA DEL OBJETO 〕━━╮', `┃ ${item.name}`, '┃', `┃ 🏷️ Tipo: *${category}*`];
    if (classId) {
        lines.push(`┃ 👑 Clase: *${CLASS_LABELS[classId] || classId}*`);
        lines.push(`┃ ✨ Bonificación: *+${Math.round(Number(item.bonus || 0) * 100)}%* en ${item.activities.join(', ')}`);
        lines.push(`┃ 💰 Precio: *${fmt(item.price)} monedas de oro*`);
    } else if (RPG_ITEMS[id]) {
        const stats = [];
        if (item.power) stats.push(`⚔️ Poder +${item.power}`);
        if (item.defense) stats.push(`🛡️ Defensa +${item.defense}`);
        if (item.heal) lines.push(`┃ ❤️ Recupera hasta *${item.heal} HP*`);
        if (item.energy) lines.push(`┃ ⚡ Recupera hasta *${item.energy} de energía*`);
        if (item.slot) lines.push(`┃ 📍 Espacio: *${item.slot}*`);
        if (stats.length) lines.push(`┃ 📊 ${stats.join(' · ')}`);
        if (item.price) lines.push(`┃ 💰 Precio de compra: *${fmt(item.price)} monedas*`);
        if (item.minPrice) lines.push(`┃ 🪙 Valor base de venta: *${fmt(item.minPrice)} monedas*`);
    } else if (MERCHANT_ITEMS[id]) {
        lines.push(`┃ 🔧 Durabilidad: *${item.durability} usos*`);
        lines.push(`┃ 💰 Precio: *${fmt(item.price)} monedas de oro*`);
        const usage = id === 'pico' ? 'minar' : id === 'cana' ? 'pescar' : 'cazar';
        lines.push(`┃ 🧭 Uso: *${usage}*`);
        if (id === 'espada') lines.push('┃ ℹ️ Es la *espada de herramienta*; no es la Espada de hierro equipable.');
    }
    lines.push(`┃ 📦 Obtención: *${source}*`);
    if (RPG_ITEMS[id]?.type === 'consumible') lines.push(`┃ 🧪 Uso: *${prefix}usar ${id}*`);
    if (id === 'espada' || id === 'pico' || id === 'cana') lines.push(`┃ 🛠️ Se usa con *${prefix}${id === 'pico' ? 'minar' : id === 'cana' ? 'pescar' : 'cazar'}*.`);
    if (!itemImagePath(id)) lines.push('┃ 🖼️ Aún no hay una imagen específica para este objeto; aquí tienes su ficha textual.');
    lines.push('╰━━━━━━━━━━━━━━━━━━━━╯');
    return lines.join('\n');
}
async function showItemDetails(sock, chatId, msg, query, prefix = '.') {
    const matches = matchingItems(query);
    if (!String(query || '').trim()) {
        const list = ENTRIES.map(entry => `• ${entry.item.name} — *${prefix}objeto ${entry.id}*${itemImagePath(entry.id) ? '' : ' (sin imagen)'}`).join('\n');
        return sock.sendMessage(chatId, { text: `🗂️ *CATÁLOGO VISUAL DEL RPG*\n\nConsulta una ficha con *${prefix}objeto <nombre o ID>*; la respuesta incluye la imagen, características y forma de obtener el objeto.\n\n${list}` }, { quoted: msg });
    }
    if (!matches.length) return sock.sendMessage(chatId, { text: `❌ No encontré ese objeto. Usa *${prefix}objeto* para ver el catálogo, o escribe el ID exacto.` }, { quoted: msg });
    if (matches.length > 1) {
        const choices = matches.map(entry => `• *${entry.item.name}* — ID: \`${entry.id}\``).join('\n');
        return sock.sendMessage(chatId, { text: `🔎 *Hay varias coincidencias.* Escribe el ID exacto para no confundir objetos distintos:\n\n${choices}` }, { quoted: msg });
    }
    const entry = matches[0];
    return sendItemCaption(sock, chatId, msg, entry.id, itemCaption(entry, prefix));
}

module.exports = { showItemDetails, catalogEntries, matchingItems, itemCaption, normalize };
