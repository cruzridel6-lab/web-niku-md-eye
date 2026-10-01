const net = require('net');
const dns = require('dns').promises;
const { URL } = require('url');

const COMMON_PORTS = [21, 22, 23, 25, 53, 80, 110, 143, 443, 445, 3306, 3389, 5432, 5900, 8080, 8443];
const SERVICE_NAMES = {
    21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP', 53: 'DNS',
    80: 'HTTP', 110: 'POP3', 143: 'IMAP', 443: 'HTTPS', 445: 'SMB',
    3306: 'MySQL', 3389: 'RDP', 5432: 'PostgreSQL', 5900: 'VNC',
    8080: 'HTTP alternativo', 8443: 'HTTPS alternativo'
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

function scanPort(host, port, timeout = 1800) {
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
    const results = [];
    for (let i = 0; i < COMMON_PORTS.length; i += 4) {
        const batch = COMMON_PORTS.slice(i, i + 4);
        const scanned = await Promise.all(batch.map(port => scanPort(host, port)));
        results.push(...scanned);
    }
    return results;
}

module.exports = async function portscanCommand(sock, chatId, msg, q) {
    try {
        const hostname = normalizeTarget(q);
        await sock.sendMessage(chatId, {
            text: `🔎 Analizando ${hostname}...\nPuertos comunes únicamente (escaneo rápido)`
        }, { quoted: msg });

        const addresses = net.isIP(hostname)
            ? [{ address: hostname, family: net.isIPv4(hostname) ? 4 : 6 }]
            : await dns.lookup(hostname, { all: true });
        const publicAddress = addresses.find(item => !isPrivateAddress(item.address));
        if (!publicAddress) {
            throw new Error('El dominio no resuelve a una dirección pública.');
        }

        const results = await scanPorts(publicAddress.address);
        const openPorts = results.filter(result => result.open);
        let text = `🔎 *Escaneo de puertos: ${hostname}*\n`;
        text += `📍 IP: ${publicAddress.address}\n\n`;

        if (!openPorts.length) {
            text += '✅ No se detectaron puertos abiertos entre los puertos comunes revisados.\n';
            text += 'ℹ️ Esto no significa que todos los puertos estén cerrados; solo se revisaron los puertos indicados.';
        } else {
            text += `*Puertos abiertos (${openPorts.length}):*\n`;
            for (const result of openPorts) {
                text += `✅ ${result.port} — ${SERVICE_NAMES[result.port] || 'Desconocido'}\n`;
            }
        }
        text += `\n\n_Revisados ${COMMON_PORTS.length} puertos comunes._`;
        await sock.sendMessage(chatId, { text }, { quoted: msg });
    } catch (error) {
        console.error('Error en portscan:', error);
        await sock.sendMessage(chatId, {
            text: `❌ No se pudo completar el escaneo: ${error.message}`
        }, { quoted: msg });
    }
};

module.exports.normalizeTarget = normalizeTarget;
module.exports.scanPort = scanPort;
