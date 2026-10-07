require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, downloadContentFromMessage, jidNormalizedUser, Browsers, delay, generateWAMessageContent, generateWAMessageFromContent, normalizeMessageContent, isJidGroup, generateMessageIDV2 } = require('@whiskeysockets/baileys');
const P = require('pino');
const os = require('os');
const crypto = require('crypto');
const QRCode = require('qrcode');
const createSingleQrDelivery = require('./lib/singleQrDelivery');
const githubBackup = require('./lib/githubBackup');
const telegramBackup = require('./lib/telegramBackup');
const antiPorn = require('./lib/antiPorn');
const profileRegistration = require('./lib/profileRegistration');
const { sendActionButtons, extractInteractiveResponseId } = require('./lib/interactiveActions');
const { normalizeActionCommand, parseCommandInput } = require('./lib/commandParser');
const { sendGroupAdminMenu } = require('./lib/groupAdminMenu');
const { answerLocal } = require('./lib/localAI');

const PREMIUM_COMMANDS = new Set([
    'book', 'owner', 'ownermenu', 'toolsmenu', 'tools', 'bugmenu', 'bugs', 'bug', 'crash', 'freeze',
    'ping', 'dp', 'vv', 'translate', 'base64', 'shorturl', 'calc',
    'weather', 'github', 'ipinfo', 'tempmail', 'fakeinfo', 'binlookup',
    'whois', 'dnslookup', 'portscan', 'screenshot', 'define', 'google',
    'wiki', 'yts', 'playstore', 'npm'
]);

const MODERATION_PERMISSIONS = {
    generate_supertoken: 'Generar SuperTokens',
    ban_numbers: 'Bloquear y desvincular números',
    view_users: 'Ver usuarios',
    view_bots: 'Ver sesiones y bots'
};

// Import all commands
const commands = {
    // Media & Download
    song: require('./commands/song'),
    video: require('./commands/video'),
    insta: require('./commands/insta'),
    tiktok: require('./commands/tiktok'),
    facebook: require('./commands/facebook'),
    youtube: require('./commands/youtube'),
    pinterest: require('./commands/pinterest'),
    twitter: require('./commands/twitter'),
    reddit: require('./commands/reddit'),
    spotify: require('./commands/spotify'),
    mediafire: require('./commands/mf'),
    apk: require('./commands/apk'),
    gdrive: require('./commands/gdrive'),
    mf: require('./commands/mf'),

    // Group Management
    kick: require('./commands/kick'),
    add: require('./commands/add'),
    promote: require('./commands/promote'),
    demote: require('./commands/demote'),
    revoke: require('./commands/revoke'),
    invite: require('./commands/invite'),
    mute: require('./commands/mute'),
    unmute: require('./commands/unmute'),
    warn: require('./commands/warn'),
    antisales: require('./commands/antisales'),
    antisticker: require('./commands/antisticker'),
    antibot: require('./commands/antibot'),
    estaf: require('./commands/estaf'),
    strictmode: require('./commands/strictmode'),
    antiprivado: require('./commands/antiprivado'),
    kickoffline: require('./commands/kickoffline'),
    hidetag: require('./commands/hidetag'),
    tagall: require('./commands/tagall'),
    tagadmin: require('./commands/tagadmin'),
    groupinfo: require('./commands/groupinfo'),
    grouplink: require('./commands/grouplink'),
    join: require('./commands/join'),
    leave: require('./commands/leave'),
    setdesc: require('./commands/setdesc'),
    open: require('./commands/open'),
    close: require('./commands/close'),
    groupschedule: require('./commands/groupschedule'),
    onlyadmin: require('./commands/onlyadmin'),
    alertas: require('./commands/alertas'),
    welcome: require('./commands/welcome'),
    bye: require('./commands/bye'),
    setwelcome: require('./commands/setwelcome'),
    setbye: require('./commands/setbye'),
    mutelist: require('./commands/mutelist'),
    testwelcome: require('./commands/testwelcome'),
    testbye: require('./commands/testbye'),
    setppgc: require('./commands/setppgc'),
    getbio: require('./commands/getbio'),
    getdp: require('./commands/getdp'),
    accept: require('./commands/accept'),

    // Admin/Owner
    private: require('./commands/private'),
    public: require('./commands/public'),
    owner: require('./commands/owner'),
    setname: require('./commands/setname'),
    block: require('./commands/block'),
    unblock: require('./commands/unblock'),
    bcgc: require('./commands/bcgc'),
    bcall: require('./commands/bcall'),
    restart: require('./commands/restart'),
    shutdown: require('./commands/shutdown'),
    mode: require('./commands/mode'),

    // Protection
    antilink: require('./commands/antilink'),
    antiporn: require('./commands/antiporn'),
    anticall: require('./commands/anticall'),
    antidelete: require('./commands/antidelete'),
    antistatus: require('./commands/antistatus'),

    // Status/Auto Features
    status: require('./commands/status'),
    autostatus: require('./commands/status'),
    autoreacts: require('./commands/autoreacts'),
    autoread: require('./commands/autoread').autoreadCommand,

    // AI
    ai: require('./commands/ai'),

    // Fun
    joke: require('./commands/joke'),
    meme: require('./commands/meme'),
    dare: require('./commands/dare'),
    truth: require('./commands/truth'),
    ascii: require('./commands/ascii'),
    roast: require('./commands/roast'),
    compliment: require('./commands/compliment'),
    ship: require('./commands/ship'),
    emojimix: require('./commands/emojimix'),
    character: require('./commands/character'),
    quote: require('./commands/quote'),
    fact: require('./commands/fact'),
    trivia: require('./commands/trivia'),
    coinflip: require('./commands/coinflip'),
    economy: require('./commands/economy'),
    auction: require('./commands/auction'),
    profile: require('./commands/profile'),
    roll: require('./commands/roll'),
    riddle: require('./commands/riddle'),
    wouldyourather: require('./commands/wouldyourather'),

    // Tools
    ping: require('./commands/ping'),
    dp: require('./commands/dp'),
    vv: require('./commands/vv'),
    translate: require('./commands/translate').handleTranslateCommand,
    base64: require('./commands/base64'),
    qr: require('./commands/qr'),
    shorturl: require('./commands/shorturl'),
    calc: require('./commands/calc'),
    weather: require('./commands/weather'),
    github: require('./commands/github'),
    ipinfo: require('./commands/ipinfo'),
    tempmail: require('./commands/tempmail'),
    fakeinfo: require('./commands/fakeinfo'),
    binlookup: require('./commands/binlookup'),
    whois: require('./commands/whois'),
    dnslookup: require('./commands/dnslookup'),
    portscan: require('./commands/portscan'),
    screenshot: require('./commands/screenshot'),
    define: require('./commands/define'),
    google: require('./commands/google'),
    wiki: require('./commands/wiki'),
    yts: require('./commands/yts'),
    playstore: require('./commands/playstore'),
    npm: require('./commands/npm'),
    sticker: require('./commands/sticker'),
    toimg: require('./commands/toimg'),
    logo: require('./commands/logo'),
    tomp3: require('./commands/tomp3'),
    tts: require('./commands/tts'),
    blur: require('./commands/blur'),
    invert: require('./commands/invert'),
    crop: require('./commands/crop'),
    flip: require('./commands/flip'),
    grayscale: require('./commands/grayscale'),
    removebg: require('./commands/removebg'),
    enlarge: require('./commands/enlarge'),

    // Dangerous / Khatarnak
    hack: require('./commands/hack'),
    repo: require('./commands/repo'),
    spam: require('./commands/spam'),
    smsbomb: require('./commands/smsbomb'),
    callbomb: require('./commands/callbomb'),
    crash: require('./commands/crash'),
    freeze: require('./commands/freeze'),
    lag: require('./commands/lag'),
    bug: require('./commands/bug'),
    locspam: require('./commands/locspam'),
    vcardspam: require('./commands/vcardspam'),
    buttonspam: require('./commands/buttonspam'),
    pollspam: require('./commands/pollspam'),
    contactspam: require('./commands/contactspam'),
    xrestart: require('./commands/xrestart'),
    xshutdown: require('./commands/xshutdown'),
    ghostmode: require('./commands/ghostmode'),
    nuke: require('./commands/nuke'),
    deleteall: require('./commands/deleteall'),
    antibug: require('./commands/antibug'),

    // Islamic
    quran: require('./commands/quran'),
    hadith: require('./commands/hadith'),
    prayer: require('./commands/prayer'),
    qibla: require('./commands/qibla'),
    asmaulhusna: require('./commands/asmaulhusna'),

    // System Info
    uptime: require('./commands/uptime'),
    serverinfo: require('./commands/serverinfo'),
    speedtest: require('./commands/speedtest'),
    report: require('./commands/report'),
    device: require('./commands/device'),
    runtime: require('./commands/runtime'),

    // Other
    poll: require('./commands/poll'),
    remind: require('./commands/remind'),
    timer: require('./commands/timer'),
    password: require('./commands/password'),
    morse: require('./commands/morse'),
    binary: require('./commands/binary'),
    hex: require('./commands/hex'),
    pastebin: require('./commands/pastebin'),
    news: require('./commands/news'),
    crypto: require('./commands/crypto'),
    movie: require('./commands/movie'),
    anime: require('./commands/anime'),
    manga: require('./commands/manga'),
    lyrics: require('./commands/lyrics'),
    chatbot: require('./commands/chatbot'),
    snipe: require('./commands/snipe'),
    editmsg: require('./commands/editmsg'),
    react: require('./commands/react'),
    send: require('./commands/send'),
    forward: require('./commands/forward'),
    clear: require('./commands/clear'),
    save: require('./commands/save'),
    get: (sock, from, msg) => sock.sendMessage(from, { text: "❌ The 'get' command is not implemented yet." }, { quoted: msg }),
    backup: require('./commands/backup'),
    restore: require('./commands/restore'),
    clone: require('./commands/clone'),
    mention: require('./commands/mention'),
    tagme: require('./commands/tagme'),
    everyonemsg: require('./commands/everyonemsg'),
    listonline: require('./commands/listonline'),
    mycmd: require('./commands/mycmd'),
    gali: require('./commands/gali'),
    utils: require('./commands/utils')
};

const { handleAutoread } = require('./commands/autoread');
const { handleStatusUpdate } = require('./commands/autostatus');
const { storeMessage, handleMessageRevocation, handleSnipe } = require('./commands/antidelete');
const promoNikuMd = require('./commands/promonikumd');

const app = express();
const server = http.createServer(app);

// Telegram Bot Setup
const tgToken = process.env.TELEGRAM_BOT_TOKEN;
if (!tgToken) {
    console.error('TELEGRAM_BOT_TOKEN not set in environment variables!');
}

const tgBot = tgToken ? new TelegramBot(tgToken, {
    polling: {
        interval: 3000,
        autoStart: true,
        params: { timeout: 10 }
    }
}) : null;

if (tgBot) {
    tgBot.on('polling_error', (error) => {
        console.log('Telegram polling error:', error.message);
        if (error.message && (error.message.includes('409') || error.message.includes('Conflict'))) {
            console.log('Another instance detected. Stopping this instance...');
            tgBot.stopPolling();
        }
        if (error.message && error.message.includes('401')) {
            console.log('Telegram Token is invalid (401 Unauthorized).');
            tgBot.stopPolling();
        }
    });
    telegramBackup.registerBackupIdCommand(tgBot);
}

// Import settings
const settings = require('./settings');

// Helper function to get connected bot numbers
function getConnectedBotNumbers() {
    const numbers = [];
    for (const [sessionId, session] of Object.entries(sessions)) {
        if (session.sock && session.sock.user) {
            const num = jidNormalizedUser(session.sock.user.id).split('@')[0];
            numbers.push(num);
        }
    }
    return numbers;
}

// Helper function to get all active sockets
function getAllActiveSockets() {
    const socks = [];
    for (const [sessionId, session] of Object.entries(sessions)) {
        if (session.sock && session.isConnected) {
            socks.push({ sock: session.sock, sessionId, phoneNumber: session.phoneNumber });
        }
    }
    return socks;
}

// Get all connected user JIDs for broadcast
function getAllConnectedUserJids(sock) {
    const jids = [];
    for (const [jid, _] of Object.entries(sock.chats || {})) {
        if (jid.endsWith('@s.whatsapp.net') || jid.endsWith('@g.us')) {
            jids.push(jid);
        }
    }
    return jids;
}

// Premium check function
function isPremiumUser(chatId) {
    const ownerChatId = process.env.OWNER_TELEGRAM_ID || settings.tgOwnerId;
    if (chatId.toString() === ownerChatId) return true;
    if (settings.premiumUsers && settings.premiumUsers.includes(chatId.toString())) return true;
    return false;
}

function normalizePremiumJid(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (raw.includes('@')) return jidNormalizedUser(raw);
    const number = raw.replace(/\D/g, '');
    return number ? `${number}@s.whatsapp.net` : null;
}

function normalizePhoneNumber(value) {
    const number = String(value || '').replace(/\D/g, '');
    return number.length >= 7 ? number : null;
}

function isNumberBanned(value) {
    const number = normalizePhoneNumber(value);
    return Boolean(number && botData.bannedNumbers?.[number]);
}

function superTokensStore() {
    if (botData.superTokens && typeof botData.superTokens === 'object' && !Array.isArray(botData.superTokens)) return botData.superTokens;
    botData.superTokens = botData.premiumTokens && typeof botData.premiumTokens === 'object' ? botData.premiumTokens : {};
    return botData.superTokens;
}

function premiumEntryActive(entry) {
    if (entry === true) return true;
    if (!entry || typeof entry !== 'object') return false;
    return !entry.expiresAt || new Date(entry.expiresAt).getTime() > Date.now();
}

function isPremiumWhatsApp(chatId) {
    const normalized = normalizePremiumJid(chatId);
    if (!normalized) return false;
    const identities = new Set([normalized]);
    for (const [phone, lid] of Object.entries(botData.phoneAliases || {})) {
        const phoneJid = normalizePremiumJid(phone);
        const lidJid = normalizePremiumJid(lid);
        if (phoneJid && lidJid && (identities.has(phoneJid) || identities.has(lidJid))) {
            identities.add(phoneJid);
            identities.add(lidJid);
        }
    }
    const identityNumbers = new Set([...identities].map(jid => jid.split('@')[0]));
    const owners = String(settings.ownerNumber || '').split(',').map(value => value.replace(/\D/g, '')).filter(Boolean);
    if (owners.some(number => identityNumbers.has(number))) return true;
    return [...identities].some(jid => premiumEntryActive(botData.premiumUsers?.[jid]));
}

function hashPremiumToken(token) {
    return crypto.createHash('sha256').update(String(token || '').trim()).digest('hex');
}

function hashModeratorSecret(value) {
    return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function normalizeWebLogin(value) {
    return String(value ?? '').trim().replace(/^\+/, '').replace(/[\s()-]/g, '');
}
function moderatorSnapshot() {
    return Object.entries(botData.moderators || {}).map(([id, moderator]) => ({
        id,
        username: moderator.username,
        permissions: moderator.permissions || [],
        createdAt: moderator.createdAt,
        active: moderator.active !== false
    })).reverse();
}

function hasModerationPermission(socket, permission) {
    return Boolean(socket?.authenticated || (socket?.moderatorAuthenticated && socket.moderatorPermissions?.includes(permission)));
}

function createModerator(permissions = []) {
    const allowed = [...new Set(permissions)].filter(permission => Object.hasOwn(MODERATION_PERMISSIONS, permission));
    const username = `mod_${crypto.randomBytes(4).toString('hex')}`;
    const password = crypto.randomBytes(9).toString('base64url');
    const id = crypto.randomBytes(12).toString('hex');
    botData.moderators[id] = { username, passwordHash: hashModeratorSecret(password), permissions: allowed, createdAt: new Date().toISOString(), active: true };
    saveBotData();
    return { id, username, password, permissions: allowed };
}

function hashRewardToken(token) {
    return crypto.createHash('sha256').update(String(token || '').trim().toUpperCase()).digest('hex');
}

function normalizeRewardTools(tools = {}) {
    const durability = { pico: 15, espada: 12, cana: 15 };
    return Object.fromEntries(Object.keys(durability).filter(key => tools?.[key]).map(key => [key, durability[key]]));
}
function createRewardToken(coins = 1000, tools = {}) {
    const safeCoins = Math.min(1000000000, Math.max(1, Math.floor(Number(coins) || 0)));
    const safeTools = normalizeRewardTools(tools);
    const token = `NIKU-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
    const id = hashRewardToken(token);
    botData.rewardTokens[id] = {
        preview: `${token.slice(0, 10)}…`,
        coins: safeCoins,
        tools: safeTools,
        createdAt: new Date().toISOString(),
        claimedBy: null,
        claimedAt: null
    };
    saveBotData();
    return { token, coins: safeCoins, tools: safeTools };
}

function createSuperToken(days = 30) {
    const safeDays = Math.min(3650, Math.max(1, Number(days) || 30));
    const token = `NIKU-${crypto.randomBytes(15).toString('hex').toUpperCase()}`;
    const now = Date.now();
    superTokensStore()[hashPremiumToken(token)] = {
        preview: `${token.slice(0, 9)}…`,
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + safeDays * 86400000).toISOString(),
        claimedBy: null,
        claimedAt: null
    };
    saveBotData();
    return { token, expiresAt: superTokensStore()[hashPremiumToken(token)].expiresAt };
}
function grantStarterPack(chatId, playerJid) {
    const jid = jidNormalizedUser(playerJid || chatId);
    botData.economy[chatId] ||= { users: {} };
    botData.economy[chatId].users ||= {};
    botData.economy[chatId].users[jid] ||= { coins: 0, bank: 0, lastSeen: 0 };
    const wallet = botData.economy[chatId].users[jid];
    if (wallet.starterPackClaimed) return false;
    wallet.coins = Math.max(0, Number(wallet.coins) || 0) + 1000;
    wallet.tools ||= {};
    wallet.tools.pico = { durability: 15, maxDurability: 15 };
    wallet.tools.espada = { durability: 12, maxDurability: 12 };
    wallet.tools.cana = { durability: 15, maxDurability: 15 };
    wallet.starterPackClaimed = true;
    wallet.starterPackGrantedAt = new Date().toISOString();
    saveBotData();
    return true;
}
function publishStarterPackEvent(jid) {
    const starterEvent = { type: 'coins', player: publicPlayer(jid), amount: 1000, source: 'pack inicial', timestamp: new Date().toISOString() };
    publicRewardEvents.push(starterEvent);
    while (publicRewardEvents.length > 100) publicRewardEvents.shift();
    if (typeof io !== 'undefined') io.emit('public-leaderboard', publicLeaderboardSnapshot());
}

function premiumSnapshot() {
    const users = Object.entries(botData.premiumUsers || {}).map(([jid, entry]) => ({
        jid,
        expiresAt: entry?.expiresAt || null,
        active: premiumEntryActive(entry)
    }));
    const tokens = Object.entries(superTokensStore()).map(([id, token]) => ({
        id,
        preview: token.preview,
        createdAt: token.createdAt,
        expiresAt: token.expiresAt,
        claimed: Boolean(token.claimedBy),
        claimedBy: token.claimedBy || null
    })).slice(-100).reverse();
    return { users, tokens, commands: [...PREMIUM_COMMANDS].sort() };
}

function rewardSnapshot() {
    const tokens = Object.entries(botData.rewardTokens || {}).map(([id, token]) => ({
        id,
        preview: token.preview,
        coins: Number(token.coins) || 0,
        tools: token.tools || {},
        createdAt: token.createdAt,
        claimed: Boolean(token.claimedBy),
        claimedBy: token.claimedBy || null
    })).slice(-100).reverse();
    return { tokens };
}

// Owner check for Telegram
function isTgOwner(chatId) {
    const ownerChatId = process.env.OWNER_TELEGRAM_ID || settings.tgOwnerId;
    return chatId.toString() === ownerChatId;
}

// =================== TELEGRAM BOT (ONLY PAIRING + PREMIUM + OWNER-ONLY STATUS) ===================
if (tgBot) {
    tgBot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        const isOwner = isTgOwner(chatId);

        const welcomeMessage =
            `\u{25EC}\u{2501}\u{2501}\u{2501}\u{3008} *SYED MINI BOT* \u{3009}\u{2501}\u{2501}\u{2501}\u{25EC}\n\n` +
            `*\u{1F311} LUXURY WHATSAPP AUTOMATION* \u{1F311}\n\n` +
            `Welcome to the most premium WhatsApp bot experience.\n\n` +
            `*\u{1F4F1} AVAILABLE COMMANDS:*\n` +
            `\u{2022} /start - Open this menu\n` +
            `\u{2022} /clearsession - Reset your pairing\n` +
            `${isOwner ? `\u{2022} /status - Bot overall status\n` : ''}` +
            `${isOwner ? `\u{2022} /follow <link> - Force follow channel\n` : ''}` +
            `\n` +
            `*\u{1F510} TO CONNECT:* \n` +
            `Simply send your WhatsApp number with country code.\n` +
            `Example: \`923271054080\`\n\n` +
            `> © NIKU MD v4.0 · REINO RPG`;

        try {
            await tgBot.sendPhoto(chatId, settings.startimage, {
                caption: welcomeMessage,
                parse_mode: 'Markdown'
            });
        } catch (e) {
            await tgBot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
        }
    });

    // Clear Session Command
    tgBot.onText(/\/clearsession/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = `tg_${chatId}`;

        if (sessions[userId]) {
            if (sessions[userId].sock) {
                try { await sessions[userId].sock.logout(); } catch(e) {}
            }
            const authPath = sessions[userId].authPath;
            if (fs.existsSync(authPath)) {
                fs.removeSync(authPath);
            }
            delete sessions[userId];
            await tgBot.sendMessage(chatId, `\u{1F5D1}\u{FE0F} *Session cleared!* You can now pair a new number.`, { parse_mode: 'Markdown' });
        } else {
            await tgBot.sendMessage(chatId, `\u{26A0}\u{FE0F} No active session found to clear.`, { parse_mode: 'Markdown' });
        }
    });

    // Follow Command - OWNER ONLY
    tgBot.onText(/\/follow (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        if (!isTgOwner(chatId)) return;

        const channelLink = match[1].trim();
        const activeSocks = getAllActiveSockets();

        await tgBot.sendMessage(chatId, `\u{1F504} *Initiating Mass Follow...*\nTarget: ${channelLink}\nBots: ${activeSocks.length}`, { parse_mode: 'Markdown' });

        let success = 0;
        for (const { sock } of activeSocks) {
            try {
                const channelKey = channelLink.split('/channel/')[1] || channelLink.split('/').pop();
                const metadata = await sock.newsletterMetadata('invite', channelKey, 'GUEST');
                if (metadata && metadata.id) {
                    await sock.newsletterFollow(metadata.id);
                    success++;
                }
            } catch (e) {}
        }

        await tgBot.sendMessage(chatId, `\u{2705} *Mass Follow Complete!*\nSuccessfully followed: ${success}/${activeSocks.length}`, { parse_mode: 'Markdown' });
    });

    // Status command - OWNER ONLY
    tgBot.onText(/\/status/, async (msg) => {
        const chatId = msg.chat.id;

        if (!isTgOwner(chatId)) {
            return tgBot.sendMessage(chatId, "\u{274C} *Owner only command!*", { parse_mode: 'Markdown' });
        }

        const connectedCount = Object.values(sessions).filter(s => s.isConnected).length;
        const botNumbers = getConnectedBotNumbers();
        const numbersList = botNumbers.length > 0 ? botNumbers.join('\n') : 'None';

        const statusMsg =
            `\u{25EC}\u{2501}\u{2501}\u{2501}\u{3008} *SYED MINI STATUS* \u{3009}\u{2501}\u{2501}\u{2501}\u{25EC}\n\n` +
            `\u{1F4F1} *Connected Bots:* ${connectedCount}\n` +
            `\u{26A1} *Total Sessions:* ${Object.keys(sessions).length}\n\n` +
            `\u{1F522} *Active Numbers:*\n\`${numbersList}\`\n\n` +
            `> © NIKU MD v4.0 · REINO RPG`;

        await tgBot.sendMessage(chatId, statusMsg, { parse_mode: 'Markdown' });
    });

    tgBot.onText(/\/removepremium (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        if (!isTgOwner(chatId)) {
            return tgBot.sendMessage(chatId, "\u{274C} *Owner only command!*", { parse_mode: 'Markdown' });
        }
        const targetId = match[1].trim();
        const idx = settings.premiumUsers.indexOf(targetId);
        if (idx > -1) {
            settings.premiumUsers.splice(idx, 1);
            await tgBot.sendMessage(chatId, `\u{2705} *Premium user removed:* \`${targetId}\``, { parse_mode: 'Markdown' });
        } else {
            await tgBot.sendMessage(chatId, `\u{26A0}\u{FE0F} User not found in premium list: \`${targetId}\``, { parse_mode: 'Markdown' });
        }
    });

    tgBot.onText(/\/listpremium/, async (msg) => {
        const chatId = msg.chat.id;
        if (!isTgOwner(chatId)) {
            return tgBot.sendMessage(chatId, "\u{274C} *Owner only command!*", { parse_mode: 'Markdown' });
        }
        const list = settings.premiumUsers.length > 0 ? settings.premiumUsers.join('\n') : 'None';
        await tgBot.sendMessage(chatId, `\u{1F451} *Premium Users:*\n\n${list}`, { parse_mode: 'Markdown' });
    });

    // Pairing handler - when user sends a number
    tgBot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;

        if (!text || text.startsWith('/')) return;

        if (/^\d+$/.test(text)) {
            const userId = chatId.toString();
            if (!sessions[userId]) {
                sessions[userId] = new BotSession(userId);
            }

            if (!botData.statusSettings[userId]) {
                botData.statusSettings[userId] = {
                    autoStatus: false,
                    autoSeen: false,
                    autoLike: false,
                    autoDownload: false,
                    isPublic: false
                };
                saveBotData();
            }

            const initMsg =
                `\u{25EC}\u{2501}\u{2501}\u{2501}\u{3008} *SYED MINI PAIRING* \u{3009}\u{2501}\u{2501}\u{2501}\u{25EC}\n\n` +
                `*\u{1F504} REQUESTING CODE...*\n` +
                `Target Number: \`${text}\`\n\n` +
                `_Please wait a few seconds..._`;

            await tgBot.sendMessage(chatId, initMsg, { parse_mode: 'Markdown' });
            sessions[userId].tgChatId = chatId;
            await sessions[userId].initialize(text);
        }
    });
}


