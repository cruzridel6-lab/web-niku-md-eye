const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CLASS_IMAGES = {
    guerrero: 'Gerrero.jpg',
    mago: 'Mago.jpg',
    picaro: 'Picaro.jpg',
    tirador: 'Tirador.jpg',
    paladin: 'Paladin.jpg'
};
const COMMAND_IMAGES = {
    balance: 'Balance.jpg',
    hunt: 'Cazar.jpg',
    clan: 'Clan.jpg',
    deposit: 'Depositar.jpg',
    duel: 'Duelo.jpg',
    explore: 'Explorar.jpg',
    inventory: 'Iventario.jpg',
    market: 'Mercado.jpg',
    mission: 'Miciones.jpg',
    mine: 'Minar.jpg',
    patrol: 'Patrullar.jpg',
    fish: 'Peacar.jpg',
    raid: 'Raid.jpg',
    gather: 'Recoletar.jpg',
    auction: 'Subastador.jpg'
};

// IDs canónicos del RPG -> imágenes de objeto añadidas a data/.
// Se conservan los nombres originales de los archivos aunque algunos tengan erratas.
const ITEM_IMAGE_ASSETS = Object.freeze({
    sword_iron: 'Eapada de hierro.jpg',
    armor_reinforced: 'Amadura reforzada.jpg',
    sword_abyss: 'Espada abismal.jpg',
    armor_dragon: 'Armadura de escamas.jpg',
    amulet_lunar: 'Amuleto lunar.jpg',
    mandoble_dragon: 'Mandoble del dragon.jpg',
    armadura_coloso: 'Armadura del coloso.jpg',
    lanza_titan: 'Lamza del titan.jpg',
    escudo_abismal: 'Eacudo aviamal.jpg',
    grimorio_arcano: 'Grimonio alcano.jpg',
    tunica_astral: 'Tunica atral.jpg',
    baston_cometa: 'Baston del cometa.jpg',
    corona_hechicero: 'Corona del echisero.jpg',
    dagas_sombra: 'Dagas de la sonbra.jpg',
    capa_niebla: 'Capa de la niebla.jpg',
    katana_fantasma: 'Catana fantasma.jpg',
    anillo_sombra: 'Anillo de sonbra.jpg',
    arco_fenix: 'Arco del fenix.jpg',
    visor_halcon: 'Visor del alcon.jpg',
    ballesta_fenix: 'Vallesta del femix.jpg',
    coraza_cazador: 'Coraza del cazador.jpg',
    maza_del_alba: 'Maza sel alba.jpg',
    egida_del_juramento: 'Eguida del juramento.jpg',
    pico: 'Pico minero.jpg',
    cana: 'Caña.jpg'
});
const ITEM_IMAGE_NAME_ALIASES = {
    'espada de hierro': 'sword_iron',
    'armadura reforzada': 'armor_reinforced',
    'espada abismal': 'sword_abyss',
    'armadura de escamas': 'armor_dragon',
    'amuleto lunar': 'amulet_lunar',
    'mandoble del dragon': 'mandoble_dragon',
    'armadura del coloso': 'armadura_coloso',
    'lanza del titan': 'lanza_titan',
    'escudo abismal': 'escudo_abismal',
    'grimorio arcano': 'grimorio_arcano',
    'tunica astral': 'tunica_astral',
    'baston del cometa': 'baston_cometa',
    'corona del hechicero': 'corona_hechicero',
    'dagas de la sombra': 'dagas_sombra',
    'capa de la niebla': 'capa_niebla',
    'katana fantasma': 'katana_fantasma',
    'anillo de sombra': 'anillo_sombra',
    'arco del fenix': 'arco_fenix',
    'visor del halcon': 'visor_halcon',
    'ballesta fenix': 'ballesta_fenix',
    'coraza del cazador': 'coraza_cazador',
    'maza del alba': 'maza_del_alba',
    'egida del juramento': 'egida_del_juramento',
    'pico': 'pico',
    'pico minero': 'pico',
    'cana': 'cana',
    'cana de pescar': 'cana'
};

function normalizeItemKey(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
const ITEM_IMAGE_NAMES = Object.freeze(Object.fromEntries(Object.entries(ITEM_IMAGE_NAME_ALIASES).map(([name, id]) => [normalizeItemKey(name), id])));
function existingImage(filename) {
    if (!filename) return null;
    const imagePath = path.join(DATA_DIR, filename);
    return fs.existsSync(imagePath) ? imagePath : null;
}
function classImagePath(classKey) {
    return existingImage(CLASS_IMAGES[String(classKey || '').toLowerCase()]);
}
function commandImagePath(command) {
    return existingImage(COMMAND_IMAGES[String(command || '').toLowerCase()]);
}
function itemImagePath(itemIdOrName) {
    const value = itemIdOrName && typeof itemIdOrName === 'object'
        ? itemIdOrName.id || itemIdOrName.name
        : itemIdOrName;
    const key = normalizeItemKey(value);
    return existingImage(ITEM_IMAGE_ASSETS[key] || ITEM_IMAGE_ASSETS[ITEM_IMAGE_NAMES[key]]);
}
function shopImagePath() {
    return existingImage('Tienda.jpg');
}
function dungeonImagePath() {
    return existingImage('mazmora.jpg');
}
async function sendImageCaption(sock, chatId, msg, imagePath, caption, extra = {}) {
    if (!imagePath) return sock.sendMessage(chatId, { text: caption, ...extra }, { quoted: msg });
    return sock.sendMessage(chatId, { image: { url: imagePath }, caption, ...extra }, { quoted: msg });
}
async function sendItemCaption(sock, chatId, msg, itemIdOrName, caption, extra = {}) {
    return sendImageCaption(sock, chatId, msg, itemImagePath(itemIdOrName), caption, extra);
}

module.exports = { classImagePath, commandImagePath, itemImagePath, shopImagePath, dungeonImagePath, sendImageCaption, sendItemCaption, ITEM_IMAGE_ASSETS };
