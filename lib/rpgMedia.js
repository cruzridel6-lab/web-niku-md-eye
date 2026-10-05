const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CLASS_IMAGES = {
    guerrero: 'Gerrero.jpg',
    mago: 'Mago.jpg',
    picaro: 'Picaro.jpg',
    tirador: 'Tirador.jpg'
};

function existingImage(filename) {
    const imagePath = path.join(DATA_DIR, filename);
    return fs.existsSync(imagePath) ? imagePath : null;
}

function classImagePath(classKey) {
    return existingImage(CLASS_IMAGES[String(classKey || '').toLowerCase()]);
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

module.exports = { classImagePath, shopImagePath, dungeonImagePath, sendImageCaption };