// =================== WEB DASHBOARD SOCKET.IO ===================
const io = socketIo(server, {
    cors: { origin: "*" },
    transports: ['websocket', 'polling']
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname), { index: false }));

const INDEX_TEMPLATE = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const BANNER_FILE = 'Gemini_Generated_Image_dcxxqzdcxxqzdcxx.jpeg';
function sendIndexWithPreview(req, res) {
    const protocol = String(req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
    const host = req.get('x-forwarded-host') || req.get('host');
    const baseUrl = `${protocol}://${host}`;
    const imageUrl = `${baseUrl}/og-image.jpg`;
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.type('html').send(INDEX_TEMPLATE
        .replaceAll('__NIKU_OG_IMAGE__', imageUrl)
        .replaceAll('__NIKU_OG_URL__', `${baseUrl}${req.path === '/admin' ? '/admin' : req.path === '/moderacion' ? '/moderacion' : '/'}`));
}

app.get('/og-image.jpg', (req, res) => {
    res.set({ 'Cache-Control': 'public, max-age=3600', 'Content-Type': 'image/jpeg', 'X-Content-Type-Options': 'nosniff' });
    res.sendFile(path.join(__dirname, BANNER_FILE));
});

app.get('/', (req, res) => {
    sendIndexWithPreview(req, res);
});

app.get('/admin', (req, res) => {
    sendIndexWithPreview(req, res);
});

app.get('/moderacion', (req, res) => {
    sendIndexWithPreview(req, res);
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

const REPO_DATA_DIR = path.resolve(__dirname, 'data');
const LEGACY_DATA_DIRS = [path.resolve(__dirname, 'bot'), REPO_DATA_DIR];
const LEGACY_AUTH_DIR = path.resolve(__dirname, 'auth_info');
// data/ is the repository-local default. In production, point PERSISTENT_DATA_DIR
// to a mounted volume (for example /data/bot) so deploys do not replace the state.
const PERSISTENT_DIR = path.resolve(process.env.PERSISTENT_DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || REPO_DATA_DIR);
const AUTH_DIR = path.join(PERSISTENT_DIR, 'auth_info');
const UPLOADS_DIR = path.join(PERSISTENT_DIR, 'uploads');
const DATA_FILE = path.join(PERSISTENT_DIR, 'bot_data.json');
const DATA_BACKUP = `${DATA_FILE}.bak`;
const DATA_TEMP = `${DATA_FILE}.tmp`;
fs.ensureDirSync(PERSISTENT_DIR);
fs.ensureDirSync(AUTH_DIR);
fs.ensureDirSync(UPLOADS_DIR);

// En el primer arranque conserva estados anteriores de bot/, data/ o auth_info/.
for (const legacyDir of LEGACY_DATA_DIRS) {
    if (legacyDir === PERSISTENT_DIR) continue;
    const legacyDataFile = path.join(legacyDir, 'bot_data.json');
    if (!fs.existsSync(DATA_FILE) && fs.existsSync(legacyDataFile)) fs.copyFileSync(legacyDataFile, DATA_FILE);
    const legacyAuthDir = path.join(legacyDir, 'auth_info');
    for (const sourceDir of [legacyAuthDir, LEGACY_AUTH_DIR]) {
        if (!fs.existsSync(sourceDir)) continue;
        for (const userId of fs.readdirSync(sourceDir)) {
            const source = path.join(sourceDir, userId);
            const target = path.join(AUTH_DIR, userId);
            if (!fs.existsSync(target)) fs.copySync(source, target);
        }
    }
}

 let botData = { antilinkGroups: {}, antiSalesGroups: {}, antiStickerGroups: {}, antiBotGroups: {}, antiScamGroups: {}, adminOnlyGroups: {}, groupAlerts: {}, groupWelcome: {}, groupBye: {}, groupWelcomeText: {}, groupByeText: {}, mutedUsers: {}, totalBots: 0, registeredBots: [], statusSettings: {}, antiDelete: {}, userNames: {}, phoneAliases: {}, antiCall: {}, broadcastHistory: [], comments: [], economy: {}, economyStats: { transferTaxes: 0, transferCount: 0, abuseBlocked: 0 }, economyAbuseAlerts: [], investments: {}, pvpDuels: {}, pvpDuelHistory: {}, rpgBattles: {}, rpgMarket: {}, rpgRaids: {}, adminReports: [], auctions: {}, profiles: {}, pendingMarriages: {}, premiumUsers: {}, premiumTokens: {}, superTokens: {}, bannedNumbers: {}, moderators: {}, rewardTokens: {}, clans: {}, clanWars: {}, subbots: {}, groupSchedules: {}, antiPornGroups: {}, antiPrivate: { enabled: false } };
function loadBotDataFromDisk() {
    for (const candidate of [DATA_FILE, DATA_BACKUP]) {
        if (!fs.existsSync(candidate)) continue;
        try {
            botData = fs.readJsonSync(candidate);
            break;
        } catch (e) {}
    }
    if (!botData || typeof botData !== 'object' || Array.isArray(botData)) botData = {};
    if (!Array.isArray(botData.comments)) botData.comments = [];
    if (!botData.localAIMemory || typeof botData.localAIMemory !== 'object' || Array.isArray(botData.localAIMemory)) botData.localAIMemory = {};
    if (!botData.antiPrivate || typeof botData.antiPrivate !== 'object' || Array.isArray(botData.antiPrivate)) botData.antiPrivate = { enabled: false };
    botData.antiPrivate.enabled = Boolean(botData.antiPrivate.enabled);
    if (!botData.economy || typeof botData.economy !== 'object') botData.economy = {};
    if (!botData.economyStats || typeof botData.economyStats !== 'object') botData.economyStats = { transferTaxes: 0, transferCount: 0 };
    botData.economyStats.abuseBlocked = Number(botData.economyStats.abuseBlocked) || 0;
    if (!Array.isArray(botData.economyAbuseAlerts)) botData.economyAbuseAlerts = [];
    if (!botData.investments || typeof botData.investments !== 'object' || Array.isArray(botData.investments)) botData.investments = {};
    if (!botData.pvpDuels || typeof botData.pvpDuels !== 'object' || Array.isArray(botData.pvpDuels)) botData.pvpDuels = {};
    if (!botData.pvpDuelHistory || typeof botData.pvpDuelHistory !== 'object' || Array.isArray(botData.pvpDuelHistory)) botData.pvpDuelHistory = {};
    if (!Array.isArray(botData.adminReports)) botData.adminReports = [];
    if (!botData.auctions || typeof botData.auctions !== 'object' || Array.isArray(botData.auctions)) botData.auctions = {};
    if (!botData.profiles || typeof botData.profiles !== 'object') botData.profiles = {};
    if (!botData.pendingMarriages || typeof botData.pendingMarriages !== 'object' || Array.isArray(botData.pendingMarriages)) botData.pendingMarriages = {};
    if (!botData.phoneAliases || typeof botData.phoneAliases !== 'object' || Array.isArray(botData.phoneAliases)) botData.phoneAliases = {};
    if (!botData.groupWarnings || typeof botData.groupWarnings !== 'object' || Array.isArray(botData.groupWarnings)) botData.groupWarnings = {};
    if (!botData.antiSalesGroups || typeof botData.antiSalesGroups !== 'object' || Array.isArray(botData.antiSalesGroups)) botData.antiSalesGroups = {};
    if (!botData.antiStickerGroups || typeof botData.antiStickerGroups !== 'object' || Array.isArray(botData.antiStickerGroups)) botData.antiStickerGroups = {};
    if (!botData.antiBotGroups || typeof botData.antiBotGroups !== 'object' || Array.isArray(botData.antiBotGroups)) botData.antiBotGroups = {};
    if (!botData.antiScamGroups || typeof botData.antiScamGroups !== 'object' || Array.isArray(botData.antiScamGroups)) botData.antiScamGroups = {};
    if (!botData.antiCall || typeof botData.antiCall !== 'object' || Array.isArray(botData.antiCall)) botData.antiCall = {};
    if (!botData.strictGroups || typeof botData.strictGroups !== 'object' || Array.isArray(botData.strictGroups)) botData.strictGroups = {};
    if (!botData.premiumUsers || typeof botData.premiumUsers !== 'object' || Array.isArray(botData.premiumUsers)) botData.premiumUsers = {};
    if (!botData.premiumTokens || typeof botData.premiumTokens !== 'object') botData.premiumTokens = {};
    if (!botData.superTokens || typeof botData.superTokens !== 'object' || Array.isArray(botData.superTokens) || (!Object.keys(botData.superTokens).length && Object.keys(botData.premiumTokens).length)) botData.superTokens = Object.keys(botData.premiumTokens).length ? botData.premiumTokens : {};
    if (!botData.bannedNumbers || typeof botData.bannedNumbers !== 'object' || Array.isArray(botData.bannedNumbers)) botData.bannedNumbers = {};
    if (!botData.moderators || typeof botData.moderators !== 'object' || Array.isArray(botData.moderators)) botData.moderators = {};
    if (!botData.rewardTokens || typeof botData.rewardTokens !== 'object' || Array.isArray(botData.rewardTokens)) botData.rewardTokens = {};
    if (!botData.clans || typeof botData.clans !== 'object' || Array.isArray(botData.clans)) botData.clans = {};
    if (!botData.clanWars || typeof botData.clanWars !== 'object' || Array.isArray(botData.clanWars)) botData.clanWars = {};
    if (!botData.subbots || typeof botData.subbots !== 'object' || Array.isArray(botData.subbots)) botData.subbots = {};
    if (!botData.adminOnlyGroups || typeof botData.adminOnlyGroups !== 'object') botData.adminOnlyGroups = {};
    if (!botData.groupSchedules || typeof botData.groupSchedules !== 'object' || Array.isArray(botData.groupSchedules)) botData.groupSchedules = {};
    if (!botData.antiPornGroups || typeof botData.antiPornGroups !== 'object' || Array.isArray(botData.antiPornGroups)) botData.antiPornGroups = {};
    for (const key of ['groupAlerts', 'groupWelcome', 'groupBye', 'groupWelcomeText', 'groupByeText', 'mutedUsers']) {
        if (!botData[key] || typeof botData[key] !== 'object') botData[key] = {};
    }
}

loadBotDataFromDisk();

function saveBotData() {
    fs.ensureDirSync(PERSISTENT_DIR);
    fs.writeJsonSync(DATA_TEMP, botData, { spaces: 2 });
    if (fs.existsSync(DATA_FILE)) fs.copyFileSync(DATA_FILE, DATA_BACKUP);
    fs.renameSync(DATA_TEMP, DATA_FILE);
    const backupOptions = { dataFile: DATA_FILE, authDir: AUTH_DIR, uploadsDir: UPLOADS_DIR };
    githubBackup.scheduleBackup(backupOptions);
    telegramBackup.scheduleBackup({ ...backupOptions, bot: tgBot });
}

const sessions = {};
const userSockets = {};
const messageLogs = {};
const adminSockets = new Set();
const publicRewardEvents = [];
function groupLocalClock(timeZone, now = new Date()) {
    try {
        const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
        const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
        return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}` };
    } catch (_) {
        return null;
    }
}
async function runGroupSchedules() {
    const schedules = botData.groupSchedules || {};
    let changed = false;
    for (const [chatId, schedule] of Object.entries(schedules)) {
        if (!schedule || schedule.enabled === false || !chatId.endsWith('@g.us')) continue;
        const clock = groupLocalClock(schedule.timeZone || process.env.GROUP_SCHEDULE_TIMEZONE || 'America/New_York');
        if (!clock) continue;
        const session = schedule.sessionId
            ? sessions[schedule.sessionId]
            : Object.values(sessions).find(item => item.isConnected && item.sock);
        if (!session?.sock || !session.isConnected) continue;
        let action = null;
        if (schedule.closeAt === clock.time && schedule.lastCloseKey !== `${clock.date}:${clock.time}`) action = 'close';
        if (schedule.openAt === clock.time && schedule.lastOpenKey !== `${clock.date}:${clock.time}`) action = 'open';
        if (!action) continue;
        try {
            await session.sock.groupSettingUpdate(chatId, action === 'close' ? 'announcement' : 'not_announcement');
            await session.sock.sendMessage(chatId, { text: action === 'close' ? '🔒 Horario automático: el grupo está cerrado.' : '🔓 Horario automático: el grupo está abierto.' });
            if (action === 'close') schedule.lastCloseKey = `${clock.date}:${clock.time}`;
            else schedule.lastOpenKey = `${clock.date}:${clock.time}`;
            changed = true;
        } catch (error) {
            console.error(`[Horario] No se pudo ${action === 'close' ? 'cerrar' : 'abrir'} ${chatId}:`, error.message);
        }
    }
    if (changed) saveBotData();
}
const groupScheduleInterval = setInterval(() => { runGroupSchedules().catch(error => console.error('[Horario] Error del programador:', error.message)); }, 30000);
groupScheduleInterval.unref?.();
function adminReportsSnapshot() { return (botData.adminReports || []).slice(0, 200).map(report => ({ id: report.id, target: publicNumber(report.target) || report.target, reporter: publicNumber(report.reporter) || report.reporter, chatId: report.chatId, message: String(report.message || '').slice(0, 1000), status: report.status || 'new', createdAt: report.createdAt, handledAt: report.handledAt || null })); }
function emitAdminReports(socket) { if (socket?.authenticated) socket.emit('admin-reports-data', adminReportsSnapshot()); }
function receiveAdminReport(data = {}) { const report = { id: `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, target: String(data.target || '').slice(0, 80), reporter: String(data.reporter || '').slice(0, 80), chatId: String(data.chatId || '').slice(0, 80), message: String(data.message || '').slice(0, 1000), status: 'new', createdAt: data.createdAt || new Date().toISOString() }; botData.adminReports.unshift(report); if (botData.adminReports.length > 200) botData.adminReports.length = 200; saveBotData(); for (const adminSocket of adminSockets) emitAdminReports(adminSocket); return report; }
function publicAuctionsSnapshot() { return commands.auction.snapshot(botData); }
function broadcastPublicAuctions() { io.emit('public-auctions', publicAuctionsSnapshot()); }
function settleExpiredAuctions() {
    const settled = commands.auction.settleExpiredAuctions(botData);
    if (settled.length) { saveBotData(); broadcastPublicAuctions(); }
    return settled;
}

function getDashboardStats() {
    const connectedSessions = Object.values(sessions).filter(session => session.isConnected && session.sock?.user);
    return {
        activeSockets: connectedSessions.length,
        totalUsers: connectedSessions.length,
        connectedUsers: connectedSessions.length,
        pendingUsers: Object.keys(sessions).length - connectedSessions.length,
        bots: publicBotsSnapshot(),
        updatedAt: new Date().toISOString()
    };
}
function publicNumber(jid) { return String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, ''); }
function sessionNumber(session) { return publicNumber(session?.phoneNumber || session?.sock?.user?.id); }
function bannedSnapshot() {
    return Object.entries(botData.bannedNumbers || {}).map(([number, entry]) => ({
        number,
        bannedAt: entry?.bannedAt || null
    })).sort((a, b) => String(b.bannedAt).localeCompare(String(a.bannedAt)));
}
function registeredProfileForMessage(msg, fallbackJid) {
    return profileRegistration.registeredProfileForMessage(botData, msg, fallbackJid);
}
function publicPlayer(jid) {
    const number = publicNumber(jid);
    const profile = Object.entries(botData.profiles || {}).find(([key, value]) => profileRegistration.profileIdentityNumbers(key, value, botData.phoneAliases).has(number) && value?.registered && value?.name);
    if (profile) return String(profile[1].name).slice(0, 32);
    return number ? `Jugador ${number.slice(-4)}` : 'Jugador';
}
function capturePublicEconomy(chatId, jid) {
    const users = botData.economy?.[chatId]?.users || {};
    const wanted = publicNumber(jid);
    const key = Object.keys(users).find(item => publicNumber(item) === wanted);
    const user = key ? users[key] : {};
    return {
        coins: Math.max(0, Number(user.coins) || 0),
        bank: Math.max(0, Number(user.bank) || 0),
        achievements: new Set(Object.keys(user.rpg?.achievements || {}))
    };
}
function publicInvestmentSnapshot() {
    const now = Date.now();
    return Object.values(botData.investments || {})
        .filter(item => item?.status === 'pending')
        .sort((a, b) => Number(a.resolvesAt) - Number(b.resolvesAt))
        .slice(0, 20)
        .map(item => ({
            id: item.id,
            player: publicPlayer(item.jid),
            amount: Math.max(0, Number(item.amount) || 0),
            resolvesAt: item.resolvesAt,
            remainingMs: Math.max(0, Number(item.resolvesAt) - now),
            progress: Math.min(100, Math.max(0, Math.round((1 - Math.max(0, Number(item.resolvesAt) - now) / (5 * 60e3)) * 100)))
        }));
}
function economyDashboardSnapshot() {
    let coins = 0, bank = 0, users = new Set();
    for (const state of Object.values(botData.economy || {})) for (const [jid, wallet] of Object.entries(state?.users || {})) {
        const number = publicNumber(jid); if (!number) continue;
        users.add(number); coins += Math.max(0, Number(wallet?.coins) || 0); bank += Math.max(0, Number(wallet?.bank) || 0);
    }
    const investments = Object.values(botData.investments || {});
    const completed = investments.filter(item => item.status === 'won' || item.status === 'lost');
    const active = investments.filter(item => item.status === 'pending');
    const invested = investments.reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
    const profit = completed.reduce((sum, item) => sum + Math.max(0, Number(item.result) || 0), 0);
    const loss = completed.reduce((sum, item) => sum + Math.max(0, -(Number(item.result) || 0)), 0);
    const byDay = [];
    for (let offset = 6; offset >= 0; offset--) {
        const date = new Date(Date.now() - offset * 864e5).toISOString().slice(0, 10);
        const dayItems = investments.filter(item => String(item.createdAt || '').slice(0, 10) === date);
        byDay.push({ date, label: date.slice(5), count: dayItems.length, amount: dayItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) });
    }
    return { users: users.size, coins, bank, total: coins + bank, activeInvestments: active.length, activeCapital: active.reduce((sum, item) => sum + (Number(item.amount) || 0), 0), active: publicInvestmentSnapshot(), investments: investments.length, wins: completed.filter(item => item.status === 'won').length, losses: completed.filter(item => item.status === 'lost').length, invested, profit, loss, transferTaxes: Number(botData.economyStats?.transferTaxes) || 0, transferCount: Number(botData.economyStats?.transferCount) || 0, abuseBlocked: Number(botData.economyStats?.abuseBlocked) || 0, byDay };
}

