const net = require('net');
const dns = require('dns').promises;
const { URL } = require('url');

const FIRST_PORT = 1;
const LAST_PORT = 65535;
const SCAN_CONCURRENCY = 192;
const PORT_TIMEOUT = 900;
const SERVICE_NAMES = {
    20: 'FTP-DATA', 21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP', 53: 'DNS',
    80: 'HTTP', 110: 'POP3', 123: 'NTP', 135: 'RPC', 139: 'NetBIOS', 143: 'IMAP',
    161: 'SNMP', 389: 'LDAP', 443: 'HTTPS', 445: 'SMB', 465: 'SMTPS', 587: 'SMTP submission',
    636: 'LDAPS', 1433: 'MSSQL', 1521: 'Oracle', 2049: 'NFS', 2375: 'Docker',
    3000: 'Node/HTTP', 3306: 'MySQL', 3389: 'RDP', 5432: 'PostgreSQL', 5900: 'VNC',
    6379: 'Redis', 6443: 'Kubernetes', 8000: 'HTTP alternativo', 8080: 'HTTP alternativo',
    8443: 'HTTPS alternativo', 9200: 'Elasticsearch', 27017: 'MongoDB'
};

function normalizeTarget(input) {
    let value = String(input || '').trim();
    if (!value) throw new Error('Debes indicar un dominio, una URL o una IP.');
    if (!/^[a-z][a-z\d+.-]*:\/\//i.test(value)) value = `https://${value}`;

    let parsed;
    try {
        parsed = new URL(value);
    } catch {
        throw new Error('Formato inválido. Usa, por ejemplo: .portscan ejemplo.com');
    }

    const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (!hostname || /[^a-z\d.:%-]/i.test(hostname)) {
        throw new Error('El dominio o la IP no son válidos.');
    }
    return hostname;
}

function isPrivateAddress(address) {
    if (net.isIPv4(address)) {
        const [a, b] = address.split('.').map(Number);
        return a === 10 || a === 127 || a === 0 ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168);
    }
    if (net.isIPv6(address)) {
        const normalized = address.toLowerCase();
        return normalized === '::1' || normalized === '::' ||
            normalized.startsWith('fc') || normalized.startsWith('fd') ||
            normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
            normalized.startsWith('fea') || normalized.startsWith('feb');
    }
    return false;
}

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function lookupAddresses(hostname) {
    if (net.isIP(hostname)) return [{ address: hostname, family: net.isIPv4(hostname) ? 4 : 6 }];
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const addresses = await dns.lookup(hostname, { all: true, verbatim: false });
            if (addresses.length) return addresses;
        } catch (error) {
            lastError = error;
            if (!['EAI_AGAIN', 'ETIME', 'ESERVFAIL', 'ENOTFOUND'].includes(error.code)) throw error;
            if (attempt < 2) await wait(500 * (attempt + 1));
        }
    }
    for (const resolver of [dns.resolve4, dns.resolve6]) {
        try {
            const records = await resolver(hostname);
            if (records?.length) return records.map(address => ({ address, family: net.isIPv4(address) ? 4 : 6 }));
        } catch (error) { lastError = error; }
    }
    if (lastError?.code === 'EAI_AGAIN' || lastError?.code === 'ETIME') {
        throw new Error(`El DNS no respondió después de varios intentos para ${hostname}. Intenta de nuevo en unos segundos.`);
    }
    if (lastError?.code === 'ENOTFOUND' || lastError?.code === 'ESERVFAIL') {
        throw new Error(`El dominio ${hostname} no existe o no tiene registros DNS públicos.`);
    }
    throw new Error(`No se pudo resolver ${hostname}.`);
}

function scanPort(host, port, timeout = PORT_TIMEOUT) {
    return new Promise(resolve => {
        const socket = new net.Socket();
        let finished = false;
        const finish = (open, reason = '') => {
            if (finished) return;
            finished = true;
            socket.destroy();
            resolve({ port, open, reason });
        };
        socket.setTimeout(timeout);
        socket.once('connect', () => finish(true));
        socket.once('timeout', () => finish(false, 'timeout'));
        socket.once('error', error => finish(false, error.code || 'error'));
        socket.connect({ host, port });
    });
}

async function scanPorts(host) {
    const openPorts = [];
    let nextPort = FIRST_PORT;
    async function worker() {
        while (true) {
            const port = nextPort++;
            if (port > LAST_PORT) return;
            const result = await scanPort(host, port);
            if (result.open) openPorts.push(result.port);
        }
    }
    await Promise.all(Array.from({ length: SCAN_CONCURRENCY }, worker));
    return openPorts.sort((a, b) => a - b);
}

module.exports = async function portscanCommand(sock, chatId, msg, q) {
    try {
        const hostname = normalizeTarget(q);
        await sock.sendMessage(chatId, {
            text: `🔎 Analizando ${hostname}...\nRevisando todos los puertos TCP (1–65535). Puede tardar unos minutos.`
        }, { quoted: msg });

        const addresses = await lookupAddresses(hostname);
        const publicAddress = addresses.find(item => !isPrivateAddress(item.address));
        if (!publicAddress) {
            throw new Error('El dominio no resuelve a una dirección pública.');
        }

        const openPorts = await scanPorts(publicAddress.address);
        let text = `🔎 *Escaneo completo de puertos: ${hostname}*\n`;
        text += `📍 IP: ${publicAddress.address}\n\n`;

        if (!openPorts.length) {
            text += '✅ No se detectaron puertos TCP abiertos.\n';
        } else {
            text += `*Puertos abiertos (${openPorts.length}):*\n`;
            text += openPorts.map(port => `✅ ${port} — ${SERVICE_NAMES[port] || 'Servicio no identificado'}`).join('\n');
            text += '\n';
        }
        text += `\n_Revisados los ${LAST_PORT.toLocaleString('es-ES')} puertos TCP._`;
        await sock.sendMessage(chatId, { text }, { quoted: msg });
    } catch (error) {
        console.error('Error en portscan:', error);
        await sock.sendMessage(chatId, {
            text: `❌ No se pudo completar el escaneo: ${error.message}`
        }, { quoted: msg });
    }
};

module.exports.normalizeTarget = normalizeTarget;
module.exports.lookupAddresses = lookupAddresses;
module.exports.scanPort = scanPort;
module.exports.scanPorts = scanPorts;
