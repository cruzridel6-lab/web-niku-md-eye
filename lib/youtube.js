const ytdl = require('youtube-dl-exec');
const { execFileSync } = require('child_process');
const axios = require('axios');

function extractYoutubeId(value) {
    try {
        const parsed = new URL(value);
        if (parsed.hostname === 'youtu.be') return parsed.pathname.slice(1).split('/')[0];
        if (parsed.searchParams.get('v')) return parsed.searchParams.get('v');
        const parts = parsed.pathname.split('/').filter(Boolean);
        const marker = parts.findIndex((part) => ['shorts', 'embed', 'live'].includes(part));
        return marker >= 0 ? parts[marker + 1] : undefined;
    } catch {
        return undefined;
    }
}

async function getCnvUrl(url, format) {
    const videoId = extractYoutubeId(url);
    if (!videoId || videoId.length !== 11) throw new Error('Invalid YouTube video ID');
    const headers = {
        'User-Agent': 'Mozilla/5.0',
        origin: 'https://frame.y2meta-uk.com'
    };
    const keyResponse = await axios.get(`https://cnv.cx/v2/sanity/key?id=${encodeURIComponent(videoId)}`, {
        headers,
        timeout: 20000
    });
    const key = keyResponse.data?.key;
    if (!key) throw new Error('cnv.cx did not return a temporary key');
    const audio = /audio|mp3|m4a|opus/i.test(String(format));
    const body = new URLSearchParams({
        link: url,
        format: audio ? 'mp3' : 'mp4',
        ...(audio ? { audioBitrate: '128' } : { videoQuality: '360', vCodec: 'h264' }),
        filenameStyle: 'pretty'
    });
    const converted = await axios.post('https://cnv.cx/v2/converter', body.toString(), {
        headers: { ...headers, key, 'content-type': 'application/x-www-form-urlencoded' },
        timeout: 60000
    });
    const direct = converted.data?.url;
    if (!direct || !/^https?:\/\//i.test(direct)) {
        throw new Error(converted.data?.errorMsg || 'cnv.cx returned no download URL');
    }
    return direct;
}

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
    // cnv.cx is the working provider used by the reviewed ZenBot base.
    // It issues a short-lived key per YouTube video; no API key is stored.
    try {
        return await getCnvUrl(url, format);
    } catch (error) {
        console.warn('cnv.cx failed:', error.message);
    }
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

async function downloadDirectFile(url, maxBytes = 100 * 1024 * 1024) {
    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 120000,
        maxContentLength: maxBytes,
        maxBodyLength: maxBytes,
        headers: {
            'User-Agent': 'Mozilla/5.0',
            Referer: 'https://frame.y2meta-uk.com/'
        }
    });
    const buffer = Buffer.from(response.data);
    if (!buffer.length) throw new Error('The download provider returned an empty file');
    return buffer;
}

module.exports = { getDirectUrl, downloadDirectFile };
