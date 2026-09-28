const ytdl = require('youtube-dl-exec');

function lastUrl(value) {
    const output = typeof value === 'string' ? value : value?.stdout;
    const urls = String(output || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => /^https?:\/\//i.test(line));
    return urls.at(-1);
}

async function getDirectUrl(url, format) {
    const result = await ytdl(url, {
        getUrl: true,
        noPlaylist: true,
        format,
        retries: 2,
        socketTimeout: 30000
    });
    const direct = lastUrl(result);
    if (!direct) throw new Error('yt-dlp returned no playable URL');
    return direct;
}

module.exports = { getDirectUrl };