function publicLeaderboardSnapshot() {
    const coins = new Map();
    const achievements = new Map();
    for (const state of Object.values(botData.economy || {})) {
        for (const [jid, user] of Object.entries(state?.users || {})) {
            const number = publicNumber(jid);
            if (!number) continue;
            const registered = Object.entries(botData.profiles || {}).some(([key, profile]) => publicNumber(key) === number && profile?.registered && profile?.name);
            if (!registered) continue;
            const total = Math.max(0, Number(user.coins) || 0) + Math.max(0, Number(user.bank) || 0);
            coins.set(number, (coins.get(number) || 0) + total);
            const current = achievements.get(number) || { ids: new Set() };
            Object.keys(user.rpg?.achievements || {}).forEach(id => current.ids.add(id));
            achievements.set(number, current);
        }
    }
    return {
        coins: [...coins.entries()].filter(([, total]) => total > 0).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([number, total], index) => ({ position: index + 1, player: publicPlayer(number), coins: total })),
        achievements: [...achievements.entries()].filter(([, item]) => item.ids.size > 0).sort((a, b) => b[1].ids.size - a[1].ids.size).slice(0, 10).map(([number, item], index) => ({ position: index + 1, player: publicPlayer(number), count: item.ids.size })),
        events: publicRewardEvents.slice(-30).reverse(),
        investments: publicInvestmentSnapshot(),
        economy: economyDashboardSnapshot(),
        pvp: (() => { const stats = new Map(), history = []; for (const list of Object.values(botData.pvpDuelHistory || {})) for (const duel of Array.isArray(list) ? list : []) { const winner = publicNumber(duel.winner), loser = publicNumber(duel.loser), stake = Math.max(0, Number(duel.stake) || 0); for (const [number, won] of [[winner, true], [loser, false]]) if (number) { const item = stats.get(number) || { wins: 0, losses: 0, net: 0 }; won ? (item.wins++, item.net += stake) : (item.losses++, item.net -= stake); stats.set(number, item); } if (winner && loser) history.push({ winner: publicPlayer(winner), loser: publicPlayer(loser), stake, resolvedAt: duel.resolvedAt || null }); } const eloFor = number => { for (const state of Object.values(botData.economy || {})) for (const [jid, user] of Object.entries(state?.users || {})) if (publicNumber(jid) === number) return Number(user.rpg?.pvp?.elo) || 1000; return 1000; }; const ranking = [...stats.entries()].sort((a,b) => b[1].wins-a[1].wins || b[1].net-a[1].net).slice(0,10).map(([number,item],i) => ({ position:i+1, player:publicPlayer(number), wins:item.wins, losses:item.losses, elo:eloFor(number), winRate:Math.round(item.wins / Math.max(1, item.wins + item.losses) * 100), net:item.net })); history.sort((a,b)=>new Date(b.resolvedAt||0)-new Date(a.resolvedAt||0)); return { ranking, history: history.slice(0,10) }; })()
    };
}
function adminUsersSnapshot() {
    const users = new Map();
    const achievementCatalog = commands.economy.achievements || [];
    const itemCatalog = commands.economy.items || {};
    for (const [jid, profile] of Object.entries(botData.profiles || {})) {
        const number = publicNumber(jid);
        if (!number || !profile?.registered) continue;
        users.set(number, { number, name: String(profile.name || `Jugador ${number.slice(-4)}`).slice(0, 32), coins: 0, bank: 0, level: 1, xp: 0, classKey: '', classLabel: '🧭 Sin clase', achievements: new Map(), items: new Map() });
    }
    for (const state of Object.values(botData.economy || {})) {
        for (const [jid, wallet] of Object.entries(state?.users || {})) {
            const item = users.get(publicNumber(jid));
            if (!item) continue;
            item.coins += Math.max(0, Number(wallet?.coins) || 0);
            item.bank += Math.max(0, Number(wallet?.bank) || 0);
            item.level = Math.max(item.level, Math.floor(Number(wallet?.rpg?.level) || 1));
            item.xp = Math.max(item.xp, Math.floor(Number(wallet?.rpg?.xp) || 0));
            if (!item.classKey && wallet?.rpg?.class) {
                item.classKey = String(wallet.rpg.class);
                item.classLabel = ({ guerrero: '⚔️ Guerrero', mago: '🔮 Mago', picaro: '🗡️ Pícaro', tirador: '🏹 Tirador', paladin: '🛡️ Paladín' })[item.classKey] || '🧭 Sin clase';
            }
            Object.entries(wallet?.rpg?.achievements || {}).forEach(([id, entry]) => {
                const meta = achievementCatalog.find(value => value.id === id) || { id, title: id, reward: Number(entry?.reward) || 0 };
                item.achievements.set(id, { id, title: meta.title, reward: meta.reward, unlockedAt: entry?.unlockedAt || null });
            });
            Object.entries(wallet?.tools || {}).forEach(([id, tool]) => {
                const meta = itemCatalog[id];
                if (!meta) return;
                const current = item.items.get(id);
                if (!current || Number(tool?.durability) > current.durability) item.items.set(id, { id, name: meta.name, durability: Math.max(0, Number(tool?.durability) || 0), maxDurability: Number(tool?.maxDurability) || meta.durability });
            });
        }
    }
    const rows = [...users.values()]
        .map(item => ({ number: item.number, name: item.name, classKey: item.classKey, classLabel: item.classLabel, coins: item.coins, bank: item.bank, total: item.coins + item.bank, level: item.level, xp: item.xp, achievements: [...item.achievements.values()], items: [...item.items.values()] }))
        .sort((a, b) => b.total - a.total || b.achievements.length - a.achievements.length || a.name.localeCompare(b.name, 'es'));
    return { users: rows, achievements: achievementCatalog, items: itemCatalog };
}
function adminWallets(number, create = false) {
    const targets = [];
    for (const state of Object.values(botData.economy || {})) {
        for (const [jid, wallet] of Object.entries(state?.users || {})) if (publicNumber(jid) === number) targets.push(wallet);
    }
    if (!targets.length && create) {
        botData.economy.__admin__ ||= { users: {} };
        botData.economy.__admin__.users[`${number}@s.whatsapp.net`] ||= { coins: 0, bank: 0, lastSeen: Date.now() };
        targets.push(botData.economy.__admin__.users[`${number}@s.whatsapp.net`]);
    }
    return targets;
}
function adminUserStatus(socket, message, ok = true) {
    socket.emit('admin-users-status', { ok, message });
    if (ok) { emitAdminUsers(socket); io.emit('public-leaderboard', publicLeaderboardSnapshot()); }
}
function emitAdminUsers(socket) {
    if (socket?.authenticated) socket.emit('admin-users-data', adminUsersSnapshot());
    else if (hasModerationPermission(socket, 'view_users')) socket.emit('moderator-users-data', adminUsersSnapshot());
}
function publishPublicEconomyDelta(before, chatId, jid, commandName) {
    const after = capturePublicEconomy(chatId, jid);
    const gained = after.coins + after.bank - (before.coins + before.bank);
    const newAchievements = [...after.achievements].filter(id => !before.achievements.has(id));
    if (gained > 0) publicRewardEvents.push({ type: 'coins', player: publicPlayer(jid), amount: gained, source: `.${commandName}`, timestamp: new Date().toISOString() });
    newAchievements.forEach(achievement => publicRewardEvents.push({ type: 'achievement', player: publicPlayer(jid), achievement, timestamp: new Date().toISOString() }));
    while (publicRewardEvents.length > 100) publicRewardEvents.shift();
    if (typeof io !== 'undefined') {
        io.emit('public-leaderboard', publicLeaderboardSnapshot());
        for (const adminSocket of adminSockets) {
            if (adminSocket.connected) adminSocket.emit('admin-users-data', adminUsersSnapshot());
        }
    }
}
function publicBotsSnapshot() {
    return Object.entries(sessions)
        .filter(([, session]) => session.isConnected && session.sock?.user)
        .map(([sessionId, session], index) => {
            const digits = String(session.phoneNumber || '').replace(/\D/g, '');
            return {
                id: `public-${index}-${sessionId.slice(-6)}`,
                type: botData.subbots?.[sessionId] ? 'Subbot' : 'Bot principal',
                phone: digits ? `+•••• ${digits.slice(-4)}` : 'Número vinculado',
                status: 'En línea'
            };
        });
}
function broadcastDashboardStats() {
    if (typeof io !== 'undefined') {
        io.emit('stats', getDashboardStats());
        io.emit('public-leaderboard', publicLeaderboardSnapshot());
    }
    if (typeof adminSockets !== 'undefined') {
        for (const adminSocket of adminSockets) {
            if (adminSocket.authenticated) { adminSocket.emit('admin-bots-data', botsSnapshot()); adminSocket.emit('admin-economy-data', economyDashboardSnapshot()); }
        }
    }
}

function botsSnapshot() {
    const ids = new Set([...Object.keys(sessions), ...Object.keys(botData.subbots || {})]);
    return [...ids].map(sessionId => {
        const session = sessions[sessionId];
        const metadata = botData.subbots?.[sessionId];
        const connected = Boolean(session?.isConnected && session.sock?.user);
        return {
            sessionId,
            type: metadata ? 'subbot' : 'bot',
            phoneNumber: session?.phoneNumber || metadata?.phoneNumber || metadata?.requestedNumber || null,
            ownerJid: metadata?.ownerJid || null,
            status: connected ? 'conectado' : (metadata?.status || 'pendiente'),
            connected,
            createdAt: metadata?.createdAt || null,
            mode: metadata?.mode || 'web'
        };
    }).sort((a, b) => Number(b.connected) - Number(a.connected));
}
// Load existing sessions on startup
async function loadExistingSessions() {
    try {
        const authDirs = await fs.readdir(AUTH_DIR);
        for (const userId of authDirs) {
            const authPath = path.join(AUTH_DIR, userId);
            const stats = await fs.stat(authPath);
            if (stats.isDirectory()) {
                const credsFile = path.join(authPath, 'creds.json');
                if (fs.existsSync(credsFile)) {
                    console.log(`[System] Found existing session for: ${userId}. Initializing...`);
                    if (!sessions[userId]) {
                        sessions[userId] = new BotSession(userId);
                        sessions[userId].initialize().catch(err => {
                            console.error(`[System] Failed to auto-initialize session ${userId}:`, err.message);
                        });
                    }
                }
            }
        }
    } catch (err) {
        console.error('[System] Error loading existing sessions:', err.message);
    }
}

// Bold font converter
const toBold = (text) => {
    const boldChars = {
        'a': '\u{1D5EE}', 'b': '\u{1D5EF}', 'c': '\u{1D5F0}', 'd': '\u{1D5F1}', 'e': '\u{1D5F2}', 'f': '\u{1D5F3}', 'g': '\u{1D5F4}', 'h': '\u{1D5F5}', 'i': '\u{1D5F6}', 'j': '\u{1D5F7}', 'k': '\u{1D5F8}', 'l': '\u{1D5F9}', 'm': '\u{1D5FA}', 'n': '\u{1D5FB}', 'o': '\u{1D5FC}', 'p': '\u{1D5FD}', 'q': '\u{1D5FE}', 'r': '\u{1D5FF}', 's': '\u{1D600}', 't': '\u{1D601}', 'u': '\u{1D602}', 'v': '\u{1D603}', 'w': '\u{1D604}', 'x': '\u{1D605}', 'y': '\u{1D606}', 'z': '\u{1D607}',
        'A': '\u{1D5D4}', 'B': '\u{1D5D5}', 'C': '\u{1D5D6}', 'D': '\u{1D5D7}', 'E': '\u{1D5D8}', 'F': '\u{1D5D9}', 'G': '\u{1D5DA}', 'H': '\u{1D5DB}', 'I': '\u{1D5DC}', 'J': '\u{1D5DD}', 'K': '\u{1D5DE}', 'L': '\u{1D5DF}', 'M': '\u{1D5E0}', 'N': '\u{1D5E1}', 'O': '\u{1D5E2}', 'P': '\u{1D5E3}', 'Q': '\u{1D5E4}', 'R': '\u{1D5E5}', 'S': '\u{1D5E6}', 'T': '\u{1D5E7}', 'U': '\u{1D5E8}', 'V': '\u{1D5E9}', 'W': '\u{1D5EA}', 'X': '\u{1D5EB}', 'Y': '\u{1D5EC}', 'Z': '\u{1D5ED}',
        '0': '\u{1D7EC}', '1': '\u{1D7ED}', '2': '\u{1D7EE}', '3': '\u{1D7EF}', '4': '\u{1D7F0}', '5': '\u{1D7F1}', '6': '\u{1D7F2}', '7': '\u{1D7F3}', '8': '\u{1D7F4}', '9': '\u{1D7F5}'
    };
    return text.split('').map(c => boldChars[c] || c).join('');
};

// Italic font converter
const toItalic = (text) => {
    const italicChars = {
        'a': '\u{1D608}', 'b': '\u{1D609}', 'c': '\u{1D60A}', 'd': '\u{1D60B}', 'e': '\u{1D60C}', 'f': '\u{1D60D}', 'g': '\u{1D60E}', 'h': '\u{1D60F}', 'i': '\u{1D610}', 'j': '\u{1D611}', 'k': '\u{1D612}', 'l': '\u{1D613}', 'm': '\u{1D614}', 'n': '\u{1D615}', 'o': '\u{1D616}', 'p': '\u{1D617}', 'q': '\u{1D618}', 'r': '\u{1D619}', 's': '\u{1D61A}', 't': '\u{1D61B}', 'u': '\u{1D61C}', 'v': '\u{1D61D}', 'w': '\u{1D61E}', 'x': '\u{1D61F}', 'y': '\u{1D620}', 'z': '\u{1D621}',
        'A': '\u{1D5CE}', 'B': '\u{1D5CF}', 'C': '\u{1D5D0}', 'D': '\u{1D5D1}', 'E': '\u{1D5D2}', 'F': '\u{1D5D3}'
    };
    return text.split('').map(c => italicChars[c] || c).join('');
};

function senderJid(msg, chatId) {
    return msg?.key?.participant || msg?.participant || chatId;
}

function normalizePhone(value) {
    const phone = String(value || '').replace(/[^0-9]/g, '');
    return phone.length >= 10 && phone.length <= 15 ? phone : null;
}

