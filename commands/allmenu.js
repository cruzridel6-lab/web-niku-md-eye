const settings = require('../settings');

async function allMenu(sock, from, msg, session, commands) {
    // ===== HEAVY BOX HEADER =====
    const categories = {
        '👑 OWNER': ['public', 'private', 'mode', 'owner', 'setname', 'block', 'unblock', 'bcgc', 'bcall', 'restart', 'shutdown', 'xrestart', 'xshutdown', 'clear', 'backup', 'restore', 'clone'],
        '👥 GROUP': ['kick', 'add', 'mute', 'unmute', 'tagall', 'hidetag', 'grouplink', 'groupinfo', 'join', 'leave', 'setdesc', 'setppgc', 'getbio', 'getdp', 'accept', 'poll', 'everyonemsg', 'listonline', 'tagme', 'mention', 'kickoffline', 'snipe', 'editmsg', 'react', 'send', 'forward', 'save'],
        '🤖 AI': ['ai', 'chatbot', 'gali'],
        '⬇️ DOWNLOAD': ['song', 'video', 'insta', 'tiktok', 'facebook', 'youtube', 'pinterest', 'twitter', 'reddit', 'spotify', 'mf', 'apk', 'gdrive'],
        '🛠️ TOOLS': ['ping', 'fotoperfil', 'vv', 'translate', 'base64', 'qr', 'shorturl', 'calc', 'weather', 'github', 'ipinfo', 'tempmail', 'fakeinfo', 'binlookup', 'whois', 'dnslookup', 'portscan', 'screenshot', 'define', 'google', 'wiki', 'yts', 'playstore', 'npm', 'sticker', 'toimg', 'tomp3', 'tts', 'blur', 'invert', 'crop', 'flip', 'grayscale', 'removebg', 'enlarge', 'runtime', 'uptime', 'serverinfo', 'speedtest', 'device', 'report', 'reporte'],
        '⚔️ ECONOMÍA RPG': ['rpgmenu', 'registrarse', 'perfil', 'pfp', 'setbirth', 'setbio', 'setgenre', 'marry', 'divorce', 'historial', 'balance', 'baltop', 'nekotop', 'nikutop', 'nivel', 'estadisticas', 'rpgstatus', 'combate', 'raid', 'inventario', 'habilidades', 'fabricar', 'campaña', 'mercado', 'subastas', 'titulos', 'temporada', 'logros', 'mercader', 'explorar', 'recolectar', 'patrullar', 'minar', 'pescar', 'cazar', 'mazmorra', 'reparar', 'misiones', 'clan', 'daily', 'work', 'deposit', 'withdraw', 'pay', 'invertir', 'coinflip', 'roulette', 'crime', 'rob', 'slut', 'pocion', 'premio', 'einfo'],
        '🎉 FUN': ['joke', 'meme', 'dare', 'truth', 'ascii', 'roast', 'compliment', 'ship', 'emojimix', 'character', 'quote', 'fact', 'trivia', 'roll', 'riddle', 'wouldyourather'],
        '🕌 ISLAMIC': ['quran', 'hadith', 'prayer', 'qibla', 'asmaulhusna'],
        '🎌 ANIME': ['anime', 'manga'],
        '⚠️ OWNER-ONLY DEMOS': ['hack']
    };
    const available = new Set([...Object.keys(commands), ...Object.values(commands).flatMap(command => command?.aliases || [])]);
    for (const [category, list] of Object.entries(categories)) {
        categories[category] = list.filter(command => available.has(command));
    }
    const totalCommands = [...new Set(Object.values(categories).flat())].length;

    let allMenuText = `┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\n`;
    allMenuText += `┃  💀  *SYED MINI ALL MENU*  💀               ┃\n`;
    allMenuText += `┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫\n`;
    allMenuText += `┃  📋 TOTAL COMMANDS: ${String(totalCommands).padEnd(3)}                 ┃\n`;
    allMenuText += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;


    // ===== BUILD LIST (Compact per category) =====
    for (const [category, cmds] of Object.entries(categories)) {
        // Category Header with Heavy Box
        allMenuText += `┏━━━━━━ ❲ *${category}* ❳ ━━━━━━┓\n`;
        
        let line = `┃  ➤ `;
        cmds.forEach((cmd, index) => {
            line += `.${cmd}`;
            if (index < cmds.length - 1) line += `, `;
            
            // اگر لائن بہت لمبی ہو جائے تو توڑ دو (WhatsApp کیپشن سیف رکھنے کے لیے)
            if (line.length > 90) {
                allMenuText += `${line}\n`;
                line = `┃  ➤ `;
            }
        });
        // باقی بچی ہوئی لائن
        if (line !== `┃  ➤ `) allMenuText += `${line}\n`;
        
        allMenuText += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;
    }

    // ===== FOOTER =====
    allMenuText += `☠️  *POWERED BY : SYED MINI*  ☠️`;

    // ===== SEND =====
    try {
        await sock.sendMessage(from, { image: { url: settings.startimage }, caption: allMenuText }, { quoted: msg });
    } catch (e) {
        // Fallback
        await sock.sendMessage(from, { text: allMenuText }, { quoted: msg });
    }
}

module.exports = allMenu;
