const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CLASS_IMAGES = {
    guerrero: 'Gerrero.jpg',
    mago: 'Mago.jpg',
    picaro: 'Picaro.jpg',
    tirador: 'Tirador.jpg'
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

module.exports = { classImagePath, commandImagePath, shopImagePath, dungeonImagePath, sendImageCaption };
