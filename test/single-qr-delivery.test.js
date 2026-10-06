const test = require('node:test');
const assert = require('node:assert/strict');
const createSingleQrDelivery = require('../lib/singleQrDelivery');

test('envía una sola imagen aunque WhatsApp rote el QR muchas veces', async () => {
    const delivery = createSingleQrDelivery();
    let sends = 0;

    for (let update = 0; update < 20; update++) {
        await delivery.sendOnce(async () => {
            sends++;
        });
    }

    assert.equal(sends, 1);
});

test('evita envíos duplicados mientras la primera imagen sigue enviándose', async () => {
    const delivery = createSingleQrDelivery();
    let resolveFirstSend;
    let sends = 0;
    const firstSend = delivery.sendOnce(() => new Promise(resolve => {
        sends++;
        resolveFirstSend = resolve;
    }));

    const duplicateSend = await delivery.sendOnce(async () => {
        sends++;
    });
    resolveFirstSend();

    assert.equal(duplicateSend, false);
    assert.equal(await firstSend, true);
    assert.equal(sends, 1);
});

test('permite reintentar en la siguiente actualización si falla el primer envío', async () => {
    const delivery = createSingleQrDelivery();
    let sends = 0;

    await assert.rejects(delivery.sendOnce(async () => {
        sends++;
        throw new Error('falló el envío');
    }), /falló el envío/);

    assert.equal(await delivery.sendOnce(async () => {
        sends++;
    }), true);
    assert.equal(sends, 2);
    assert.equal(await delivery.sendOnce(async () => {
        sends++;
    }), false);
    assert.equal(sends, 2);
});
