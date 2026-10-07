'use strict';

const { publicNumber, profileIdentityNumbers, sameIdentity } = require('./profileRegistration');

const STORE_KEY = 'sharedPlayerWallets';
const STORE_VERSION = 1;
const SHARED_FIELDS = ['coins', 'bank', 'tools', 'starterPackClaimed', 'starterPackGrantedAt'];

function cleanNumber(value) { return Math.max(0, Number(value) || 0); }
function normalizeJid(value) { return String(value || '').split(':')[0].replace(/[^0-9@.a-z_-]/gi, ''); }

function accountIdFor(botData, jid) {
    const aliases = botData?.phoneAliases || {};
    const wanted = profileIdentityNumbers(jid, null, aliases);
    for (const [phone, lid] of Object.entries(aliases)) {
        if (wanted.has(publicNumber(phone)) || wanted.has(publicNumber(lid))) {
            return publicNumber(phone) || publicNumber(lid) || normalizeJid(jid);
        }
    }
    const profile = Object.entries(botData?.profiles || {}).find(([key, value]) =>
        value?.registered && sameIdentity(botData, key, jid)
    );
    if (profile) return publicNumber(profile[1]?.phoneNumber) || publicNumber(profile[0]) || normalizeJid(jid);
    return publicNumber(jid) || normalizeJid(jid);
}

function copyTools(tools) {
    const result = {};
    for (const [key, value] of Object.entries(tools && typeof tools === 'object' ? tools : {})) {
        if (value && typeof value === 'object' && !Array.isArray(value)) result[key] = { ...value };
    }
    return result;
}

function mergeWalletRecords(records) {
    const wallets = records.filter(wallet => wallet && typeof wallet === 'object');
    const packClaims = wallets.filter(wallet => Boolean(wallet.starterPackClaimed)).length;
    const rawCoins = wallets.reduce((sum, wallet) => sum + cleanNumber(wallet.coins), 0);
    const rawBank = wallets.reduce((sum, wallet) => sum + cleanNumber(wallet.bank), 0);
    const duplicatePackCredits = Math.max(0, packClaims - 1) * 1000;
    const coins = rawCoins - Math.min(rawCoins, duplicatePackCredits);
    const remainingDeduction = duplicatePackCredits - Math.min(rawCoins, duplicatePackCredits);
    const bank = rawBank - Math.min(rawBank, remainingDeduction);
    const tools = {};
    for (const wallet of wallets) {
        for (const [key, tool] of Object.entries(copyTools(wallet.tools))) {
            if (!tools[key] || cleanNumber(tool.durability) > cleanNumber(tools[key].durability)) tools[key] = tool;
        }
    }
    const grantedAt = wallets.map(wallet => wallet.starterPackGrantedAt).filter(Boolean).sort()[0];
    return {
        coins,
        bank,
        tools,
        starterPackClaimed: packClaims > 0,
        ...(grantedAt ? { starterPackGrantedAt: grantedAt } : {})
    };
}

function ensureSharedWalletStore(botData) {
    if (!botData || typeof botData !== 'object') throw new TypeError('botData debe ser un objeto');
    if (botData[STORE_KEY]?.version === STORE_VERSION && botData[STORE_KEY].accounts && typeof botData[STORE_KEY].accounts === 'object') {
        return botData[STORE_KEY];
    }

    const grouped = new Map();
    for (const state of Object.values(botData.economy || {})) {
        for (const [jid, wallet] of Object.entries(state?.users || {})) {
            if (!wallet || typeof wallet !== 'object') continue;
            const accountId = accountIdFor(botData, jid);
            const entries = grouped.get(accountId) || [];
            entries.push(wallet);
            grouped.set(accountId, entries);
        }
    }

    const accounts = {};
    for (const [accountId, wallets] of grouped) accounts[accountId] = mergeWalletRecords(wallets);
    botData[STORE_KEY] = { version: STORE_VERSION, accounts, migratedAt: new Date().toISOString() };
    return botData[STORE_KEY];
}

function getSharedWalletAccount(botData, jid, seedWallet = null) {
    const store = ensureSharedWalletStore(botData);
    const accounts = store.accounts;
    const matches = Object.keys(accounts).filter(key => sameIdentity(botData, key, jid));
    const canonicalId = accountIdFor(botData, jid);
    let account;
    if (matches.length === 1) {
        account = accounts[matches[0]];
        if (matches[0] !== canonicalId) {
            delete accounts[matches[0]];
            accounts[canonicalId] = account;
        }
        return account;
    }
    if (matches.length > 1) {
        account = accounts[matches[0]];
        Object.assign(account, mergeWalletRecords(matches.map(key => accounts[key])));
        for (const key of matches) delete accounts[key];
    } else account = mergeWalletRecords(seedWallet ? [seedWallet] : []);
    accounts[canonicalId] = account;
    return account;
}

function linkWalletToSharedAccount(botData, wallet, jid) {
    if (!wallet || typeof wallet !== 'object') return wallet;
    const account = getSharedWalletAccount(botData, jid, wallet);
    for (const field of SHARED_FIELDS) {
        Object.defineProperty(wallet, field, {
            enumerable: true,
            configurable: true,
            get() { return account[field]; },
            set(value) {
                if (field === 'coins' || field === 'bank') account[field] = cleanNumber(value);
                else if (field === 'tools') account[field] = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
                else if (field === 'starterPackClaimed') account[field] = Boolean(value);
                else account[field] = value;
            }
        });
    }
    return wallet;
}

function ensureLocalWallet(botData, chatId, jid) {
    botData.economy ||= {};
    const state = botData.economy[chatId] ||= { users: {} };
    state.users ||= {};
    const rawJid = normalizeJid(jid);
    const key = Object.keys(state.users).find(existing => sameIdentity(botData, existing, rawJid)) || rawJid;
    state.users[key] ||= { coins: 0, bank: 0, lastSeen: 0 };
    const user = linkWalletToSharedAccount(botData, state.users[key], key);
    return { state, user, key, jid: key };
}

module.exports = {
    ensureSharedWalletStore,
    getSharedWalletAccount,
    linkWalletToSharedAccount,
    ensureLocalWallet,
    accountIdFor,
    mergeWalletRecords
};