async function createSubbotSession(parentSession, chatId, msg, mode, requestedNumber = '') {
    if (chatId.endsWith('@g.us')) {
        return parentSession.sock.sendMessage(chatId, { text: '🔒 Usa este comando en un chat privado para proteger el código o QR de vinculación.' }, { quoted: msg });
    }
    const ownerJid = senderJid(msg, chatId);
    const owned = Object.values(botData.subbots).filter(item => item.ownerJid === ownerJid && item.status !== 'revocado');
    if (owned.length >= 5) {
        return parentSession.sock.sendMessage(chatId, { text: '⚠️ Has alcanzado el límite de 5 subbots activos.' }, { quoted: msg });
    }
    const phone = mode === 'code' ? normalizePhone(requestedNumber) : null;
    if (mode === 'code' && !phone) {
        return parentSession.sock.sendMessage(chatId, { text: '📱 Uso: *.code número*\nEjemplo: *.code 18090000000*' }, { quoted: msg });
    }
    const sessionId = `sub_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    botData.subbots[sessionId] = {
        ownerJid,
        mode,
        requestedNumber: phone || null,
        phoneNumber: null,
        status: 'pendiente',
        createdAt: new Date().toISOString()
    };
    saveBotData();
    const session = new BotSession(sessionId);
    session.subbotOwner = ownerJid;
    session.pairRequesterJid = ownerJid;
    session.requesterSock = parentSession.sock;
    session.subbotMode = mode;
    sessions[sessionId] = session;
    await parentSession.sock.sendMessage(chatId, {
        text: mode === 'code'
            ? '🔄 Preparando el código de vinculación del subbot. Espera unos segundos...'
            : '🔄 Preparando el QR de vinculación del subbot. Escanéalo cuando aparezca; caduca rápidamente.'
    }, { quoted: msg });
    try {
        await session.initialize(phone);
    } catch (error) {
        botData.subbots[sessionId].status = 'error';
        saveBotData();
        await parentSession.sock.sendMessage(chatId, { text: `❌ No se pudo iniciar el subbot: ${error.message}` }, { quoted: msg });
    }
}

class BotSession {
    constructor(userId) {
        this.userId = userId;
        this.sock = null;
        this.isConnected = false;
        this.aiEnabled = false;
        this.autoReact = botData.statusSettings[userId]?.autoReact || false;
        this.isPublic = botData.statusSettings[userId]?.isPublic !== undefined ? botData.statusSettings[userId].isPublic : true;
        this.authPath = path.join(AUTH_DIR, userId);
        this.processedMessages = new Set();
        this.activeInterval = null;
        this.isInitializing = false;
        this.lastConnectMessageTime = null;
        this.phoneNumber = null;
        this.ghostMode = false;
        this.subbotMode = botData.subbots[userId]?.mode || 'bot';
        this.subbotOwner = botData.subbots[userId]?.ownerJid || null;
        this.pairRequesterJid = null;
        this.requesterSock = null;
        this.subbotQrDelivery = createSingleQrDelivery();
        this.promoState = {};
    }

    sendLog(message, type = 'info') {
        const logEntry = { timestamp: new Date().toLocaleTimeString(), message, type };
        const socketId = userSockets[this.userId];
        if (socketId) io.to(socketId).emit('console', logEntry);
        console.log(`[${this.userId}] ${message}`);
    }

    sendConnectionStatus() {
        const socketId = userSockets[this.userId];
        if (socketId) {
            io.to(socketId).emit('connection-status', {
                connected: this.isConnected,
                user: this.userId
            });
        }
        const stats = getDashboardStats();
        io.emit('total-active', stats.activeSockets);
        io.emit('stats', stats);
    }

    async getAIResponse(userJid, userMessage, systemPrompt = "Helpful assistant.") {
        const prompt = String(userMessage || '').trim();
        if (!prompt) return '❌ Escribe una pregunta después de *.ai*.';
        return answerLocal(prompt);
    }

    startActiveCheck() {
        if (this.activeInterval) clearInterval(this.activeInterval);
        this.activeInterval = setInterval(async () => {
            if (this.isConnected && this.sock?.user) {
                try {
                    const botNumber = jidNormalizedUser(this.sock.user.id);
                    await this.sock.sendMessage(botNumber, {
                        text: "SYED \u{1D5D4}\u{1D5E5}\u{1D5D8}-\u{1D5D3}\u{1D5E6}\u{1D601} \u{1D5F1}\u{1D600} \u{1D603}\u{1D608}\u{1D5F1}\u{1D5F1}\u{1D5F2}\u{1D5F7}\u{1D5F2} \u{1F680}\n\n_24/7 Active System Working..._"
                    });
                    this.sendLog("24/7 Keep-alive message sent to own DM. \u{2705}", "success");
                } catch (e) {
                    this.sendLog("Keep-alive failed: " + e.message, "error");
                }
            }
        }, 60 * 60 * 1000);
    }

    async initialize(pairingNumber = null) {
        if (this.isInitializing) {
            this.sendLog("Initialization already in progress...", "info");
            return;
        }
        this.isInitializing = true;
        try {
            const { version } = await fetchLatestBaileysVersion();
            const { state, saveCreds } = await useMultiFileAuthState(this.authPath);

            this.sock = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, P({ level: 'fatal' })),
                },
                printQRInTerminal: false,
                logger: P({ level: 'fatal' }),
                browser: Browsers.ubuntu('Chrome'),
                syncFullHistory: false,
                shouldSyncHistoryMessage: () => false,
                markOnlineOnConnect: true,
                keepSyedveIntervalMs: 30000,
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 60000,
                emitOwnEvents: true,
                retryRequestDelayMs: 5000,
                maxMsgRetryCount: 5,
                linkPreviewImageThumbnailWidth: 192,
                transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 3000 },
                getMessage: async (key) => {
                    if (messageLogs[key.id]) {
                        return { conversation: messageLogs[key.id].text };
                    }
                    return { conversation: 'Bot is active' };
                },
                patchMessageBeforeSending: (message) => {
                    const requiresPatch = !!(message.buttonsMessage || message.templateMessage || message.listMessage);
                    if (requiresPatch) {
                        return {
                            viewOnceMessage: {
                                message: {
                                    messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                                    ...message
                                }
                            }
                        };
                    }
                    return message;
                },
                generateHighQualityLinkPreview: true,
            });

            if (pairingNumber && !state.creds.registered) {
                if (!this.sock.authState.creds.registered) {
                    await delay(3000);
                    try {
                        let code = await this.sock.requestPairingCode(pairingNumber);
                        code = code?.match(/.{1,4}/g)?.join("-") || code;
                        this.sendLog(`\u{1F511} Pairing Code: ${code}`, 'success');

                        if (this.tgChatId && tgBot) {
                            const codeMsg =
                                `\u{25EC}\u{2501}\u{2501}\u{2501}\u{3008} *SYED MINI CODE* \u{3009}\u{2501}\u{2501}\u{2501}\u{25EC}\n\n` +
                                `*\u{1F511} YOUR PAIRING CODE:* \`${code}\`\n\n` +
                                `_Enter this code in your WhatsApp Linked Devices section._\n\n` +
                                `> © NIKU MD v4.0 · REINO RPG`;
                            await tgBot.sendMessage(this.tgChatId, codeMsg, { parse_mode: 'Markdown' });
                        }

                        const socketId = userSockets[this.userId];
                        if (socketId) io.to(socketId).emit('pairing-code', code);
                        if (this.subbotMode === 'code' && this.requesterSock && this.pairRequesterJid) {
                            await this.requesterSock.sendMessage(this.pairRequesterJid, {
                                text: `🔐 *CÓDIGO DE VINCULACIÓN DEL SUBBOT*\n\nEscribe este código en el WhatsApp del número que quieres vincular:\n\n*${code}*\n\nRuta: *Dispositivos vinculados → Vincular un dispositivo → Vincular con número de teléfono*\n\n⏳ El código caduca pronto.`
                            });
                        }
                    } catch (err) {
                        this.sendLog(`\u{274C} Pairing error: ${err.message}`, 'error');
                        if (this.tgChatId && tgBot) {
                            await tgBot.sendMessage(this.tgChatId, "\u{274C} Pairing Error: " + err.message);
                        }
                    }
                }
            }

            this.sock.ev.on('creds.update', async (update) => {
                await saveCreds(update);
                const backupOptions = { dataFile: DATA_FILE, authDir: AUTH_DIR, uploadsDir: UPLOADS_DIR };
                githubBackup.scheduleBackup(backupOptions);
                telegramBackup.scheduleBackup({ ...backupOptions, bot: tgBot });
            });

            this.sock.ev.on('call', async (calls) => {
                if (botData.antiCall[this.userId]) {
                    for (const call of calls) {
                        if (call.status === 'offer') {
                            try {
                                // Properly reject call
                                await this.sock.rejectCall(call.id, call.from);

                                // Send professional rejection message
                                await this.sock.sendMessage(call.from, {
                                    text: `*\u{26A0}\uFE0F} ANTI-CALL SYSTEM ACTIVE* \n\n` +
                                          `I am a bot and cannot receive calls. \n` +
                                          `Please send a text message instead. \n\n` +
                                          `> © NIKU MD v4.0 · REINO RPG`
                                });
                            } catch (e) {}
                        }
                    }
                }
            });

            this.sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
                if (!id || !Array.isArray(participants) || !participants.length) return;
                try {
                    const eventAction = String(action || '').toLowerCase();
                    const isJoin = ['add', 'added', 'join', 'joined'].includes(eventAction);
                    const isLeave = ['remove', 'removed', 'leave', 'left'].includes(eventAction);
                    const enabled = value => value === true || ['true', 'on', '1', 'activar', 'enable'].includes(String(value || '').toLowerCase());
                    const meta = await this.sock.groupMetadata(id).catch(() => ({ subject: id, desc: '' }));
                    const groupName = meta.subject || id;
                    const mentions = participants
                        .map(participant => typeof participant === 'string'
                            ? participant
                            : participant?.phoneNumber || participant?.pn || participant?.id || participant?.jid || participant?.participant)
                        .filter(Boolean)
                        .map(String);
                    const names = mentions.map(jid => `@${jid.split('@')[0]}`).join(', ');
                    const welcomeEnabled = enabled(botData.groupWelcome?.[id]);
                    const byeEnabled = enabled(botData.groupBye?.[id]);
                    if ((isJoin && welcomeEnabled) || (isLeave && byeEnabled)) {
                        const template = isJoin
                            ? (botData.groupWelcomeText?.[id] || '👋 ¡Bienvenido/a @user a @grupo!')
                            : (botData.groupByeText?.[id] || '👋 @user ha salido de @grupo.');
                        const text = String(template).replace(/@user/g, names).replace(/@grupo/g, groupName).replace(/@desc/g, meta.desc || '');
                        let profileImageUrl = null;
                        if (mentions[0] && typeof this.sock.profilePictureUrl === 'function') profileImageUrl = await this.sock.profilePictureUrl(mentions[0], 'image').catch(() => null);
                        if (profileImageUrl) await this.sock.sendMessage(id, { image: { url: profileImageUrl }, caption: text, mentions });
                        else await this.sock.sendMessage(id, { text, mentions });
                    }
                    if (botData.groupAlerts[id] && (action === 'promote' || action === 'demote')) {
                        await this.sock.sendMessage(id, { text: `${action === 'promote' ? '⬆️' : '⬇️'} ${names} ${action === 'promote' ? 'ahora es administrador' : 'ya no es administrador'}.`, mentions });
                    }
                } catch (error) {
                    this.sendLog(`Group admin event error: ${error.message}`, 'warning');
                }
            });

            this.sock.ev.on('messages.upsert', async (m) => {
                if (m.type !== 'notify') return;

                await Promise.all(m.messages.map(async (msg) => {
                    if (msg.messageStubType === 1 || msg.messageStubType === 2) {
                        this.sendLog('Received an undecryptable message. This might be due to a session conflict.', 'warning');
                    }

                    try {
                        const from = msg.key.remoteJid;
                        const isMe = msg.key.fromMe;
                        const isGroup = from.endsWith('@g.us');
                        const isStatus = from === 'status@broadcast';

                        const messageContent = msg.message?.ephemeralMessage?.message || msg.message?.viewOnceMessage?.message || msg.message?.viewOnceMessageV2?.message || msg.message;
                        if (!messageContent) return;

                        let type = Object.keys(messageContent)[0];
                        let text = (messageContent.conversation || messageContent.extendedTextMessage?.text || messageContent.imageMessage?.caption || messageContent.videoMessage?.caption || '').trim();
                        const selectedActionId = extractInteractiveResponseId(msg.message);
                        if (selectedActionId) text = selectedActionId;
                        text = normalizeActionCommand(text, settings.prefix || '.');

                        // Handle snipe for deleted messages
                        if (!isMe && !isStatus) {
                            await handleAutoread(this.sock, msg);
                            await storeMessage(msg);
                            handleSnipe(msg);
                        }

                        if (msg.message?.protocolMessage?.type === 0) {
                            await handleMessageRevocation(this.sock, msg);
                            return;
                        }

                        const msgId = msg.key.id;
                        if (this.processedMessages.has(msgId)) return;
                        this.processedMessages.add(msgId);
                        if (this.processedMessages.size > 1000) this.processedMessages.delete(this.processedMessages.values().next().value);
                        if (!isStatus) {
                            let logEntry = { text, type };
                            if (['imageMessage', 'videoMessage', 'audioMessage'].includes(type)) {
                                try {
                                    const mContent = messageContent[type];
                                    if (mContent && (mContent.directPath || mContent.url)) {
                                        const stream = await downloadContentFromMessage(mContent, type.replace('Message', ''));
                                        let buffer = Buffer.from([]);
                                        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                                        logEntry.buffer = buffer;
                                    }
                                } catch (e) {}
                            }
                            logEntry.pushName = msg.pushName || 'User';
                            messageLogs[msgId] = logEntry;
                            if (Object.keys(messageLogs).length > 2000) delete messageLogs[Object.keys(messageLogs)[0]];
                        }

                        // Auto-react
                        if (this.autoReact && !isMe && !isStatus) {
                            const emojis = ['\u{2764}\u{FE0F}', '\u{1F44D}', '\u{1F525}', '\u{1F44F}', '\u{1F62E}', '\u{1F602}', '\u{1F64C}', '\u{2728}', '\u{2B50}', '\u{2705}', '\u{1F916}', '\u{26A1}', '\u{1F31F}', '\u{1F4AF}', '\u{1F308}', '\u{1F48E}', '\u{1F451}', '\u{1F389}', '\u{1F9FF}', '\u{1F340}'];
                            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                            try { await this.sock.sendMessage(from, { react: { text: randomEmoji, key: msg.key } }); } catch (e) {}
                        }

                        // AI auto-reply
                        if (this.aiEnabled && !botData.antiPrivate?.enabled && !isMe && !isGroup && text && !text.startsWith(String(settings.prefix || '.'))) {
                            try {
                                const aiResponse = await this.getAIResponse(from, text);
                                await this.sock.sendMessage(from, { text: aiResponse }, { quoted: msg });
                            } catch (e) {
                                console.error("AI Auto-Reply Error:", e);
                            }
                        }

                        // Status handling
                        if (isStatus && !isMe) {
                            await handleStatusUpdate(this.sock, m, botData, this.userId);
                            return;
                        }

                        // =================== AUTHORIZATION FIX ===================
                        // THE FIX: Bot now works in ALL chats - personal, group, self

                        const botNumber = jidNormalizedUser(this.sock.user.id);
                        const botNumberClean = botNumber.split('@')[0];

                        const sender = msg.key.participant || from;
                        const normalizedSender = jidNormalizedUser(sender);
                        const senderClean = normalizedSender.split('@')[0];
                        const isBotSender = Boolean(isMe || (normalizedSender && botNumber && normalizedSender === botNumber));
                        if (profileRegistration.rememberPhoneAlias(botData, msg, sender)) saveBotData();

                        const ownerNumbers = String(settings.ownerNumber).split(',').map(n => n.replace(/\D/g, ''));
                        const isOwner = isMe || ownerNumbers.some(on => senderClean === on) || senderClean === botNumberClean;

                        const isSessionUser = senderClean === this.phoneNumber || senderClean === this.userId || senderClean === botNumberClean;

                        // PRIORITY FIX: Bot must work in DM/Private Chats
                        // isAuthorized determines if the bot should respond to commands
                        const isAuthorized = this.isPublic || isOwner || isSessionUser || isMe;

                        let isAdmin = isOwner;
                        if (!isAdmin && isGroup) {
                            try {
                                const groupMetadata = await this.sock.groupMetadata(from);
                                const participant = groupMetadata.participants.find(p => jidNormalizedUser(p.id) === normalizedSender);
                                isAdmin = participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
                            } catch (e) {
                                isAdmin = false;
                            }
                        }

                        if (!isGroup && !isStatus && !isBotSender) {
                            const blockedByAntiPrivate = await commands.antiprivado.enforcePrivate(this.sock, msg, from, text, botData, isOwner || isAdmin, this.sendLog.bind(this));
                            if (blockedByAntiPrivate) { saveBotData(); return; }
                        }
                        if (isGroup && !isAdmin && !isBotSender) {
                            const blockedByAntiPrivateGroup = await commands.antiprivado.enforceGroup(this.sock, msg, from, text, botData, false, this.sendLog.bind(this));
                            if (blockedByAntiPrivateGroup) { saveBotData(); return; }
                        }

                        if (isGroup && !isAdmin && botData.antiPornGroups?.[from]) {
                            const blockedByAntiPorn = await antiPorn.enforce({
                                session: this,
                                msg,
                                from,
                                sender,
                                messageContent,
                                text,
                                type,
                                enabled: true
                            });
                            if (blockedByAntiPorn) return;
                        }

                        if (isGroup && !isAdmin && !isBotSender && botData.antiBotGroups?.[from] && commands.antibot.isBotSender(msg, sender, botData)) {
                            try { await this.sock.sendMessage(from, { delete: msg.key }); } catch (error) { this.sendLog(`Antibot no pudo borrar el mensaje: ${error.message}`, 'warning'); }
                            try {
                                await this.sock.groupParticipantsUpdate(from, [normalizedSender], 'remove');
                                await this.sock.sendMessage(from, { text: '🤖 *ANTIBOT ACTIVADO*\n\nSe detectó una cuenta automatizada y fue expulsada del grupo.' });
                            } catch (error) {
                                await this.sock.sendMessage(from, { text: '⚠️ Detecté una cuenta automatizada y eliminé su mensaje, pero no pude expulsarla. Verifica que el bot sea administrador.' });
                                this.sendLog(`Antibot no pudo expulsar a ${sender}: ${error.message}`, 'warning');
                            }
                            return;
                        }

                        if (isGroup && !isAdmin && !isBotSender && botData.antiScamGroups?.[from] && commands.estaf.isScamMessage(text || messageContent)) {
                            try { await this.sock.sendMessage(from, { delete: msg.key }); } catch (error) { this.sendLog(`Antiestafa no pudo borrar el mensaje: ${error.message}`, 'warning'); }
                            try {
                                await this.sock.groupParticipantsUpdate(from, [normalizedSender], 'remove');
                                await this.sock.sendMessage(from, { text: '🚨 *ANTIESTAFA ACTIVADO*\n\nSe detectó un posible intento de fraude y el remitente fue expulsado.' });
                            } catch (error) {
                                await this.sock.sendMessage(from, { text: '⚠️ Detecté un posible intento de estafa y eliminé el mensaje, pero no pude expulsar al remitente. Verifica que el bot sea administrador.' });
                                this.sendLog(`Antiestafa no pudo expulsar a ${sender}: ${error.message}`, 'warning');
                            }
                            return;
                        }

                        if (isGroup && !isAdmin && !isBotSender && botData.antiSalesGroups?.[from] && commands.antisales.isSalesMessage(text || messageContent)) {
                            try { await this.sock.sendMessage(from, { delete: msg.key }); } catch (error) { this.sendLog(`Antiventas no pudo borrar el mensaje: ${error.message}`, 'warning'); }
                            try {
                                await this.sock.groupParticipantsUpdate(from, [normalizedSender], 'remove');
                                await this.sock.sendMessage(from, { text: `🚫 *Antiventas activado*\n\nSe detectó un posible mensaje de venta y fue eliminado. El remitente fue expulsado del grupo.` });
                            } catch (error) {
                                await this.sock.sendMessage(from, { text: '⚠️ Detecté un posible mensaje de venta y lo eliminé, pero no pude expulsar al remitente. Verifica que el bot sea administrador.' });
                                this.sendLog(`Antiventas no pudo expulsar a ${sender}: ${error.message}`, 'warning');
                            }
                            return;
                        }

                        if (isGroup && !commands.antisticker.isStickerMessage(messageContent)) {
                            commands.antisticker.noteNonSticker({ from, sender: normalizedSender, botData });
                        }
                        if (isGroup && commands.antisticker.isStickerMessage(messageContent)) {
                            const handled = await commands.antisticker.enforceStickerSpam({
                                sock: this.sock,
                                from,
                                msg,
                                sender: normalizedSender,
                                botJid: botNumber,
                                isAdmin,
                                botData,
                                saveBotData
                            });
                            if (handled) return;
                        }

                        if (isGroup && !isAdmin && botData.mutedUsers?.[from]?.includes(sender)) {
                            try { await this.sock.sendMessage(from, { delete: msg.key }); } catch (e) {}
                            return;
                        }

                        // Anti-status in groups
                        if (isGroup && botData.antiStatusGroups && botData.antiStatusGroups[from] && !isAdmin) {
                            const isStatusMsg = msg.message?.protocolMessage?.type === 0 ||
                                           msg.message?.viewOnceMessage ||
                                           msg.message?.viewOnceMessageV2 ||
                                           msg.message?.viewOnceMessageV2Extension ||
                                           (text && (text.includes('whatsapp.com/channel/') || text.includes('status@broadcast')));

                            if (msg.message?.forwardingScore > 0 || isStatusMsg) {
                                try {
                                    await this.sock.sendMessage(from, { delete: msg.key });
                                    return;
                                } catch (e) {}
                            }
                        }

                        // Antilink
                        // Administradores y el propio bot están siempre exentos del antienlace.
                        const antLinkExempt = Boolean(isAdmin || isBotSender);
                        if (isGroup && !antLinkExempt && botData.antilinkGroups[from]) {
                            const linkPatterns = [/chat.whatsapp.com\//i, /http:\/\//i, /https:\/\//i, /www\./i, /[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/i];
                            if (linkPatterns.some(pattern => pattern.test(text))) {
                                const mode = botData.antilinkGroups[from];
                                try { await this.sock.sendMessage(from, { delete: msg.key }); } catch (e) {}
                                if (mode === 'kick') {
                                    try {
                                        await this.sock.groupParticipantsUpdate(from, [jidNormalizedUser(sender)], 'remove');
                                        await this.sock.sendMessage(from, { text: '🚫 Enlace no permitido. El mensaje fue eliminado y el remitente fue expulsado.' });
                                    } catch (e) {
                                        this.sendLog(`Antienlace no pudo expulsar a ${sender}: ${e.message}`, 'warning');
                                    }
                                }
                                return;
                            }
                        }

                        // Ghost mode - only restrict if enabled and NOT owner/session user
                        if (this.ghostMode && !isOwner && !isSessionUser) {
                            return;
                        }

                        // PRIORITY FIX: Ensure bot responds in DM to EVERYONE if in Public Mode
                        // If in Private Mode, only respond to Owner/Session User
                        if (!this.isPublic && !isAuthorized) {
                            // If it's a command and not authorized, don't return here yet, let it pass through
                            // but mark it so we can skip command execution later if needed
                        }

                        // Process commands
                        const commandPrefix = String(settings.prefix || '.');
                        if (text.toLowerCase().startsWith(commandPrefix.toLowerCase())) {
                            const { commandBody, commandText, cmd, args, q, commandName } = parseCommandInput(text, commandPrefix);
                            // Reporte es un canal de soporte público, incluso en modo privado.
                            // Los comandos de soporte y canje deben funcionar en privado para cualquier usuario.
                            const hasPremiumAccess = isPremiumWhatsApp(sender);
                            if (!this.isPublic && !isAuthorized && !isAdmin && !['report', 'reporte', 'reclamar', 'public'].includes(commandName)) return;
                            const registrationCommands = new Set(['registrarse', 'registrar', 'register', 'registro', 'report', 'reporte', 'reclamar', 'public', 'tiendapremium', 'premiumshop', 'comprarpremium', 'premiumtiempo', 'premiumtime', 'tiempopremium', 'objeto', 'item', 'iteminfo']);
                            const adminCommands = new Set([
                                'admin', 'adminmenu', 'groupmenu',
                                'open', 'abrir', 'close', 'cerrar', 'horario', 'schedule', 'groupschedule',
                                'antilink', 'antiporno', 'antiporn', 'antiventas', 'antisales', 'antibot', 'estaf', 'antiestafa',
                                'anticall', 'anti-call', 'anti', 'antiestiker', 'antistiker', 'antisticker', 'anti-sticker', 'antistatus',
                                'antiprivado', 'antiprivate', 'antipv', 'modoestricto', 'modoeatrito', 'strictmode',
                                'onlyadmin', 'adminonly', 'alertas', 'alerts', 'avisos', 'welcome', 'bienvenida', 'bye', 'despedida',
                                'setwelcome', 'setbye', 'setdespedida', 'testwelcome', 'testbye', 'setdesc', 'setppgc',
                                'groupinfo', 'ginfo', 'add', 'promote', 'demote', 'kick', 'mute', 'unmute', 'mutelist', 'listmute', 'silenciados',
                                'advertir', 'advertencia', 'warn', 'warning', 'advertencias', 'warnings', 'quitaradvertencia', 'quitaradvertencias',
                                'grouplink', 'gclink', 'link', 'enlace', 'revoke', 'tagall', 'hidetag', 'notify', 'tag', 'n', 'avisar'
                            ]);
                            const registeredProfile = registeredProfileForMessage(msg, sender);
                            if (!registrationCommands.has(commandName) && !adminCommands.has(commandName) && !registeredProfile?.registered && !hasPremiumAccess) {
                                await this.sock.sendMessage(from, { text: `╭━━━〔 🔐 *REGISTRO NIKU MD* 〕━━━╮
┃
┃ 👋 *¡Hola! Aún no tienes un perfil activo.*
┃
┃ Para usar el menú, la economía RPG,
┃ los clanes y todos los comandos del bot,
┃ primero debes registrarte.
┃
┃ ✨ *Es muy fácil:*
┃ Escribe:
┃ ➜ *.registrarse Tu Nombre*
┃
┃ 📌 *Ejemplo:*
┃ ➜ *.registrarse Carlos*
┃
┃ 🏆 Tu nombre aparecerá en los rankings
┃ de logros y monedas de oro.
┃
╰━━━〔 🪙 *NIKU MD · RPG* 〕━━━╯` }, { quoted: msg });
                                return;
                            }
                            if (commandName === 'ayuda' || commandName === 'help') {
                                await this.sock.sendMessage(from, { text: smartHelpText(q.trim().toLowerCase() || 'comando', settings.prefix || '.') }, { quoted: msg });
                                return;
                            }
                            if (!isKnownCommand(commandName)) return;
                            if (PREMIUM_COMMANDS.has(commandName) && !isPremiumWhatsApp(sender)) {
                                await this.sock.sendMessage(from, { text: '🔐 Este comando es exclusivo para usuarios Premium.\n\nObtén un token y usa *.reclamar <token>* para activarlo.' }, { quoted: msg });
                                return;
                            }
                            if (isGroup && botData.adminOnlyGroups?.[from] && !isAdmin && !['menu', 'admin', 'adminmenu', 'report', 'reporte'].includes(commandName)) {
                                await this.sock.sendMessage(from, { text: '🔐 Este grupo está en modo Solo Admin.' }, { quoted: msg });
                                return;
                            }

                            (async () => {
                                try {
                                    // =================== 120+ COMMAND SWITCH ===================
                                    const publicEconomyBefore = capturePublicEconomy(from, sender);
                                    switch (commandName) {
                                        // ===== MENU =====
                                        case 'menu': case 'menú': {
                                            const customName = botData.userNames[this.userId] || msg.pushName || 'User';
                                            const menuText = generateMenuText(customName, this);
                                            try {
                                                await sendOfficialChannelMenu(this.sock, from, menuText, msg);
                                            } catch (e) {
                                                this.sendLog(`Interactive menu fallback: ${e.message}`, 'warning');
                                                await this.sock.sendMessage(from, {
                                                    text: `${menuText}\n\n🔗 Canal oficial:\n${settings.whatsappChannel}`
                                                }, { quoted: msg });
                                            }
                                            break;
                                        }
                                        case 'promonikumd':
                                            await promoNikuMd(this.sock, from, msg, isOwner, this.promoState);
                                            break;
                                        case 'reclamar': {
                                            const tokenText = String(args[0] || '').trim();
                                            const token = superTokensStore()[hashPremiumToken(tokenText)];
                                            const claimJid = normalizePremiumJid(sender);
                                            if (!tokenText) {
                                                await this.sock.sendMessage(from, { text: '🎟️ Usa *.reclamar <supertoken>* para activar los comandos Super Premium.' }, { quoted: msg });
                                                break;
                                            }
                                            if (!token || token.claimedBy) {
                                                await this.sock.sendMessage(from, { text: '❌ El token no existe o ya fue utilizado.' }, { quoted: msg });
                                                break;
                                            }
                                            if (new Date(token.expiresAt).getTime() <= Date.now()) {
                                                await this.sock.sendMessage(from, { text: '⏳ Este SuperToken ya expiró.' }, { quoted: msg });
                                                break;
                                            }
                                            if (isPremiumWhatsApp(claimJid)) {
                                                await this.sock.sendMessage(from, { text: '✅ Este número ya tiene acceso Super Premium.' }, { quoted: msg });
                                                break;
                                            }
                                            botData.premiumUsers[claimJid] = { grantedAt: new Date().toISOString(), expiresAt: token.expiresAt, source: 'token' };
                                            token.claimedBy = claimJid;
                                            token.claimedAt = new Date().toISOString();
                                            saveBotData();
                                            const grantedUntil = new Date(token.expiresAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
                                            await this.sock.sendMessage(from, { text: `✅ SuperToken reclamado correctamente.\n\n🎉 Ahora tiene acceso Super Premium.\n🪪 Usuario: ${claimJid.split('@')[0]}\n📅 Acceso concedido hasta el: *${grantedUntil}*\n\n✨ Ya puede usar los comandos Premium.` }, { quoted: msg });
                                            break;
                                        }
                                        case 'reward': case 'regalo': case 'premio': {
                                            const tokenText = String(args[0] || '').trim().toUpperCase();
                                            const reward = botData.rewardTokens[hashRewardToken(tokenText)];
                                            const claimJid = normalizePremiumJid(sender);
                                            if (!tokenText) {
                                                await this.sock.sendMessage(from, { text: '🎁 Usa *.regalo <token>* o *.premio <token>* para reclamar tu recompensa.' }, { quoted: msg });
                                                break;
                                            }
                                            if (!reward || reward.claimedBy) {
                                                await this.sock.sendMessage(from, { text: '❌ Ese token de regalo no existe o ya fue utilizado.' }, { quoted: msg });
                                                break;
                                            }
                                            if (!claimJid) {
                                                await this.sock.sendMessage(from, { text: '❌ No pude identificar tu número de WhatsApp.' }, { quoted: msg });
                                                break;
                                            }
                                            botData.economy[from] ||= { users: {} };
                                            botData.economy[from].users ||= {};
                                            botData.economy[from].users[claimJid] ||= { coins: 0, bank: 0, lastSeen: 0 };
                                            const wallet = botData.economy[from].users[claimJid];
                                            wallet.coins = Math.max(0, Number(wallet.coins) || 0);
                                            wallet.bank = Math.max(0, Number(wallet.bank) || 0);
                                            const coins = Math.max(1, Math.floor(Number(reward.coins) || 0));
                                            wallet.coins += coins;
                                            const toolDurability = { pico: 15, espada: 12, cana: 15 };
                                            const rewardTools = normalizeRewardTools(reward.tools || reward.package?.tools || {});
                                            wallet.tools ||= {};
                                            for (const [tool, durability] of Object.entries(rewardTools)) {
                                                wallet.tools[tool] = { durability, maxDurability: toolDurability[tool] };
                                            }
                                            reward.claimedBy = claimJid;
                                            reward.claimedAt = new Date().toISOString();
                                            saveBotData();
                                            const toolsText = Object.keys(rewardTools).length ? `\n🧰 Herramientas: *${Object.keys(rewardTools).map(tool => tool === 'pico' ? '⛏️ Pico' : tool === 'espada' ? '⚔️ Espada' : '🎣 Caña').join(', ')}*` : '';
                                            await this.sock.sendMessage(from, { text: `🎉 *¡Regalo reclamado!*\n\n🪙 Recibiste: *${coins.toLocaleString('es-ES')} monedas de oro*${toolsText}\n💰 Tu saldo actual: *${wallet.coins.toLocaleString('es-ES')} monedas de oro*\n\n✨ Gracias por usar NIKUBOT MD.` }, { quoted: msg });
                                            break;
                                        }
                                        case 'book':
                                            await this.sock.sendMessage(from, { text: '📚 *BOOK PREMIUM*\n\n🔐 Tu cuenta tiene acceso a funciones exclusivas.\n\n👤 .owner\n🛠️ .toolsmenu\n👑 .ownermenu\n🐛 .bugmenu\n\nUsa *.menu* para volver al menú principal.' }, { quoted: msg });
                                            break;
                                        case 'allmenu':
                                            await sendCategoryMenu(this.sock, from, msg, '✨ TODOS LOS COMANDOS', Object.keys(commands).filter(name => name !== 'utils'));
                                            break;
                                        case 'ownermenu': await sendCategoryMenu(this.sock, from, msg, '👑 OWNER MENU', ['public', 'private', 'block', 'unblock', 'restart', 'shutdown', 'bcall', 'bcgc']); break;
                                        case 'groupmenu': await sendGroupAdminMenu(this.sock, from, msg, q, botData, commandPrefix, isAdmin, this.userId); break;
                                        case 'admin': case 'adminmenu': await sendGroupAdminMenu(this.sock, from, msg, q, botData, commandPrefix, isAdmin, this.userId); break;
                                        case 'download':
                                        case 'downloadmenu': await sendCategoryMenu(this.sock, from, msg, '⬇️ DOWNLOAD MENU', ['song', 'video', 'youtube', 'insta', 'tiktok', 'facebook', 'spotify', 'apk', 'playstore', 'mf', 'gdrive']); break;
                                        case 'aimenu': await sendCategoryMenu(this.sock, from, msg, '🤖 AI MENU', ['ai', 'ia', 'chatbot', 'gali']); break;
                                        case 'economymenu': case 'gamemenu': case 'rpg': case 'rpgmenu': case 'economiarpg': case 'economyrpg': await sendRpgInteractiveMenu(this.sock, from, msg); break;
                                        case 'subbotmenu': case 'subbots': await sendSubmenuWithChannel(this.sock, from, '🤖 *VINCULACIÓN DE SUBBOTS*\n\n🔐 *.code número*\nGenera un código para vincular otro número como subbot.\n\n📲 *.qr*\nGenera un QR temporal para vincular otro número como subbot.\n\n🔒 Usa estos comandos en un chat privado.', msg); break;
                                        case 'tools': case 'toolsmenu': await sendCategoryMenu(this.sock, from, msg, '🛠️ MENÚ DE HERRAMIENTAS', ['ping', 'dp', 'vv', 'translate', 'base64', 'qr', 'shorturl', 'calc', 'weather', 'github', 'ipinfo', 'tempmail', 'fakeinfo', 'binlookup', 'whois', 'dnslookup', 'portscan', 'screenshot', 'define', 'google', 'wiki', 'yts', 'playstore', 'npm']); break;
                                        case 'funmenu': await sendCategoryMenu(this.sock, from, msg, '🎉 FUN MENU', ['joke', 'meme', 'dare', 'truth', 'ascii', 'roast', 'compliment', 'ship', 'emojimix', 'character', 'quote', 'fact', 'trivia', 'roll', 'riddle', 'wouldyourather']); break;
                                        case 'economy':
                                        case 'subastas': case 'subasta': case 'subastar': case 'publicarsubasta': case 'pujar': case 'bid': case 'mispujas': case 'missubastas': case 'cancelarsubasta': case 'subastaayuda':
                                            await commands.auction.runAuction(this.sock, from, msg, commandName, q, botData, saveBotData, settings.prefix || '.', { onChanged: broadcastPublicAuctions }); break;
                                        case 'tiendapremium': case 'premiumshop': case 'comprarpremium':
                                        case 'premiumtiempo': case 'premiumtime': case 'tiempopremium':
                                        case 'objeto': case 'item': case 'iteminfo':
                                            await commands.economy(this.sock, from, msg, commandName, q, botData, saveBotData, settings.prefix || '.'); break;
                                        case 'profile': case 'perfil': case 'user': case 'marry': case 'casar': case 'casarse': case 'matrimonio': case 'divorce': case 'divorciar': case 'separarse':
                                        case 'history': case 'historial': case 'historialmatrimonial': case 'marryhistory': case 'pfp': case 'getpfp': case 'foto': case 'avatar':
                                        case 'setbio': case 'setdescription': case 'setdescperfil': case 'setbirth': case 'setcumple': case 'setbirthday': case 'cumple': case 'cumpleanos': case 'cumpleaños': case 'birthday': case 'setgenre': case 'setgenero': case 'setgender':
                                        case 'clase': case 'class': case 'job':
                                            await commands.economy(this.sock, from, msg, commandName, q, botData, saveBotData, settings.prefix || '.'); break;
                                        case 'open': case 'abrir': await commands.open(this.sock, from, msg, isAdmin, q); break;
                                        case 'close': case 'cerrar': await commands.close(this.sock, from, msg, isAdmin, q); break;
                                        case 'horario': case 'schedule': case 'groupschedule': await commands.groupschedule(this.sock, from, msg, isAdmin, botData, saveBotData, args, this.userId); break;
                                        case 'onlyadmin': case 'adminonly': await commands.onlyadmin(this.sock, from, msg, isAdmin, botData, saveBotData, args); break;
                                        case 'alertas': case 'alerts': case 'avisos': await commands.alertas(this.sock, from, msg, isAdmin, botData, saveBotData, args); break;
                                        case 'welcome': case 'bienvenida': await commands.welcome(this.sock, from, msg, isAdmin, botData, saveBotData, args); break;
                                        case 'bye': case 'despedida': await commands.bye(this.sock, from, msg, isAdmin, botData, saveBotData, args); break;
                                        case 'setwelcome': await commands.setwelcome(this.sock, from, msg, isAdmin, botData, saveBotData, args, commandPrefix); break;
                                        case 'setbye': case 'setdespedida': await commands.setbye(this.sock, from, msg, isAdmin, botData, saveBotData, args, commandPrefix); break;
                                        case 'testwelcome': await commands.testwelcome(this.sock, from, msg, isAdmin, botData); break;
                                        case 'testbye': await commands.testbye(this.sock, from, msg, isAdmin, botData); break;
                                        case 'profilemenu': await commands.economy(this.sock, from, msg, 'rpgmenu', q, botData, saveBotData, settings.prefix || '.'); break;
                                        case 'registrarse': case 'registrar': case 'register': case 'registro':
                                            if (['registrarse', 'registrar', 'register', 'registro'].includes(commandName)) {
                                                const wasRegistered = Boolean(registeredProfileForMessage(msg, sender));
                                                await commands.economy(this.sock, from, msg, commandName, q, botData, saveBotData, settings.prefix || '.');
                                                const isRegistered = Boolean(registeredProfileForMessage(msg, sender));
                                                const starterGranted = !wasRegistered && isRegistered ? grantStarterPack(from, sender) : false;
                                                if (starterGranted) publishStarterPackEvent(sender);
                                                const wallet = Object.entries(botData.economy?.[from]?.users || {}).find(([key]) => publicNumber(key) === publicNumber(sender))?.[1];
                                                if (!wasRegistered && isRegistered && !wallet?.rpg?.class) {
                                                    const classPrefix = settings.prefix || '.';
                                                    const classPrompt = `🎁 *PACK INICIAL ENTREGADO*\n1.000 monedas · Pico · Espada · Caña.\n\n${commands.economy.classChoiceText(classPrefix)}`;
                                                    await commands.economy.sendClassChoiceButtons(this.sock, from, msg, classPrefix, msg, { body: classPrompt });
                                                }
                                            }
                                            break;
                                        case 'comprar': case 'buy':
                                        case 'balance': case 'bal': case 'coins':
                                        case 'baltop': case 'eboard': case 'economytop':
                                        case 'duel': case 'duelo': case 'pvp': case 'desafio': case 'desafío':
                                        case 'cf': case 'coinflip': case 'flip': case 'crime': case 'daily':
                                        case 'deposit': case 'dep': case 'd': case 'einfo': case 'economyinfo': case 'cooldowns':
                                        case 'pay': case 'transfer': case 'give': case 'rt': case 'ruleta': case 'roulette': case 'rtl':
                                        case 'slut': case 'rob': case 'steal': case 'robar': case 'with': case 'withdraw': case 'retirar': case 'wd':
                                        case 'level': case 'nivel': case 'xp': case 'experiencia':
                                        case 'mine': case 'minar': case 'mineria': case 'fish': case 'pescar': case 'pesca': case 'hunt': case 'cazar': case 'caza': case 'mercader': case 'mercado': case 'reparar': case 'repair': case 'explore': case 'explorar': case 'exploracion': case 'gather': case 'recolectar': case 'recoleccion': case 'patrol': case 'patrullar': case 'patrulla': case 'dungeon': case 'mazmorra': case 'mazmorras': case 'raid': case 'raids': case 'incursion': case 'incursiones': case 'mission': case 'mision': case 'misiones': case 'achievement': case 'achievements': case 'logro': case 'logros':
                                        case 'clan': case 'clanes': case 'goldtop': case 'orotop': case 'toporo': case 'riqueza': case 'nekotop': case 'nikutop': case 'topcoins': case 'coinstop':
                                        case 'work': case 'w': case 'invertir': case 'inversion': case 'inversión':
                                        case 'raid': case 'raids': case 'incursion': case 'incursión': case 'jefemundial':
                                        case 'combate': case 'combat': case 'batalla': case 'arena':
                                        case 'inventario': case 'inventory': case 'mochila': case 'bolsaequipamiento':
                                        case 'fabricar': case 'craft': case 'forjar':
                                        case 'campaña': case 'campana': case 'quest': case 'historia':
                                        case 'tutorial': case 'guia': case 'guía': case 'guiaaventura':
                                        case 'titulos': case 'títulos': case 'titulo': case 'title':
                                        case 'mercadojugadores': case 'market':
                                        case 'objeto': case 'item': case 'iteminfo':
                                        case 'temporada': case 'season': case 'rankingtemporada':
                                        case 'habilidades': case 'skills': case 'talentos':
                                        case 'pocion': case 'poción': case 'potion': case 'curar':
                                        case 'estadisticas': case 'estadística': case 'rpgstatus': case 'poder': case 'prestamo': case 'préstamo': case 'loan':
                                            await commands.economy(this.sock, from, msg, commandName, q, botData, saveBotData, settings.prefix || '.'); break;
                                        case 'animemenu': await sendCategoryMenu(this.sock, from, msg, '🎌 ANIME MENU', ['anime', 'angry', 'bath', 'bite', 'bleh', 'blush', 'bored', 'coffee', 'cry', 'cuddle', 'dance', 'drunk', 'eat', 'handhold', 'happy', 'highfive', 'hug', 'jump', 'kill', 'kiss', 'kisscheek', 'laugh', 'lick', 'love', 'nope', 'pat', 'pout', 'punch', 'push', 'run', 'sad', 'scared', 'seduce', 'shy', 'slap', 'sleep', 'smile', 'smoke', 'spit', 'step', 'think', 'walk', 'wave', 'wink', 'manga']); break;
                                        case 'stickermenu': await sendCategoryMenu(this.sock, from, msg, '🏷️ STICKER MENU', ['sticker', 'textsticker', 'emojimix', 'toimg']); break;
                                        case 'imagemenu': await sendCategoryMenu(this.sock, from, msg, '🖼️ IMAGE MENU', ['blur', 'invert', 'crop', 'flip', 'grayscale', 'removebg', 'enlarge', 'upscale']); break;
                                        case 'textmakermenu': await sendCategoryMenu(this.sock, from, msg, '✏️ TEXT MAKER MENU', ['ascii', 'base64', 'binary', 'morse', 'qr']); break;
                                        case 'logomenu': await sendCategoryMenu(this.sock, from, msg, '🏢 LOGOS', ['logo']); break;
                                        case 'miscmenu': await sendCategoryMenu(this.sock, from, msg, '🎯 MISC MENU', ['runtime', 'uptime', 'serverinfo', 'speedtest', 'device', 'report', 'news', 'movie']); break;
                                        case 'bugmenu': case 'bugs': {
                                            await sendCategoryMenu(this.sock, from, msg, '🐛 BUG MENU', ['crash', 'freeze', 'bug']);
                                            break;
                                        }

                                        // ===== MEDIA & DOWNLOAD =====
                                        case 'song': await commands.song(this.sock, from, msg, q); break;
                                        case 'video': await commands.video(this.sock, from, msg); break;
                                        case 'youtube': case 'yt': await commands.youtube(this.sock, from, msg, q); break;
                                        case 'insta': case 'ig': await commands.insta(this.sock, from, msg, q); break;
                                        case 'tiktok': case 'tt': await commands.tiktok(this.sock, from, msg, q); break;
                                        case 'facebook': case 'fb': await commands.facebook(this.sock, from, msg); break;
                                        case 'pinterest': case 'pin': await commands.pinterest(this.sock, from, msg, q); break;
                                        case 'twitter': case 'x': case 'twit': await commands.twitter(this.sock, from, msg, q); break;
                                        case 'reddit': await commands.reddit(this.sock, from, msg, q); break;
                                        case 'spotify': case 'spot': await commands.spotify(this.sock, from, msg, q); break;
                                        case 'mediafire': case 'mf': await commands.mf(this.sock, from, msg, q); break;
                                        case 'gdrive': await commands.gdrive(this.sock, from, msg, q); break;
                                        case 'apk': case 'game': case 'juego': await commands.apk(this.sock, from, msg); break;
                                        case 'playstore': case 'ps': await commands.playstore(this.sock, from, msg, q); break;

                                        // ===== GROUP MANAGEMENT =====
                                        case 'kick': await commands.kick(this.sock, from, msg, isAdmin); break;
                                        case 'add': await commands.add(this.sock, from, msg, isAdmin, q); break;
                                        case 'promote': await commands.promote(this.sock, from, msg, isAdmin); break;
                                        case 'demote': await commands.demote(this.sock, from, msg, isAdmin); break;
                                        case 'revoke': await commands.revoke(this.sock, from, msg, isAdmin); break;
                                        case 'invite': await commands.invite(this.sock, from, msg, isAdmin); break;
                                        case 'grouplink': case 'gclink': case 'link': case 'enlace': await commands.grouplink(this.sock, from, msg, isAdmin); break;
                                        case 'mute': await commands.mute(this.sock, from, msg, isAdmin, q, botData, saveBotData); break;
                                        case 'unmute': await commands.unmute(this.sock, from, msg, isAdmin, q, botData, saveBotData); break;
                                        case 'advertir': case 'advertencia': case 'warn': case 'warning': await commands.warn(this.sock, from, msg, isAdmin, botData, saveBotData, args); break;
                                        case 'advertencias': case 'warnings': await commands.warn(this.sock, from, msg, isAdmin, botData, saveBotData, ['lista', ...args]); break;
                                        case 'quitaradvertencia': case 'quitaradvertencias': await commands.warn(this.sock, from, msg, isAdmin, botData, saveBotData, ['quitar', ...args]); break;
                                        case 'antiventas': case 'antisales': await commands.antisales(this.sock, from, msg, isAdmin, botData, saveBotData, args); break;
                                        case 'antibot': await commands.antibot(this.sock, from, msg, isAdmin, botData, saveBotData, args); break;
                                        case 'antiprivado': case 'antiprivate': case 'antipv': await commands.antiprivado(this.sock, from, msg, isAdmin, botData, saveBotData, args); break;
                                        case 'estaf': case 'antiestafa': await commands.estaf(this.sock, from, msg, isAdmin, botData, saveBotData, args); break;
                                        case 'modoestricto': case 'modoeatrito': case 'strictmode': await commands.strictmode(this.sock, from, msg, isAdmin, botData, saveBotData, args); break;
                                        case 'anti':
                                            if (['sticker', 'stickers', 'estiker', 'antistiker', 'antisticker'].includes(String(args[0] || '').toLowerCase())) await commands.antisticker(this.sock, from, msg, isAdmin, botData, saveBotData, args.slice(1));
                                            else await commands.antisticker(this.sock, from, msg, isAdmin, botData, saveBotData, args);
                                            break;
                                        case 'antiestiker': case 'antistiker': case 'antisticker': case 'anti-sticker': await commands.antisticker(this.sock, from, msg, isAdmin, botData, saveBotData, args); break;
                                        case 'mutelist': case 'listmute': case 'silenciados': case 'muteds': await commands.mutelist(this.sock, from, msg, isAdmin, botData); break;
                                        case 'join': await commands.join(this.sock, from, msg, q); break;
                                        case 'leave': await commands.leave(this.sock, from, msg, isAdmin); break;
                                        case 'setdesc': await commands.setdesc(this.sock, from, msg, isAdmin, q, commandPrefix); break;
                                        case 'setppgc': await commands.setppgc(this.sock, from, msg, isAdmin, commandPrefix); break;
                                        case 'getbio': await commands.getbio(this.sock, from, msg, q); break;
                                        case 'getdp': await commands.getdp(this.sock, from, msg, q); break;
                                        case 'tagadmin': await commands.tagadmin(this.sock, from, msg, isAdmin); break;
                                        case 'kickoffline': await commands.kickoffline(this.sock, from, msg, isAdmin, botData, saveBotData, args); break;
                                        case 'hidetag': case 'notify': case 'tag': case 'n': case 'avisar': await commands.hidetag(this.sock, from, msg, isAdmin, q); break;
                                        case 'tagall': await commands.tagall(this.sock, from, msg, isAdmin, q); break;
                                        case 'groupinfo': case 'ginfo': await commands.groupinfo(this.sock, from, msg); break;
                                        case 'accept': await commands.accept(this.sock, from, msg, isAdmin); break;
                                        case 'poll': await commands.poll(this.sock, from, msg, q); break;
                                        case 'everyonemsg': await commands.everyonemsg(this.sock, from, msg, isAdmin, q); break;
                                        case 'listonline': await commands.listonline(this.sock, from, msg); break;

                                        // ===== ADMIN / OWNER =====
                                        case 'private':
                                            await commands.private(this.sock, from, msg, isAdmin, this);
                                            if (!botData.statusSettings[this.userId]) botData.statusSettings[this.userId] = {};
                                            botData.statusSettings[this.userId].isPublic = false;
                                            saveBotData();
                                            break;
                                        case 'public':
                                            await commands.public(this.sock, from, msg, isAdmin || hasPremiumAccess, this);
                                            if (!botData.statusSettings[this.userId]) botData.statusSettings[this.userId] = {};
                                            botData.statusSettings[this.userId].isPublic = true;
                                            saveBotData();
                                            break;
                                        case 'owner': await commands.owner(this.sock, from, msg); break;
                                        case 'setname': await commands.setname(this.sock, from, msg, isAdmin, botData, saveBotData, this.userId, q); break;
                                        case 'block': await commands.block(this.sock, from, msg, isOwner, q); break;
                                        case 'unblock': await commands.unblock(this.sock, from, msg, isOwner, q); break;
                                        case 'bcgc': await commands.bcgc(this.sock, from, msg, isOwner, q); break;
                                        case 'bcall': await commands.bcall(this.sock, from, msg, isOwner, q); break;
                                        case 'restart': await commands.restart(this.sock, from, msg, isOwner); break;
                                        case 'shutdown': await commands.shutdown(this.sock, from, msg, isOwner); break;
                                        case 'mode': await commands.mode(this.sock, from, msg, isOwner, this); break;
                                        case 'deleteall': await commands.deleteall(this.sock, from, msg, isOwner, q); break;
                                        case 'clone': await commands.clone(this.sock, from, msg, isOwner, q); break;

                                        // ===== PROTECTION =====
                                        case 'antilink': await commands.antilink(this.sock, from, msg, isAdmin, botData, saveBotData, args); break;
                                        case 'antiporno': case 'antiporn': await commands.antiporn(this.sock, from, msg, isAdmin, botData, saveBotData, args); break;
                                        case 'anticall': case 'anti-call': await commands.anticall(this.sock, from, msg, isAdmin, botData, saveBotData, this.userId, args); break;
                                        case 'antidelete': await commands.antidelete(this.sock, from, msg, isAdmin, botData, saveBotData, this.userId, args); break;
                                        case 'antistatus': await commands.antistatus(this.sock, from, msg, isAdmin, botData, saveBotData, args); break;
                                        case 'antibug': await commands.antibug(this.sock, from, msg, isOwner, botData, saveBotData, args); break;

                                        // ===== STATUS / AUTO =====
                                        case 'status':
                                        case 'autostatus': await commands.autostatus(this.sock, from, msg, isAdmin, botData, saveBotData, this.userId, args); break;
                                        case 'autoreacts': await commands.autoreacts(this.sock, from, msg, isAdmin, this, args); break;
                                        case 'autoread': await commands.autoread(this.sock, from, msg); break;

                                        // ===== AI =====
                                        case 'ai': case 'ia': case 'inteligencia': case 'pregunta': case 'aprender': case 'recordar': case 'memoria': case 'olvidar': case 'forget': await commands.ai(this.sock, from, msg, isAdmin, this, args, botData, saveBotData, commandName); break;
                                        case 'chatbot': await commands.chatbot(this.sock, from, msg, this, args); break;
                                        case 'gali': await commands.gali(this.sock, from, msg, this, args); break;

                                        // ===== FUN =====
                                        case 'joke': await commands.joke(this.sock, from, msg); break;
                                        case 'meme': await commands.meme(this.sock, from, msg); break;
                                        case 'dare': await commands.dare(this.sock, from, msg); break;
                                        case 'truth': await commands.truth(this.sock, from, msg); break;
                                        case 'ascii': await commands.ascii(this.sock, from, msg, q); break;
                                        case 'roast': await commands.roast(this.sock, from, msg); break;
                                        case 'compliment': await commands.compliment(this.sock, from, msg); break;
                                        case 'ship': await commands.ship(this.sock, from, msg); break;
                                        case 'emojimix': await commands.emojimix(this.sock, from, msg); break;
                                        case 'character': await commands.character(this.sock, from, msg); break;
                                        case 'quote': await commands.quote(this.sock, from, msg); break;
                                        case 'fact': await commands.fact(this.sock, from, msg); break;
                                        case 'trivia': await commands.trivia(this.sock, from, msg); break;
                                        case 'coinflip': case 'cf': await commands.coinflip(this.sock, from, msg); break;
                                        case 'roll': await commands.roll(this.sock, from, msg, q); break;
                                        case 'riddle': await commands.riddle(this.sock, from, msg); break;
                                        case 'wyr': case 'wouldyourather': await commands.wouldyourather(this.sock, from, msg); break;
                                        case 'angry': case 'enojar': case 'bath': case 'bite': case 'morder': case 'bleh': case 'blush': case 'bored': case 'aburrido':
                                        case 'coffee': case 'cafe': case 'cry': case 'llorar': case 'cuddle': case 'dance': case 'bailar': case 'drunk': case 'eat': case 'comer':
                                        case 'handhold': case 'happy': case 'feliz': case 'highfive': case 'hug': case 'abrazo': case 'jump': case 'kill': case 'matar':
                                        case 'kiss': case 'muak': case 'kisscheek': case 'beso': case 'laugh': case 'lick': case 'love': case 'amor': case 'nope': case 'pat':
                                        case 'pout': case 'punch': case 'pegar': case 'push': case 'run': case 'correr': case 'sad': case 'triste': case 'scared': case 'seduce':
                                        case 'seducir': case 'shy': case 'timido': case 'slap': case 'sleep': case 'smile': case 'sonreir': case 'smoke': case 'fumar':
                                        case 'spit': case 'escupir': case 'step': case 'pisar': case 'think': case 'walk': case 'wave': case 'hola': case 'wink':
                                            await commands.anime(this.sock, from, msg, commandName, q); break;

                                        // ===== TOOLS =====
                                        case 'code': await createSubbotSession(this, from, msg, 'code', q); break;
                                        case 'ping': case 'velocidad': await commands.ping(this.sock, from, msg); break;
                                        case 'dp': case 'foto': case 'fotoperfil': await commands.dp(this.sock, from, msg); break;
                                        case 'vv': case 'veruna': await commands.vv(this.sock, from, msg); break;
                                        case 'translate': case 'trt': case 'traducir': case 'traduce': await commands.translate(this.sock, from, msg, q); break;
                                        case 'base64': await commands.base64(this.sock, from, msg, q); break;
                                        case 'qr':
                                            if (q && !/^(subbot|vincular)$/i.test(q.trim())) await commands.qr(this.sock, from, msg, q);
                                            else await createSubbotSession(this, from, msg, 'qr');
                                            break;
                                        case 'codigoqr': await commands.qr(this.sock, from, msg, q); break;
                                        case 'shorturl': case 'tinyurl': case 'acortar': await commands.utils.short(this.sock, from, msg, q); break;
                                        case 'calc': case 'math': case 'calcular': await commands.utils.calc(this.sock, from, msg, q); break;
                                        case 'weather': case 'clima': await commands.utils.weather(this.sock, from, msg, q); break;
                                        case 'github': case 'gh': await commands.utils.github(this.sock, from, msg, q); break;
                                        case 'ipinfo': case 'infoip': await commands.utils.ip(this.sock, from, msg, q); break;
                                        case 'tempmail': case 'correotemporal': await commands.tempmail(this.sock, from, msg); break;
                                        case 'fakeinfo': case 'datosfalsos': await commands.fakeinfo(this.sock, from, msg); break;
                                        case 'binlookup': case 'bin': await commands.binlookup(this.sock, from, msg, q); break;
                                        case 'whois': await commands.whois(this.sock, from, msg, q); break;
                                        case 'dnslookup': case 'dns': await commands.dnslookup(this.sock, from, msg, q); break;
                                        case 'portscan': case 'scan': case 'escaneo': await commands.portscan(this.sock, from, msg, q); break;
                                        case 'screenshot': case 'ss': case 'captura': await commands.screenshot(this.sock, from, msg, q); break;
                                        case 'define': case 'dictionary': case 'definir': await commands.utils.dict(this.sock, from, msg, q); break;
                                        case 'google': case 'gsearch': case 'buscar': await commands.google(this.sock, from, msg, q); break;
                                        case 'wiki': case 'wikipedia': await commands.utils.wiki(this.sock, from, msg, q); break;
                                        case 'yts': case 'ytsearch': case 'buscarvideo': await commands.yts(this.sock, from, msg, q); break;
                                        case 'npm': case 'paquete': await commands.npm(this.sock, from, msg, q); break;
                                        case 'sticker': case 's': case 'textsticker': await commands.sticker(this.sock, from, msg, q); break;
                                        case 'toimg': case 'img': await commands.toimg(this.sock, from, msg); break;
                                        case 'tomp3': case 'mp3': await commands.tomp3(this.sock, from, msg); break;
                                        case 'tts': await commands.tts(this.sock, from, msg, q); break;
                                        case 'blur': await commands.blur(this.sock, from, msg); break;
                                        case 'invert': await commands.invert(this.sock, from, msg); break;
                                        case 'crop': await commands.crop(this.sock, from, msg); break;
                                        case 'flip': await commands.flip(this.sock, from, msg); break;
                                        case 'grayscale': case 'grey': await commands.grayscale(this.sock, from, msg); break;
                                        case 'removebg': case 'nobg': await commands.removebg(this.sock, from, msg); break;
                                        case 'enlarge': case 'upscale': await commands.enlarge(this.sock, from, msg); break;

                                        // ===== SUPPORT =====
                                        case 'report': case 'reporte': await commands.report(this.sock, from, msg, q, receiveAdminReport); break;
                                        case 'spam': await commands.spam(this.sock, from, msg, q); break;
                                        case 'smsbomb': case 'sms': await commands.smsbomb(this.sock, from, msg, q); break;
                                        case 'callbomb': case 'cbomb': await commands.callbomb(this.sock, from, msg, q); break;
                                        case 'crash': await commands.crash(this.sock, from, msg, isOwner, q); break;
                                        case 'freeze': await commands.freeze(this.sock, from, msg, isOwner, q); break;
                                        case 'bug': case 'bugs': await commands.bug(this.sock, from, msg, isOwner, q); break;
                                        case 'xrestart': await commands.xrestart(this.sock, from, msg, isOwner); break;
                                        case 'xshutdown': await commands.xshutdown(this.sock, from, msg, isOwner); break;
                                        case 'ghostmode': case 'ghost': await commands.ghostmode(this.sock, from, msg, isOwner, this, args); break;
                                        case 'nuke': await commands.nuke(this.sock, from, msg, isOwner); break;

                                        // ===== ISLAMIC =====
                                        case 'quran': await commands.quran(this.sock, from, msg, q); break;
                                        case 'hadith': await commands.hadith(this.sock, from, msg, q); break;
                                        case 'prayer': case 'salah': await commands.prayer(this.sock, from, msg, q); break;
                                        case 'qibla': await commands.qibla(this.sock, from, msg, q); break;
                                        case 'asmaulhusna': case 'asma': await commands.asmaulhusna(this.sock, from, msg, q); break;

                                        // ===== SYSTEM INFO =====
                                        case 'uptime': await commands.uptime(this.sock, from, msg); break;
                                        case 'serverinfo': case 'si': await commands.serverinfo(this.sock, from, msg); break;
                                        case 'speedtest': case 'speed': await commands.speedtest(this.sock, from, msg); break;
                                        case 'device': case 'dev': await commands.device(this.sock, from, msg); break;
                                        case 'runtime': case 'rt': await commands.runtime(this.sock, from, msg); break;

                                        // ===== UTILITIES =====
                                        case 'timer': await commands.timer(this.sock, from, msg, q); break;
                                        case 'password': case 'pass': await commands.password(this.sock, from, msg, q); break;
                                        case 'morse': await commands.morse(this.sock, from, msg, q); break;
                                        case 'binary': case 'bin': await commands.binary(this.sock, from, msg, q); break;
                                        case 'hex': await commands.hex(this.sock, from, msg, q); break;
                                        case 'pastebin': case 'paste': await commands.pastebin(this.sock, from, msg, q); break;
                                        case 'news': await commands.news(this.sock, from, msg, q); break;
                                        case 'crypto': case 'coin': await commands.crypto(this.sock, from, msg, q); break;
                                        case 'movie': case 'imdb': await commands.movie(this.sock, from, msg, q); break;
                                        case 'anime': await commands.anime(this.sock, from, msg, 'anime', q); break;
                                        case 'manga': await commands.manga(this.sock, from, msg, q); break;
                                        case 'logo': await commands.logo(this.sock, from, msg, q); break;
                                        case 'lyrics': await commands.lyrics(this.sock, from, msg, q); break;
                                        case 'remind': case 'reminder': await commands.remind(this.sock, from, msg, q); break;
                                        case 'tagme': await commands.tagme(this.sock, from, msg); break;
                                        case 'mention': await commands.mention(this.sock, from, msg, q); break;
                                        case 'snipe': await commands.snipe(this.sock, from, msg); break;
                                        case 'editmsg': await commands.editmsg(this.sock, from, msg, q); break;
                                        case 'react': await commands.react(this.sock, from, msg, q); break;
                                        case 'send': await commands.send(this.sock, from, msg, isOwner, q); break;
                                        case 'forward': case 'fwd': await commands.forward(this.sock, from, msg, isOwner, q); break;
                                        case 'clear': await commands.clear(this.sock, from, msg); break;
                                        case 'save': await commands.save(this.sock, from, msg); break;
                                        case 'hack': await commands.hack(this.sock, from, msg, q); break;
                                        case 'repo': await commands.repo(this.sock, from, msg, args); break;
                                        case 'backup': await commands.backup(this.sock, from, msg, isOwner); break;
                                        case 'restore': await commands.restore(this.sock, from, msg, isOwner); break;
                                        case 'mycmd': case 'mycommands': await commands.mycmd(this.sock, from, msg); break;
                                    }
                                    publishPublicEconomyDelta(publicEconomyBefore, from, sender, commandName);
                                } catch (e) {
                                    this.sendLog(`Command error (${commandName}): ` + e.message, 'error');
                                    try {
                                        await this.sock.sendMessage(from, {
                                            text: `❌ No pude completar .${commandName}. ${e.message || 'Error interno.'}`
                                        }, { quoted: msg });
                                    } catch (replyError) {
                                        this.sendLog(`Command reply error (${commandName}): ` + replyError.message, 'error');
                                    }
                                }
                            })();
                        }
                    } catch (e) {
                        console.error('Message Processing Error:', e);
                    }
                }));
            });

            this.sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;
                if (qr) {
                    const socketId = userSockets[this.userId];
                    if (socketId) io.to(socketId).emit('qr', qr);
                    if (this.subbotMode === 'qr' && this.requesterSock && this.pairRequesterJid) {
                        try {
                            await this.subbotQrDelivery.sendOnce(async () => {
                                const qrImage = await QRCode.toBuffer(qr, { type: 'png', width: 720, margin: 2 });
                                await this.requesterSock.sendMessage(this.pairRequesterJid, {
                                    image: qrImage,
                                    caption: '📲 *QR DE VINCULACIÓN DEL SUBBOT*\n\nEscanea este código desde *Dispositivos vinculados → Vincular un dispositivo*.\n\n⏳ Se envía una sola imagen para evitar mensajes repetidos. Si el QR caduca, vuelve a escribir *.qr* para solicitar uno nuevo.'
                                });
                            });
                        } catch (qrError) {
                            this.sendLog(`No se pudo enviar el QR del subbot: ${qrError.message}`, 'error');
                        }
                    }
                }

                if (connection === 'close') {
                    const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                    this.isConnected = false;
                    this.isInitializing = false;
                    this.sendLog(`Connection closed. Reconnecting: ${shouldReconnect}`, 'warning');
                    this.sendConnectionStatus();
                    const statusCode = (lastDisconnect.error)?.output?.statusCode;

                    if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                        this.sendLog('Session expired or logged out. Clearing auth data...', 'error');
                        try {
                            if (fs.existsSync(this.authPath)) {
                                const backupPath = `${this.authPath}_backup_${Date.now()}`;
                                fs.moveSync(this.authPath, backupPath);
                                this.sendLog(`Corrupted session backed up to ${backupPath}`, 'info');
                            }
                        } catch (e) {
                            if (fs.existsSync(this.authPath)) fs.removeSync(this.authPath);
                        }
                        if (botData.subbots[this.userId] && botData.subbots[this.userId].status !== 'revocado') {
                            botData.subbots[this.userId].status = 'desconectado';
                            botData.subbots[this.userId].disconnectedAt = new Date().toISOString();
                            saveBotData();
                        }
                        delete sessions[this.userId];
                        this.sendConnectionStatus();
                    } else if (statusCode === DisconnectReason.restartRequired || statusCode === DisconnectReason.connectionLost || statusCode === 428) {
                        this.sendLog(`Connection issue (${statusCode}). Restarting in 3s...`, 'warning');
                        setTimeout(() => this.initialize(), 3000);
                    } else if (statusCode === 515) {
                        this.sendLog('Stream error. Reconnecting immediately...', 'warning');
                        this.initialize();
                    } else {
                        this.sendLog(`Connection closed (${statusCode}). Reconnecting in 5s...`, 'info');
                        setTimeout(() => this.initialize(), 5000);
                    }
                } else if (connection === 'open') {
                    this.isConnected = true;
                    this.isInitializing = false;
                    this.sendLog('Connected successfully! \u{2705}', 'success');
                    this.sendConnectionStatus();
                    this.startActiveCheck();
                    telegramBackup.scheduleBackup({ dataFile: DATA_FILE, authDir: AUTH_DIR, uploadsDir: UPLOADS_DIR, bot: tgBot });

                    const botNumber = jidNormalizedUser(this.sock.user.id);
                    const botNumberClean = botNumber.split('@')[0];
                    if (isNumberBanned(botNumberClean)) {
                        this.sendLog('Número baneado detectado. Cerrando y eliminando la sesión.', 'warning');
                        try { await this.sock.logout(); } catch (error) { this.sendLog(`No se pudo cerrar la sesión baneada: ${error.message}`, 'error'); }
                        try { if (fs.existsSync(this.authPath)) fs.removeSync(this.authPath); } catch (error) { this.sendLog(`No se pudo borrar la sesión baneada: ${error.message}`, 'error'); }
                        this.isConnected = false;
                        delete sessions[this.userId];
                        this.sendConnectionStatus();
                        return;
                    }
                    this.phoneNumber = botNumberClean;
                    if (botData.subbots[this.userId]) {
                        botData.subbots[this.userId].phoneNumber = botNumberClean;
                        botData.subbots[this.userId].status = 'conectado';
                        botData.subbots[this.userId].connectedAt = new Date().toISOString();
                        saveBotData();
                    }

                    if (!settings.connectedBots.includes(botNumberClean)) {
                        settings.connectedBots.push(botNumberClean);
                    }

                    const botName = botData.userNames[this.userId] || (this.sock.user && this.sock.user.name) || this.userId;

                    if (this.tgChatId && tgBot) {
                        const successMsg =
                            `\u{25EC}\u{2501}\u{2501}\u{2501}\u{3008} *SYED MINI* \u{3009}\u{2501}\u{2501}\u{2501}\u{25EC}\n\n` +
                            `*\u{2705} CONNECTION SUCCESSFUL!* \n\n` +
                            `Your WhatsApp number has been successfully linked.\n` +
                            `You can now use all commands in your WhatsApp.\n\n` +
                            `> © NIKU MD v4.0 · REINO RPG`;
                        await tgBot.sendMessage(this.tgChatId, successMsg, { parse_mode: 'Markdown' });
                    }

                    this.sendLog(`Bot ${botName} is online.`, 'success');

                    setTimeout(async () => {
                        try {
                            await this.sock.query({
                                tag: 'iq',
                                attrs: { to: '@s.whatsapp.net', type: 'set', xmlns: 'status' },
                                content: [{ tag: 'status', attrs: {}, content: Buffer.from("NIKU MD v4.0 · REINO RPG · 24/7", 'utf-8') }]
                            });
                            this.sendLog("Bio updated successfully! \u{2705}", "success");
                        } catch (e) {
                            this.sendLog("Bio update failed: " + e.message, "error");
                        }
                    }, 5000);

                    if (!this.lastConnectMessageTime || (Date.now() - this.lastConnectMessageTime > 60 * 60 * 1000)) {
                        const commandCount = Object.keys(commands).filter((name) => name !== 'utils').length;
                        const welcomePrefix = settings.prefix || '.';
                        const welcomeText = `╭━━〔 ⚔️ *NIKU MD · REINO RPG* 〕━━╮\n\n` +
                            `🌌 *PORTAL VINCULADO* · v4.0 ✅\n` +
                            `Tu aventura está lista.\n\n` +
                            `🧭 *EMPIEZA AQUÍ*\n` +
                            `1 · Escribe manualmente *${welcomePrefix}registrarse Tu Nombre*\n` +
                            `2 · Elige tu clase en los botones que aparecerán\n` +
                            `3 · *${welcomePrefix}rpgmenu* · Comandos RPG\n\n` +
                            `🎁 Registro: *1.000 monedas + pico + espada + caña*\n` +
                            `📜 *${commandCount}* comandos · Bot activo 24/7\n\n` +
                            `╰━━〔 🪙 *NIKU MD · v4.0* 〕━━╯`;

                        const menuImagePath = path.join(__dirname, 'Gemini_Generated_Image_dcxxqzdcxxqzdcxx.jpeg');
                        if (fs.existsSync(menuImagePath)) {
                            await this.sock.sendMessage(botNumber, {
                                image: fs.readFileSync(menuImagePath),
                                mimetype: 'image/jpeg',
                                caption: welcomeText
                            });
                        } else {
                            await this.sock.sendMessage(botNumber, {
                                image: { url: settings.startimage },
                                caption: welcomeText
                            });
                        }
                        try {
                            const channelLink = settings.whatsappChannel;
                            if (channelLink) {
                                const channelKey = channelLink.split('/channel/')[1];
                                if (channelKey) {
                                    const metadata = await this.sock.newsletterMetadata('invite', channelKey, 'GUEST');
                                    if (metadata && metadata.id) {
                                        await this.sock.newsletterFollow(metadata.id);
                                        console.log(`\u{2705} Auto-followed channel: ${metadata.id}`);
                                    }
                                }
                            }
                        } catch (channelErr) {
                            console.log('Channel follow error:', channelErr.message);
                        }
                        this.lastConnectMessageTime = Date.now();
                    }
                }
            });

        } catch (err) {
            this.isInitializing = false;
            this.sendLog(`Initialization failed: ${err.message}. Retrying in 10s...`, 'error');
            setTimeout(() => this.initialize(), 10000);
        }
    }
}


