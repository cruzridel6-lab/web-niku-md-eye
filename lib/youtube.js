const ytdl = require('youtube-dl-exec');
const { execFileSync } = require('child_process');

function resolveJsRuntime() {
    if (process.env.YTDLP_JS_RUNTIME) return process.env.YTDLP_JS_RUNTIME;
    try {
        execFileSync('deno', ['--version'], { stdio: 'ignore' });
        return 'deno';
    } catch {
        return undefined;
    }
}

function lastUrl(value) {
    const output = typeof value === 'string' ? value : value?.stdout;
    const urls = String(output || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => /^https?:\/\//i.test(line));
    return urls.at(-1);
}

async function getDirectUrl(url, format) {
    const options = {
        getUrl: true,
        noPlaylist: true,
        format,
        retries: 2,
        socketTimeout: 30000,
        extractorArgs: process.env.YTDLP_EXTRACTOR_ARGS || 'youtube:player_client=web_safari'
    };
    const jsRuntime = resolveJsRuntime();
    if (jsRuntime) options.jsRuntimes = jsRuntime;

    const result = await ytdl(url, options);
    const direct = lastUrl(result);
    if (!direct) throw new Error('yt-dlp returned no playable URL');
    return direct;
}

module.exports = { getDirectUrl };
