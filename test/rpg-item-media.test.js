const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { ITEM_IMAGE_ASSETS, itemImagePath } = require('../lib/rpgMedia');
const { showItemDetails } = require('../lib/rpgItemDetails');

function mockSocket() {
    const sent = [];
    return {
        sent,
        sock: { async sendMessage(...args) { sent.push(args); return { ok: true }; } }
    };
}

test('todas las imágenes subidas están mapeadas a un ID canónico y existen', () => {
    assert.equal(Object.keys(ITEM_IMAGE_ASSETS).length, 25);
    for (const [id, filename] of Object.entries(ITEM_IMAGE_ASSETS)) {
        assert.ok(fs.existsSync(itemImagePath(id)), `${id} -> ${filename}`);
        assert.equal(itemImagePath(id), require('node:path').join(__dirname, '..', 'data', filename));
    }
});

test('los nombres con tildes y espacios resuelven la misma imagen', () => {
    assert.equal(itemImagePath('Mandoble del Dragón'), itemImagePath('mandoble_dragon'));
    assert.equal(itemImagePath('Caña de pescar'), itemImagePath('cana'));
    assert.equal(itemImagePath('Égida del Juramento'), itemImagePath('egida_del_juramento'));
});

test('la ficha de una espada incluye la foto y las estadísticas vinculadas', async () => {
    const { sock, sent } = mockSocket();
    await showItemDetails(sock, 'chat', { key: {} }, 'Espada de hierro', '.');
    assert.equal(sent.length, 1);
    const payload = sent[0][1];
    assert.equal(payload.image.url, itemImagePath('sword_iron'));
    assert.match(payload.caption, /Espada de hierro/);
    assert.match(payload.caption, /Poder \+18/);
    assert.match(payload.caption, /fabricar espada_hierro/);
});

test('la ficha de Paladín asocia la ilustración con su clase y bonificación', async () => {
    const { sock, sent } = mockSocket();
    await showItemDetails(sock, 'chat', { key: {} }, 'egida_del_juramento', '.');
    const payload = sent[0][1];
    assert.equal(payload.image.url, itemImagePath('egida_del_juramento'));
    assert.match(payload.caption, /Paladín/);
    assert.match(payload.caption, /Bonificación:.*\+8%/);
});

test('el nombre ambiguo espada no confunde el arma equipable y la herramienta', async () => {
    const { sock, sent } = mockSocket();
    await showItemDetails(sock, 'chat', { key: {} }, 'espada', '.');
    const payload = sent[0][1];
    assert.equal(payload.image, undefined);
    assert.match(payload.text, /Espada de hierro/);
    assert.match(payload.text, /Espada de herramienta/);
    assert.match(payload.text, /sword_iron/);
    assert.match(payload.text, /ID: `espada`/);
});

test('la espada de herramienta conserva su ficha y no usa la foto de Espada de hierro', async () => {
    const { sock, sent } = mockSocket();
    await showItemDetails(sock, 'chat', { key: {} }, 'espada de herramienta', '.');
    const payload = sent[0][1];
    assert.equal(payload.image, undefined);
    assert.match(payload.text, /espada de herramienta/i);
    assert.match(payload.text, /no es la Espada de hierro equipable/i);
    assert.match(payload.text, /imagen específica/);
});

test('el catálogo explica cómo consultar cada foto y ficha', async () => {
    const { sock, sent } = mockSocket();
    await showItemDetails(sock, 'chat', { key: {} }, '', '.');
    const payload = sent[0][1];
    assert.match(payload.text, /CATÁLOGO VISUAL/);
    assert.match(payload.text, /\.objeto mandoble_dragon/);
    assert.match(payload.text, /\.objeto pico/);
});