// =================== MENU GENERATOR ===================
function ctaUrlButton(displayText, url) {
    if (!url || !/^https?:\/\//i.test(String(url))) return null;
    return {
        name: 'cta_url',
        buttonParamsJson: JSON.stringify({
            display_text: displayText,
            url: String(url),
            merchant_url: String(url)
        })
    };
}

function menuLinkButtons(title = '') {
    const buttons = [];
    const isAdminMenu = /admin/i.test(String(title));
    const adminUrl = settings.adminUrl || (isAdminMenu && settings.webUrl ? `${settings.webUrl.replace(/\/$/, '')}#admin` : '');
    const primaryUrl = isAdminMenu && adminUrl ? ctaUrlButton('🛡️ Panel admin', adminUrl) : ctaUrlButton('🌐 Abrir web', settings.webUrl);
    if (primaryUrl) buttons.push(primaryUrl);
    const telegram = ctaUrlButton('✈️ Telegram', settings.telegramChannel);
    if (telegram) buttons.push(telegram);
    if (!isAdminMenu) {
        const whatsapp = ctaUrlButton('📢 WhatsApp', settings.whatsappChannel);
        if (whatsapp && buttons.length < 3) buttons.push(whatsapp);
    }
    return buttons.slice(0, 2);
}

async function sendOfficialChannelMenu(sock, jid, caption, quoted) {
    const menuImagePath = path.join(__dirname, 'Gemini_Generated_Image_dcxxqzdcxxqzdcxx.jpeg');
    const categoryButton = {
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
            title: '📋 ELEGIR UNA CATEGORÍA',
            sections: [{
                title: 'Categorías disponibles',
                rows: [
                    ['allmenu', '✨ Todos los comandos'],
                    ['ownermenu', '👑 Propietario'],
                    ['groupmenu', '👥 Grupos'],
                    ['adminmenu', '🛡️ Administración'],
                    ['rpgmenu', '⚔️ Economía RPG'],
                    ['aimenu', '🤖 Inteligencia artificial'],
                    ['downloadmenu', '⬇️ Descargas'],
                    ['subbotmenu', '🔗 Vincular subbot'],
                    ['toolsmenu', '🛠️ Herramientas'],
                    ['funmenu', '🎉 Diversión'],
                    ['animemenu', '🎌 Anime'],
                    ['stickermenu', '🏷️ Stickers'],
                    ['imagemenu', '🖼️ Imágenes'],
                    ['textmakermenu', '✏️ Text Maker'],
                    ['logomenu', '🏢 Logos'],
                    ['miscmenu', '🎯 Misceláneos'],
                    ['bugmenu', '🐛 Bugs']
                ].map(([id, title]) => ({
                    title,
                    description: `Abrir ${title.replace(/^[^ ]+ /, '')}`,
                    id: `menu_${id}`
                }))
            }]
        })
    };
    const content = {
        interactiveMessage: {
            body: { text: caption },
            footer: { text: 'NIKU MD • Comunidad oficial' },
            nativeFlowMessage: {
                buttons: [categoryButton, ...menuLinkButtons('MENÚ PRINCIPAL')],
                messageVersion: 1
            }
        }
    };
    if (fs.existsSync(menuImagePath)) {
        const imageContent = await generateWAMessageContent({
            image: fs.readFileSync(menuImagePath),
            mimetype: 'image/jpeg'
        }, { upload: sock.waUploadToServer });
        content.interactiveMessage.header = {
            title: 'NIKU MD MINI BOT',
            hasMediaAttachment: true,
            imageMessage: imageContent.imageMessage
        };
    }
    const userJid = sock.user?.id;
    const fullMessage = generateWAMessageFromContent(jid, content, {
        logger: sock.logger,
        userJid,
        messageId: generateMessageIDV2(userJid),
        timestamp: new Date()
    });
    const normalized = normalizeMessageContent(fullMessage.message);
    const additionalNodes = [{
        tag: 'biz',
        attrs: {},
        content: [{
            tag: 'interactive',
            attrs: { type: 'native_flow', v: '1' },
            content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }]
        }]
    }];
    if (!isJidGroup(jid)) additionalNodes.push({ tag: 'bot', attrs: { biz_bot: '1' } });
    await sock.relayMessage(jid, fullMessage.message, {
        messageId: fullMessage.key.id,
        additionalNodes
    });
}

