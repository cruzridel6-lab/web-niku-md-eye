function publicNumber(jid) {
    return String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
}

function profileIdentityNumbers(key, profile, phoneAliases = {}) {
    const numbers = new Set();
    const add = value => {
        const number = publicNumber(value);
        if (number) numbers.add(number);
    };
    add(key);
    add(profile?.phoneNumber);

    let changed = true;
    while (changed) {
        changed = false;
        for (const [phone, lid] of Object.entries(phoneAliases || {})) {
            const phoneNumber = publicNumber(phone);
            const lidNumber = publicNumber(lid);
            if (numbers.has(phoneNumber) && lidNumber && !numbers.has(lidNumber)) {
                numbers.add(lidNumber);
                changed = true;
            }
            if (numbers.has(lidNumber) && phoneNumber && !numbers.has(phoneNumber)) {
                numbers.add(phoneNumber);
                changed = true;
            }
        }
    }
    return numbers;
}

function registeredProfileFor(botData, jid) {
    const wanted = publicNumber(jid);
    if (!wanted) return null;
    const profiles = botData?.profiles || {};
    const match = Object.entries(profiles).find(([key, profile]) =>
        profileIdentityNumbers(key, profile, botData?.phoneAliases).has(wanted) &&
        profile?.registered && profile?.name
    );
    return match ? match[1] : null;
}

function isGroupMessage(msg) {
    return /@g\.us$/i.test(String(msg?.key?.remoteJid || ''));
}

function registeredProfileForMessage(botData, msg, fallbackJid) {
    const key = msg?.key || {};
    const candidates = [
        fallbackJid,
        key.participant,
        key.participantAlt,
        key.senderPn
    ];
    if (!isGroupMessage(msg)) {
        // In direct chats Baileys may expose the phone/LID pair as remoteJid + remoteJidAlt.
        candidates.push(key.remoteJid, key.remoteJidAlt);
    }

    for (const candidate of new Set(candidates.filter(Boolean))) {
        const profile = registeredProfileFor(botData, candidate);
        if (profile?.registered) return profile;
    }
    return null;
}

function rememberPhoneAlias(botData, msg, sender) {
    if (!botData || typeof botData !== 'object') return false;
    if (!botData.phoneAliases || typeof botData.phoneAliases !== 'object' || Array.isArray(botData.phoneAliases)) {
        botData.phoneAliases = {};
    }

    const key = msg?.key || {};
    const isGroup = isGroupMessage(msg);
    const lidCandidates = [sender, key.participant, ...(!isGroup ? [key.remoteJid, key.remoteJidAlt] : [])];
    const phoneCandidates = isGroup
        ? [key.participantAlt, key.senderPn]
        : [key.participantAlt, key.senderPn, key.remoteJid, key.remoteJidAlt];
    const lid = lidCandidates.find(value => /@lid$/i.test(String(value || '')));
    const phone = phoneCandidates.find(value => /@s\.whatsapp\.net$/i.test(String(value || '')));
    const number = publicNumber(phone);
    if (!lid || !number || botData.phoneAliases[number] === lid) return false;

    botData.phoneAliases[number] = lid;
    return true;
}

module.exports = {
    publicNumber,
    profileIdentityNumbers,
    registeredProfileFor,
    registeredProfileForMessage,
    rememberPhoneAlias
};
