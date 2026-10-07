'use strict';

const STARTER_TOOLS = Object.freeze({
    pico: Object.freeze({ durability: 15, maxDurability: 15 }),
    espada: Object.freeze({ durability: 12, maxDurability: 12 }),
    cana: Object.freeze({ durability: 15, maxDurability: 15 })
});

function grantStarterPackToWallet(wallet) {
    if (!wallet || typeof wallet !== 'object' || wallet.starterPackClaimed) return false;

    wallet.coins = Math.max(0, Number(wallet.coins) || 0) + 1000;
    if (!wallet.tools || typeof wallet.tools !== 'object' || Array.isArray(wallet.tools)) wallet.tools = {};
    for (const [key, tool] of Object.entries(STARTER_TOOLS)) {
        const current = wallet.tools[key];
        if (!current || typeof current !== 'object' || !(Number(current.durability) > 0)) {
            wallet.tools[key] = { ...tool };
        } else {
            current.maxDurability = Math.max(Number(current.maxDurability) || 0, tool.maxDurability);
        }
    }
    wallet.starterPackClaimed = true;
    wallet.starterPackGrantedAt = new Date().toISOString();
    return true;
}

module.exports = { grantStarterPackToWallet, STARTER_TOOLS };