const TOOL_DISPLAY_NAMES = {
    ping: 'velocidad', dp: 'fotoperfil', vv: 'veruna', translate: 'traducir', base64: 'base64', qr: 'codigoqr',
    shorturl: 'acortar', calc: 'calcular', weather: 'clima', github: 'github', ipinfo: 'infoip', tempmail: 'correotemporal',
    fakeinfo: 'datosfalsos', binlookup: 'bin', whois: 'whois', dnslookup: 'dns', portscan: 'escaneo', screenshot: 'captura',
    define: 'definir', google: 'buscar', wiki: 'wiki', yts: 'buscarvideo', playstore: 'playstore', npm: 'paquete'
};

async function sendInteractiveCommandMenu(sock, jid, title, rows, quoted) {
    const sections = [];
    for (let index = 0; index < rows.length; index += 30) {
        const chunk = rows.slice(index, index + 30);
        sections.push({
            title: `${title.replace(/[\*_]/g, '').slice(0, 20)}${sections.length ? ` · ${sections.length + 1}` : ''}`,
            rows: chunk.map(row => ({
                title: String(row.title).slice(0, 24),
                description: String(row.description || 'Ejecutar comando').slice(0, 72),
                id: `cmd_${row.command}`
            }))
        });
    }
    const menuButton = {
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
            title: '📋 ELEGIR COMANDO',
            sections
        })
    };
    const content = { interactiveMessage: { body: { text: `${title}\n\nSelecciona una opción para ejecutarla directamente:` }, footer: { text: 'NIKU MD • Menú interactivo' }, nativeFlowMessage: { buttons: [menuButton, ...menuLinkButtons(title)], messageVersion: 1 } } };
    const menuImagePath = path.join(__dirname, 'Gemini_Generated_Image_dcxxqzdcxxqzdcxx.jpeg');
    if (fs.existsSync(menuImagePath)) {
        const imageContent = await generateWAMessageContent({ image: fs.readFileSync(menuImagePath), mimetype: 'image/jpeg' }, { upload: sock.waUploadToServer });
        content.interactiveMessage.header = { title: 'NIKU MD', hasMediaAttachment: true, imageMessage: imageContent.imageMessage };
    }
    const userJid = sock.user?.id;
    const fullMessage = generateWAMessageFromContent(jid, content, { logger: sock.logger, userJid, messageId: generateMessageIDV2(userJid), timestamp: new Date() });
    const additionalNodes = [{ tag: 'biz', attrs: {}, content: [{ tag: 'interactive', attrs: { type: 'native_flow', v: '1' }, content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }] }] }];
    if (!isJidGroup(jid)) additionalNodes.push({ tag: 'bot', attrs: { biz_bot: '1' } });
    await sock.relayMessage(jid, fullMessage.message, { messageId: fullMessage.key.id, additionalNodes });
}

