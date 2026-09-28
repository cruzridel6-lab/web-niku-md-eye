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
    const jsRuntime = resolveJsRuntime();
    const configuredClient = process.env.YTDLP_EXTRACTOR_ARGS;
    const extractorVariants = configuredClient
        ? [configuredClient]
        : ['youtube:player_client=web_safari', 'youtube:player_client=android', 'youtube:player_client=mweb'];
    let lastError;

    for (const extractorArgs of extractorVariants) {
        const options = {
            getUrl: true,
            noPlaylist: true,
            format,
            retries: 2,
            socketTimeout: 30000,
            extractorArgs,
            remoteComponents: 'ejs:github'
        };
        if (jsRuntime) options.jsRuntimes = jsRuntime;
        try {
            const result = await ytdl(url, options);
            const direct = lastUrl(result);
            if (direct) return direct;
        } catch (error) {
            lastError = error;
        }
    }

    throw new Error(lastError?.message?.split('\n')[0] || 'yt-dlp returned no playable URL');
}

module.exports = { getDirectUrl };