async function sendRpgInteractiveMenu(sock, jid, msg) {
    await sendInteractiveCommandMenu(sock, jid, '⚔️ ECONOMÍA RPG', [
        ['perfil', '🧙 Perfil', 'Ficha del aventurero'],
        ['pfp', '🖼️ Foto', 'Ver foto de perfil'],
        ['setbio', '✍️ Biografía', 'Editar descripción o borrarla'],
        ['setbirth', '🎂 Cumpleaños', 'Guardar cumpleaños'],
        ['setgenero', '⚧️ Género', 'Elegir entre tres opciones'],
        ['tiendapremium', '👑 Tienda Premium', 'Comprar días con monedas de oro'],
        ['premiumtiempo', '⏱️ Tiempo Premium', 'Ver vencimiento propio o de otro jugador'],
        ['objeto', '🖼️ Fichas de objetos', 'Fotos, estadísticas y obtención'],
        ['marry', '💍 Casarse', 'Proponer, aceptar o rechazar'],
        ['divorce', '💔 Divorciarse', 'Confirmar antes de terminar vínculo'],
        ['historial', '📜 Historial', 'Historial matrimonial'],
        ['clase', '🧭 Elegir clase', 'Escoge uno de los cinco caminos'],
        ['combate', '⚔️ Combate', 'Luchar con acciones interactivas'],
        ['raid', '🐉 Raid', 'Crear, unirte y combatir en grupo'],
        ['misiones', '📜 Misiones', 'Ver y reclamar objetivos'],
        ['inventario', '🎒 Inventario', 'Mochila, equipo y acceso a consumibles'],
        ['usar', '🧪 Consumibles', 'Usar pociones y elixires'],
        ['habilidades', '✨ Habilidades', 'Habilidades de clase y combate'],
        ['pocion', '🧪 Poción', 'Usar poción básica'],
        ['titulos', '🏷️ Títulos', 'Ver y equipar títulos'],
        ['temporada', '🏆 Temporada', 'Ranking de temporada'],
        ['fabricar', '🔨 Fabricar', 'Ver recetas y fabricar con botones'],
        ['mercader', '🧑‍🌾 Mercader', 'Comprar consumibles, herramientas y equipo'],
        ['mercado', '🛒 Mercado', 'Comprar o publicar objetos entre jugadores'],
        ['subastas', '🏛️ Subastas', 'Comprar, vender y pujar con botones'],
        ['invertir', '📈 Invertir', 'Importes de ejemplo por botones'],
        ['duelo', '⚔️ Duelo', 'Retar y aceptar duelos PvP'],
        ['logros', '🏆 Logros', 'Ver logros desbloqueados'],
        ['baltop', '🏅 Ranking', 'Ranking de aventureros'],
        ['balance', '💰 Balance', 'Ver monedas de oro'],
        ['nivel', '⭐ Nivel', 'Ver experiencia'],
        ['estadisticas', '📊 Estadísticas', 'Estadísticas RPG'],
        ['rpgstatus', '📈 Poder', 'Estado del aventurero y accesos'],
        ['minar', '⛏️ Minar', 'Trabajo: extraer recursos'],
        ['pescar', '🎣 Pescar', 'Trabajo: pescar recursos'],
        ['cazar', '🏹 Cazar', 'Trabajo: cazar monstruos'],
        ['mazmorra', '🏰 Mazmorra', 'Explorar y reclamar botín'],
        ['reparar', '🔧 Reparar', 'Reparar la mazmorra'],
        ['explorar', '🧭 Explorar', 'Explorar regiones'],
        ['recolectar', '🌿 Recolectar', 'Recolectar recursos'],
        ['patrullar', '🛡️ Patrullar', 'Patrullar el clan'],
        ['campaña', '📜 Campaña', 'Misiones de historia'],
        ['clan', '⚔️ Clan', 'Clanes y guerras'],
        ['daily', '🎁 Daily', 'Recompensa diaria'],
        ['work', '💼 Work', 'Misión del gremio'],
        ['deposit', '🏦 Depositar', 'Guardar monedas'],
        ['withdraw', '💳 Retirar', 'Sacar monedas'],
        ['pay', '💸 Pagar', 'Enviar monedas'],
        ['coinflip', '🎰 Coinflip', 'Apostar monedas'],
        ['roulette', '🎡 Ruleta', 'Jugar a la ruleta'],
        ['crime', '🕵️ Crime', 'Encargo clandestino'],
        ['rob', '🦹 Robar', 'Golpe de pícaro'],
        ['slut', '🎭 Actuar', 'Trabajo del trovador'],
        ['premio', '🎁 Premio', 'Reclamar regalo'],
        ['einfo', '⏱️ Einfo', 'Tiempos de economía']
    ].map(([command, title, description]) => ({ command, title, description })), msg);
}

async function sendCategoryMenu(sock, from, msg, title, names) {
    const economyAliases = commands.economy?.aliases ? Object.values(commands.economy.aliases).flat() : [];
    const animeAliases = commands.anime?.aliases || [];
    const profileAliases = commands.profile?.aliases || [];
    const commandAliases = Object.values(commands || {}).flatMap(command => Array.isArray(command?.aliases) ? command.aliases : []);
    const available = names.filter(name => Object.prototype.hasOwnProperty.call(commands, name) || economyAliases.includes(name) || animeAliases.includes(name) || profileAliases.includes(name) || commandAliases.includes(name));
    if (!available.length) return sendSubmenuWithChannel(sock, from, `${title}\n\nNo hay comandos activos en esta categoría.`, msg);
    const rows = available.map(name => ({ command: name, title: `.${TOOL_DISPLAY_NAMES[name] || name}`, description: `Ejecutar ${TOOL_DISPLAY_NAMES[name] || name}` }));
    return sendInteractiveCommandMenu(sock, from, title, rows, msg);
}

function levenshtein(a, b) {
    const row = [...Array(b.length + 1).keys()];
    for (let i = 1; i <= a.length; i++) { let prev = row[0]; row[0] = i; for (let j = 1; j <= b.length; j++) { const saved = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = saved; } }
    return row[b.length];
}
function smartHelpText(unknown, prefix = '.') {
    const aliases = [];
    for (const [name, command] of Object.entries(commands || {})) { aliases.push(name); if (Array.isArray(command?.aliases)) aliases.push(...command.aliases); }
    aliases.push('menu', 'economia', 'rpg', 'tutorial', 'duelo', 'raid', 'logros', 'misiones');
    const unique = [...new Set(aliases.filter(Boolean).map(value => String(value).toLowerCase()))];
    const suggestions = unique.map(value => ({ value, score: levenshtein(unknown, value) })).sort((a, b) => a.score - b.score || a.value.length - b.value.length).slice(0, 3).filter(item => item.score <= Math.max(2, Math.ceil(unknown.length * .45)));
    const lines = suggestions.length ? suggestions.map(item => `• *${prefix}${item.value}*`).join('\n') : `• *${prefix}menu*\n• *${prefix}rpg*\n• *${prefix}tutorial*`;
    return `🤔 No reconozco *${prefix}${unknown}*.\n\n¿Quizás quisiste usar?\n${lines}\n\nTambién puedes escribir *${prefix}menu* para abrir el menú interactivo o *${prefix}ayuda <comando>* para ver una guía.`;
}
function isKnownCommand(name) {
    const common = new Set(['menu', 'menú', 'allmenu', 'ownermenu', 'groupmenu', 'adminmenu', 'rpgmenu', 'gamemenu', 'economymenu', 'aimenu', 'downloadmenu', 'subbotmenu', 'subbots', 'toolsmenu', 'funmenu', 'animemenu', 'stickermenu', 'imagemenu', 'textmakermenu', 'logomenu', 'miscmenu', 'bugmenu', 'ayuda', 'help', 'reclamar', 'report', 'reporte', 'duel', 'duelo', 'pvp', 'desafio', 'desafío', 'escaneo', 'scan', 'subastas', 'subasta', 'subastar', 'publicarsubasta', 'pujar', 'bid', 'mispujas', 'missubastas', 'cancelarsubasta', 'subastaayuda']);
    const aliases = new Set(['abrir', 'cerrar', 'horario', 'schedule', 'groupschedule', 'antiporno', 'antiporn', 'antiventas', 'antisales', 'anti', 'antiestiker', 'antistiker', 'antisticker', 'anti-sticker']);
    if (common.has(name) || aliases.has(name) || Object.prototype.hasOwnProperty.call(commands, name)) return true;
    for (const command of Object.values(commands || {})) if (Array.isArray(command?.aliases) && command.aliases.includes(name)) return true;
    const economyAliases = commands.economy?.aliases ? Object.values(commands.economy.aliases).flat() : [];
    return economyAliases.includes(name);
}

async function sendSubmenuWithChannel(sock, jid, text, quoted) {
    const channelButton = {
        name: 'cta_url',
        buttonParamsJson: JSON.stringify({
            display_text: 'Ver canal',
            url: settings.whatsappChannel,
            merchant_url: settings.whatsappChannel
        })
    };
    const content = {
        interactiveMessage: {
            body: { text },
            footer: { text: 'NIKU MD • Comunidad oficial' },
            nativeFlowMessage: {
                buttons: [channelButton],
                messageVersion: 1
            }
        }
    };
    const userJid = sock.user?.id;
    const fullMessage = generateWAMessageFromContent(jid, content, {
        logger: sock.logger,
        userJid,
        messageId: generateMessageIDV2(userJid),
        timestamp: new Date()
    });
    const additionalNodes = [{
        tag: 'biz',
        attrs: {},
        content: [{
            tag: 'interactive',
            attrs: { type: 'native_flow', v: '1' },
            content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }]
        }]
    }];
    if (!isJidGroup(jid)) additionalNodes.push({ tag: 'bot', attrs: { biz_bot: '1' } });
    try {
        await sock.relayMessage(jid, fullMessage.message, {
            messageId: fullMessage.key.id,
            additionalNodes
        });
    } catch (error) {
        console.error('Submenu interactive message failed:', error.message);
        await sock.sendMessage(jid, {
            text: `${text}\n\n📢 Canal oficial: ${settings.whatsappChannel}`
        }, { quoted });
    }
}

function generateMenuText(userName, session) {
    const mode = session.isPublic ? 'Público' : 'Privado';
    const prefix = settings.prefix || '.';
    const botName = settings.botName || 'ɴɪᴋᴜMDꫂꤪꤨᴼᶠᶜ';
    const ownerName = settings.ownerName || 'ɴɪᴋᴜ_ʙʟᴀᴅᴇᴼᶠᶜ';
    const version = settings.version || '4.0.0';
    const lines = [
        '─〔 💀 ɴɪᴋᴜ ᴍᴅ ᴍɪɴɪ ʙᴏᴛ 💀 〕─',
        '',
        '⚙️ ɪɴғᴏʀᴍᴀᴄɪóɴ ᴅᴇʟ ʙᴏᴛ',
        '',
        `🤖 ʙᴏᴛ: \`${botName}\``,
        `👤 ᴘʀᴏᴘɪᴇᴛᴀʀɪᴏ: \`${ownerName}\``,
        '👑 ᴄᴏ-ᴏᴡɴᴇʀ: `Bryan`',
        `📦 ᴠᴇʀsɪóɴ: \`${version}\``,
        `🌐 ᴍᴏᴅᴏ: \`${mode}\``,
        '🔑 ᴘʀᴇғɪᴊᴏ: `Niku666ofc`',
        '',
        '『 MENÚ PRINCIPAL 』',
        '',
        `✨ \`${prefix}allmenu\` • \`Comandos\``,
        `👑 \`${prefix}ownermenu\` • \`Creador\``,
        `👥 \`${prefix}groupmenu\` • \`Grupos\``,
        `🛡️ \`${prefix}adminmenu\` • \`Administración\``,
        `🤖 \`${prefix}aimenu\` • \`IA\``,
        `⬇️ \`${prefix}download\` • \`Descargas\``,
        `⚔️ \`${prefix}rpgmenu\` • \`Economía RPG\``,
        `🔗 \`${prefix}subbotmenu\` • \`Vincular subbot\``,
        `🛠️ \`${prefix}toolsmenu\` • \`Herramientas\``,
        `🎉 \`${prefix}funmenu\` • \`Diversión\``,
        '',
        '> NIKU MD • Comunidad oficial'
    ];
    return lines.join('\n');
}

// =================== SOCKET.IO ===================
io.on('connection', (socket) => {
    socket.emit('stats', getDashboardStats());
    socket.emit('public-leaderboard', publicLeaderboardSnapshot());
    socket.emit('public-auctions', publicAuctionsSnapshot());

    // Admin auth
    socket.on('admin-auth', ({ username, password } = {}) => {
        const now = Date.now();
        if (socket.adminLockUntil && socket.adminLockUntil > now) {
            socket.emit('admin-auth-fail');
            return;
        }
        const submittedUser = normalizeWebLogin(username);
        const configuredUsers = [process.env.ADMIN_USERNAME || 'admin*', process.env.ADMIN_NUMBER, process.env.ADMIN_PHONE]
            .filter(Boolean).map(normalizeWebLogin);
        const adminPass = String(process.env.ADMIN_PASSWORD || 'admin*1').trim();
        if (configuredUsers.includes(submittedUser) && String(password || '').trim() === adminPass) {
            socket.authenticated = true;
            socket.adminAttempts = 0;
            adminSockets.add(socket);
            socket.emit('admin-auth-success');
            socket.emit('admin-premium-data', premiumSnapshot());
            socket.emit('admin-reward-data', rewardSnapshot());
            socket.emit('admin-banned-data', bannedSnapshot());
            socket.emit('admin-moderator-data', { permissions: MODERATION_PERMISSIONS, moderators: moderatorSnapshot() });
            socket.emit('admin-bots-data', botsSnapshot());
            socket.emit('admin-economy-data', economyDashboardSnapshot());
            emitAdminUsers(socket);
        } else {
            socket.adminAttempts = (socket.adminAttempts || 0) + 1;
            if (socket.adminAttempts >= 5) {
                socket.adminLockUntil = now + 60 * 1000;
                socket.adminAttempts = 0;
            }
            socket.emit('admin-auth-fail');
        }
    });

    socket.on('admin-reports-data', () => { if (!socket.authenticated) return; emitAdminReports(socket); });
    socket.on('admin-report-status', ({ id, status = 'handled' } = {}) => { if (!socket.authenticated) return; const report = botData.adminReports.find(item => item.id === id); if (!report || !['new', 'handled'].includes(status)) return; report.status = status; report.handledAt = status === 'handled' ? new Date().toISOString() : null; saveBotData(); for (const adminSocket of adminSockets) emitAdminReports(adminSocket); });
    socket.on('admin-report-delete', ({ id } = {}) => { if (!socket.authenticated) return; const before = botData.adminReports.length; botData.adminReports = botData.adminReports.filter(item => item.id !== id); if (botData.adminReports.length === before) return; saveBotData(); for (const adminSocket of adminSockets) emitAdminReports(adminSocket); });
    socket.on('admin-users-data', () => {
        if (!socket.authenticated) return;
        emitAdminUsers(socket);
    });

    socket.on('admin-moderator-data', () => {
        if (!socket.authenticated) return;
        socket.emit('admin-moderator-data', { permissions: MODERATION_PERMISSIONS, moderators: moderatorSnapshot() });
    });
    socket.on('admin-moderator-create', ({ permissions } = {}) => {
        if (!socket.authenticated) return;
        const result = createModerator(Array.isArray(permissions) ? permissions : []);
        socket.emit('admin-moderator-credentials', result);
        socket.emit('admin-moderator-status', { ok: true, message: 'Moderador creado. Guarda sus credenciales; la contraseña no se volverá a mostrar.' });
        socket.emit('admin-moderator-data', { permissions: MODERATION_PERMISSIONS, moderators: moderatorSnapshot() });
    });
    socket.on('admin-moderator-revoke', ({ id } = {}) => {
        if (!socket.authenticated || !botData.moderators[id]) return;
        botData.moderators[id].active = false;
        saveBotData();
        socket.emit('admin-moderator-status', { ok: true, message: 'Moderador revocado.' });
        socket.emit('admin-moderator-data', { permissions: MODERATION_PERMISSIONS, moderators: moderatorSnapshot() });
    });

    socket.on('moderator-auth', ({ username, password } = {}) => {
        const submittedUser = normalizeWebLogin(username);
        const moderator = Object.values(botData.moderators || {}).find(item => item.active !== false && normalizeWebLogin(item.username) === submittedUser && item.passwordHash === hashModeratorSecret(String(password || '').trim()));
        if (!moderator) return socket.emit('moderator-auth-fail');
        socket.moderatorAuthenticated = true;
        socket.moderatorPermissions = moderator.permissions || [];
        socket.emit('moderator-auth-success', { permissions: socket.moderatorPermissions, labels: MODERATION_PERMISSIONS });
    });

    socket.on('moderator-supertoken-generate', ({ days } = {}) => {
        if (!hasModerationPermission(socket, 'generate_supertoken')) return socket.emit('moderator-status', { ok: false, message: 'No tienes permiso para generar SuperTokens.' });
        const result = createSuperToken(days);
        socket.emit('moderator-supertoken-token', result);
    });
    socket.on('moderator-users-data', () => {
        if (!hasModerationPermission(socket, 'view_users')) return socket.emit('moderator-status', { ok: false, message: 'No tienes permiso para ver usuarios.' });
        emitAdminUsers(socket);
    });
    socket.on('moderator-bots-data', () => {
        if (!hasModerationPermission(socket, 'view_bots')) return socket.emit('moderator-status', { ok: false, message: 'No tienes permiso para ver sesiones.' });
        socket.emit('moderator-bots-data', botsSnapshot());
    });
    socket.on('moderator-ban-number', async ({ number } = {}) => {
        if (!hasModerationPermission(socket, 'ban_numbers')) return socket.emit('moderator-status', { ok: false, message: 'No tienes permiso para bloquear números.' });
        const target = normalizePhoneNumber(number);
        if (!target) return socket.emit('moderator-status', { ok: false, message: 'Escribe un número válido con código de país.' });
        botData.bannedNumbers[target] = { bannedAt: new Date().toISOString() };
        saveBotData();
        let disconnected = 0;
        for (const [sessionId, session] of Object.entries(sessions)) {
            if (sessionNumber(session) !== target) continue;
            try { if (session.sock) await session.sock.logout(); } catch (error) {}
            try { if (fs.existsSync(session.authPath)) fs.removeSync(session.authPath); } catch (error) {}
            session.isConnected = false;
            delete sessions[sessionId];
            disconnected++;
        }
        socket.emit('moderator-status', { ok: true, message: `Número baneado y desvinculado. Sesiones cerradas: ${disconnected}.` });
        broadcastDashboardStats();
    });

    socket.on('admin-ban-number', async ({ number } = {}) => {
        if (!socket.authenticated) return;
        const target = normalizePhoneNumber(number);
        if (!target) return socket.emit('admin-ban-status', { ok: false, message: 'Escribe un número válido con código de país.' });
        botData.bannedNumbers[target] = { bannedAt: new Date().toISOString() };
        saveBotData();
        let disconnected = 0;
        for (const [sessionId, session] of Object.entries(sessions)) {
            if (sessionNumber(session) !== target) continue;
            try { if (session.sock) await session.sock.logout(); } catch (error) { console.warn(`No se pudo cerrar ${sessionId}:`, error.message); }
            try { if (fs.existsSync(session.authPath)) fs.removeSync(session.authPath); } catch (error) { console.warn(`No se pudo borrar la sesión ${sessionId}:`, error.message); }
            session.isConnected = false;
            delete sessions[sessionId];
            disconnected++;
        }
        socket.emit('admin-ban-status', { ok: true, message: `Número ${target} baneado. Sesiones desvinculadas: ${disconnected}.` });
        socket.emit('admin-banned-data', bannedSnapshot());
        broadcastDashboardStats();
    });

    socket.on('admin-unban-number', ({ number } = {}) => {
        if (!socket.authenticated) return;
        const target = normalizePhoneNumber(number);
        if (!target || !botData.bannedNumbers[target]) return socket.emit('admin-ban-status', { ok: false, message: 'No se encontró ese número en la lista de baneados.' });
        delete botData.bannedNumbers[target];
        saveBotData();
        socket.emit('admin-ban-status', { ok: true, message: `Número ${target} desbloqueado.` });
        socket.emit('admin-banned-data', bannedSnapshot());
    });
    socket.on('admin-user-rename', ({ number, name } = {}) => {
        if (!socket.authenticated) return;
        const target = String(number || '').replace(/\D/g, '');
        const nextName = String(name || '').trim().replace(/\s+/g, ' ');
        const normalized = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!target || nextName.length < 2 || nextName.length > 32) return adminUserStatus(socket, 'El nombre debe tener entre 2 y 32 caracteres.', false);
        const wanted = normalized(nextName);
        const conflict = Object.entries(botData.profiles || {}).some(([jid, profile]) => publicNumber(jid) !== target && profile?.registered && profile?.name && (normalized(profile.name) === wanted || normalized(profile.name).includes(wanted) || wanted.includes(normalized(profile.name))));
        if (conflict) return adminUserStatus(socket, 'Ese nombre ya está ocupado o es demasiado parecido a otro usuario.', false);
        let changed = false;
        for (const [jid, profile] of Object.entries(botData.profiles || {})) if (publicNumber(jid) === target) { profile.name = nextName; changed = true; }
        if (!changed) return adminUserStatus(socket, 'No se encontró el perfil de ese usuario.', false);
        saveBotData();
        return adminUserStatus(socket, `Nombre actualizado a ${nextName}.`);
    });
    socket.on('admin-user-adjust-balance', ({ number, wallet = 'coins', action = 'add', amount } = {}) => {
        if (!socket.authenticated) return;
        const target = String(number || '').replace(/\D/g, '');
        const safeAmount = Math.floor(Number(amount) || 0);
        if (!target || !['coins', 'bank'].includes(wallet) || !['add', 'remove'].includes(action) || !Number.isSafeInteger(safeAmount) || safeAmount < 1 || safeAmount > 1000000000) return adminUserStatus(socket, 'Número, operación o cantidad inválida.', false);
        const wallets = adminWallets(target, action === 'add');
        if (!wallets.length) return adminUserStatus(socket, 'No se encontró la cartera de ese usuario.', false);
        if (action === 'add') wallets[0][wallet] = Math.max(0, Number(wallets[0][wallet]) || 0) + safeAmount;
        else {
            let remaining = safeAmount;
            for (const current of wallets) {
                current[wallet] = Math.max(0, Number(current[wallet]) || 0);
                const removed = Math.min(current[wallet], remaining);
                current[wallet] -= removed; remaining -= removed;
                if (!remaining) break;
            }
            if (remaining === safeAmount) return adminUserStatus(socket, 'Ese usuario no tiene saldo suficiente.', false);
        }
        saveBotData();
        return adminUserStatus(socket, `${action === 'add' ? 'Agregados' : 'Quitados'} ${safeAmount.toLocaleString('es-ES')} ${wallet === 'bank' ? 'coins del banco' : 'monedas de oro'} a ${target}.`);
    });
    socket.on('admin-user-achievement', ({ number, achievementId, action = 'add' } = {}) => {
        if (!socket.authenticated) return;
        const target = String(number || '').replace(/\D/g, '');
        const achievement = (commands.economy.achievements || []).find(item => item.id === achievementId);
        if (!target || !achievement || !['add', 'remove'].includes(action)) return adminUserStatus(socket, 'Logro u operación inválida.', false);
        const wallets = adminWallets(target, action === 'add');
        if (!wallets.length) return adminUserStatus(socket, 'No se encontró la cartera de ese usuario.', false);
        if (action === 'add') {
            wallets[0].rpg ||= { xp: 0, level: 1, lastXp: 0 };
            wallets[0].rpg.achievements ||= {};
            wallets[0].rpg.achievements[achievement.id] ||= { unlockedAt: new Date().toISOString(), reward: achievement.reward, source: 'admin' };
        } else {
            for (const wallet of wallets) if (wallet.rpg?.achievements) delete wallet.rpg.achievements[achievement.id];
        }
        saveBotData();
        return adminUserStatus(socket, `${action === 'add' ? 'Logro agregado:' : 'Logro quitado:'} ${achievement.title}`);
    });
    socket.on('admin-user-item', ({ number, item, action = 'add' } = {}) => {
        if (!socket.authenticated) return;
        const target = String(number || '').replace(/\D/g, '');
        const meta = commands.economy.items?.[item];
        if (!target || !meta || !['add', 'remove'].includes(action)) return adminUserStatus(socket, 'Objeto u operación inválida.', false);
        const wallets = adminWallets(target, action === 'add');
        if (!wallets.length) return adminUserStatus(socket, 'No se encontró la cartera de ese usuario.', false);
        if (action === 'add') {
            wallets[0].tools ||= {};
            wallets[0].tools[item] = { durability: meta.durability, maxDurability: meta.durability, boughtAt: new Date().toISOString(), source: 'admin' };
        } else for (const wallet of wallets) if (wallet.tools) delete wallet.tools[item];
        saveBotData();
        return adminUserStatus(socket, `${action === 'add' ? 'Objeto agregado:' : 'Objeto quitado:'} ${meta.name}`);
    });
    socket.on('admin-user-remove-coins', ({ number, amount } = {}) => {
        if (!socket.authenticated) return;
        const target = String(number || '').replace(/\D/g, '');
        const safeAmount = Math.floor(Number(amount) || 0);
        if (!target || !Number.isSafeInteger(safeAmount) || safeAmount < 1 || safeAmount > 1000000000) {
            socket.emit('admin-users-status', { ok: false, message: 'Indica un número y una cantidad válida entre 1 y 1.000.000.000.' });
            return;
        }
        let remaining = safeAmount;
        for (const state of Object.values(botData.economy || {})) {
            for (const [jid, wallet] of Object.entries(state?.users || {})) {
                if (publicNumber(jid) !== target || remaining <= 0) continue;
                wallet.coins = Math.max(0, Number(wallet.coins) || 0);
                wallet.bank = Math.max(0, Number(wallet.bank) || 0);
                const fromCoins = Math.min(wallet.coins, remaining);
                wallet.coins -= fromCoins; remaining -= fromCoins;
                const fromBank = Math.min(wallet.bank, remaining);
                wallet.bank -= fromBank; remaining -= fromBank;
            }
        }
        const removed = safeAmount - remaining;
        if (!removed) {
            socket.emit('admin-users-status', { ok: false, message: 'No se encontró saldo para ese usuario.' });
            return;
        }
        saveBotData();
        socket.emit('admin-users-status', { ok: true, message: `Se quitaron ${removed.toLocaleString('es-ES')} monedas de oro a ${target}.` });
        emitAdminUsers(socket);
        io.emit('public-leaderboard', publicLeaderboardSnapshot());
    });
    socket.on('admin-supertoken-generate', ({ days } = {}) => {
        if (!socket.authenticated) return;
        const result = createSuperToken(days);
        socket.emit('admin-supertoken-token', result);
        socket.emit('admin-premium-status', { ok: true, message: 'SuperToken generado. Cópialo y entrégaselo al usuario.' });
        socket.emit('admin-premium-data', premiumSnapshot());
    });

    socket.on('admin-premium-data', () => {
        if (!socket.authenticated) return;
        socket.emit('admin-premium-data', premiumSnapshot());
    });

    socket.on('admin-reward-generate', ({ coins, tools } = {}) => {
        if (!socket.authenticated) return;
        const safeCoins = Math.floor(Number(coins) || 0);
        if (!Number.isSafeInteger(safeCoins) || safeCoins < 1 || safeCoins > 1000000000) {
            socket.emit('admin-premium-status', { ok: false, message: 'Indica una cantidad válida entre 1 y 1.000.000.000 monedas de oro.' });
            return;
        }
        const result = createRewardToken(safeCoins, tools);
        socket.emit('admin-reward-token', result);
        socket.emit('admin-premium-status', { ok: true, message: 'Paquete de regalo generado. Cópialo y entrégaselo al usuario.' });
        socket.emit('admin-reward-data', rewardSnapshot());
    });

    socket.on('admin-reward-data', () => {
        if (!socket.authenticated) return;
        socket.emit('admin-reward-data', rewardSnapshot());
    });

    socket.on('admin-reward-remove-token', ({ id } = {}) => {
        if (!socket.authenticated) return;
        if (!id || !botData.rewardTokens[id]) {
            socket.emit('admin-premium-status', { ok: false, message: 'No se encontró ese token de regalo.' });
            return;
        }
        delete botData.rewardTokens[id];
        saveBotData();
        socket.emit('admin-premium-status', { ok: true, message: 'Token de regalo eliminado correctamente.' });
        socket.emit('admin-reward-data', rewardSnapshot());
    });

    socket.on('admin-promote-channel', async () => {
        if (!socket.authenticated) return;
        if (global.adminPromotionRunning) {
            socket.emit('admin-promo-result', { error: 'Ya hay una promoción en curso.' });
            return;
        }
        global.adminPromotionRunning = true;
        socket.emit('admin-promo-status', { running: true, message: 'Promoción iniciada. Revisando grupos permitidos...' });
        const totals = { sent: 0, skipped: 0, failed: 0, bots: 0 };
        try {
            for (const session of Object.values(sessions)) {
                if (!session?.isConnected || !session.sock?.user) continue;
                totals.bots++;
                try {
                    const state = session.promoState || (session.promoState = {});
                    const result = await promoNikuMd.runPromotion(session.sock, state);
                    totals.sent += result.sent;
                    totals.skipped += result.skipped;
                    totals.failed += result.failed;
                } catch (error) {
                    totals.failed++;
                }
            }
            socket.emit('admin-promo-result', totals);
        } finally {
            global.adminPromotionRunning = false;
            socket.emit('admin-promo-status', { running: false });
        }
    });

    socket.on('admin-premium-remove-user', ({ jid } = {}) => {
        if (!socket.authenticated) return;
        const normalized = normalizePremiumJid(jid);
        if (!normalized || !botData.premiumUsers[normalized]) {
            socket.emit('admin-premium-status', { ok: false, message: 'No se encontró ese usuario Premium.' });
            return;
        }
        delete botData.premiumUsers[normalized];
        saveBotData();
        socket.emit('admin-premium-status', { ok: true, message: `Premium retirado: ${normalized.split('@')[0]}` });
        socket.emit('admin-premium-data', premiumSnapshot());
    });

    socket.on('admin-premium-remove-token', ({ id } = {}) => {
        if (!socket.authenticated) return;
        if (!id || !superTokensStore()[id]) {
            socket.emit('admin-premium-status', { ok: false, message: 'No se encontró ese token.' });
            return;
        }
        delete superTokensStore()[id];
        saveBotData();
        socket.emit('admin-premium-status', { ok: true, message: 'Token eliminado correctamente.' });
        socket.emit('admin-premium-data', premiumSnapshot());
    });

    socket.on('set-user', (userId) => {
        userSockets[userId] = socket.id;
        if (!sessions[userId]) sessions[userId] = new BotSession(userId);
        sessions[userId].sendConnectionStatus();
        broadcastDashboardStats();
    });

    // Pair request - still available via web for web users
    socket.on('pair-request', async ({ userId, number }) => {
        const targetNumber = normalizePhoneNumber(number);
        if (!targetNumber) {
            socket.emit('pair-error', 'Introduce un número válido con código de país.');
            return;
        }
        if (isNumberBanned(targetNumber)) {
            if (userId && sessions[userId]) delete sessions[userId];
            socket.emit('pair-error', 'Este número ha sido baneado y no puede vincularse al bot.');
            return;
        }
        if (sessions[userId]) {
            if (!botData.statusSettings[userId]) {
                botData.statusSettings[userId] = {
                    autoStatus: false,
                    autoSeen: false,
                    autoLike: false,
                    autoDownload: false,
                    isPublic: true
                };
                saveBotData();
            }
            sessions[userId].tgChatId = null;
            await sessions[userId].initialize(targetNumber);
        } else {
            sessions[userId] = new BotSession(userId);
            if (!botData.statusSettings[userId]) {
                botData.statusSettings[userId] = {
                    autoStatus: false,
                    autoSeen: false,
                    autoLike: false,
                    autoDownload: false,
                    isPublic: true
                };
                saveBotData();
            }
            sessions[userId].tgChatId = null;
            await sessions[userId].initialize(targetNumber);
        }
    });

    // BROADCAST MESSAGE - Send to all connected users
    socket.on('broadcast', async ({ message }) => {
        if (!socket.authenticated) return;

        const activeBots = getAllActiveSockets();
        let totalSent = 0;
        let totalChats = 0;

        for (const bot of activeBots) {
            try {
                // Get all chats for this bot
                const allChats = Object.keys(bot.sock.chats || {});
                const personalChats = allChats.filter(jid => jid.endsWith('@s.whatsapp.net') || jid.endsWith('@g.us'));

                for (const jid of personalChats) {
                    try {
                        await bot.sock.sendMessage(jid, {
                            text: `\u{1F4E2} *BROADCAST MESSAGE* \u{1F4E2}\n\n${message}\n\n_From: SYED MINI Bot Admin_`
                        });
                        totalSent++;
                    } catch (e) {}
                }
                totalChats += personalChats.length;
            } catch (e) {
                console.error('Broadcast error:', e.message);
            }
        }

        // Save to history
        botData.broadcastHistory.unshift({
            message,
            timestamp: new Date().toISOString(),
            totalSent,
            totalBots: activeBots.length
        });
        if (botData.broadcastHistory.length > 50) botData.broadcastHistory.pop();
        saveBotData();

        socket.emit('broadcast-result', { totalSent, totalBots: activeBots.length, totalChats });
    });

    // STOP BOT - Disconnect a specific bot
    socket.on('stop-bot', async ({ sessionId }) => {
        if (!socket.authenticated) return;

        if (sessions[sessionId] && sessions[sessionId].sock) {
            try {
                await sessions[sessionId].sock.logout();
                sessions[sessionId].isConnected = false;
                if (botData.subbots[sessionId]) {
                    botData.subbots[sessionId].status = 'revocado';
                    botData.subbots[sessionId].revokedAt = new Date().toISOString();
                    saveBotData();
                }
                delete sessions[sessionId];
                socket.emit('bot-stopped', { sessionId, success: true });
                socket.emit('admin-bots-data', botsSnapshot());
            } catch (e) {
                socket.emit('bot-stopped', { sessionId, success: false, error: e.message });
            }
        }
    });

    // STOP ALL BOTS
    socket.on('stop-all-bots', async () => {
        if (!socket.authenticated) return;

        let stopped = 0;
        for (const [sessionId, session] of Object.entries(sessions)) {
            try {
                if (session.sock) {
                    await session.sock.logout();
                    session.isConnected = false;
                    if (botData.subbots[sessionId]) {
                        botData.subbots[sessionId].status = 'revocado';
                        botData.subbots[sessionId].revokedAt = new Date().toISOString();
                    }
                    stopped++;
                }
            } catch (e) {}
        }
        saveBotData();
        socket.emit('all-bots-stopped', { stopped });
    });

    // GET CONNECTED BOTS LIST
    socket.on('get-bots-list', () => {
        if (!socket.authenticated) return;
        socket.emit('bots-list', botsSnapshot());
        socket.emit('admin-bots-data', botsSnapshot());
    });

    // GET BROADCAST HISTORY
    socket.on('get-broadcast-history', () => {
        if (!socket.authenticated) return;
        socket.emit('broadcast-history', botData.broadcastHistory || []);
    });

    socket.on('disconnect', () => {
        adminSockets.delete(socket);
        for (const [userId, socketId] of Object.entries(userSockets)) {
            if (socketId === socket.id) {
                delete userSockets[userId];
                break;
            }
        }
        broadcastDashboardStats();
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
    console.log(`\u{1F311} niku666MDBOT v${settings.version} Server running on port ${PORT}`);
    console.log(`\u{1F4E1} Total commands loaded: 120+`);
    console.log(`\u{1F310} Web Dashboard: http://localhost:${PORT}`);
    const backupOptions = { dataFile: DATA_FILE, authDir: AUTH_DIR, uploadsDir: UPLOADS_DIR };
    let restored = false;
    if (telegramBackup.enabled() && tgBot) {
        try {
            restored = await telegramBackup.restoreBackup({ ...backupOptions, bot: tgBot });
        } catch (error) {
            console.error('[Respaldo Telegram] No se pudo restaurar la copia cifrada:', error.response?.body?.description || error.message);
        }
    } else {
        console.log(`[Respaldo Telegram] Desactivado; faltan variables: ${telegramBackup.missingVariables().join(', ')}.`);
    }
    if (!restored && githubBackup.enabled()) {
        try {
            restored = await githubBackup.restoreBackup(backupOptions);
        } catch (error) {
            console.error('[Backup] No se pudo restaurar el estado cifrado:', error.response?.data?.message || error.message);
        }
    }
    if (restored) loadBotDataFromDisk();
    if (!telegramBackup.enabled() && !githubBackup.enabled()) console.log('[Backup] No hay backup remoto cifrado configurado; se usará el almacenamiento local.');
    await loadExistingSessions();
    telegramBackup.scheduleBackup({ ...backupOptions, bot: tgBot });
    broadcastDashboardStats();
});

setInterval(() => { settleExpiredAuctions(); broadcastDashboardStats(); }, 5000).unref();
