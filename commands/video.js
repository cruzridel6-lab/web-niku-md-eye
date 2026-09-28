const axios = require('axios');
const yts = require('yt-search');
const { getDirectUrl } = require('../lib/youtube');

const AXIOS_DEFAULTS = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json, text/plain, */*'
    }
};

async function tryRequest(getter, attempts = 3) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await getter();
        } catch (err) {
            lastError = err;
            if (attempt < attempts) {
                await new Promise(r => setTimeout(r, 1000 * attempt));
            }
        }
    }
    throw lastError;
}

async function getEliteProTechVideoByUrl(youtubeUrl) {
    const apiUrl = `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(youtubeUrl)}&format=mp4`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.success && res?.data?.downloadURL) {
        return { download: res.data.downloadURL, title: res.data.title };
    }
    throw new Error('EliteProTech failed');
}

async function getYupraVideoByUrl(youtubeUrl) {
    const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp4?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.success && res?.data?.data?.download_url) {
        return { download: res.data.data.download_url, title: res.data.data.title };
    }
    throw new Error('Yupra failed');
}

async function getOkatsuVideoByUrl(youtubeUrl) {
    const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.result?.mp4) {
        return { download: res.data.result.mp4, title: res.data.result.title };
    }
    throw new Error('Okatsu failed');
}

async function videoCommand(sock, chatId, message) {
    try {
        // Loading reactions
        const loadEmojis = ['📥', '⏳', '🎥'];
        for (const emoji of loadEmojis) {
            await sock.sendMessage(chatId, { react: { text: emoji, key: message.key } });
        }
        const messageContent = message.message?.ephemeralMessage?.message || message.message?.viewOnceMessage?.message || message.message?.viewOnceMessageV2?.message || message.message;
        const text = (messageContent.conversation || messageContent.extendedTextMessage?.text || messageContent.imageMessage?.caption || messageContent.videoMessage?.caption || '').trim();
        const query = text.replace(/^\.video\s+/i, '').trim();
        
        if (!query || query.toLowerCase() === '.video') {
            await sock.sendMessage(chatId, { text: 'Usage: .video <name or link>' }, { quoted: message });
            return;
        }

        let videoUrl = '';
        let videoTitle = '';
        let videoThumbnail = '';
        
        if (query.includes('youtube.com') || query.includes('youtu.be')) {
            videoUrl = query;
            videoTitle = 'YouTube Video';
        } else {
            const { videos } = await yts(query);
            if (!videos || videos.length === 0) {
                await sock.sendMessage(chatId, { text: 'No videos found!' }, { quoted: message });
                return;
            }
            videoUrl = videos[0].url;
            videoTitle = videos[0].title;
            videoThumbnail = videos[0].thumbnail;
        }

        await sock.sendMessage(chatId, {
            image: { url: videoThumbnail || 'https://i.postimg.cc/y6GV9P3H/file-000000004c307206bc366893b817568c-(1).png' },
            caption: `🎥 Downloading: *${videoTitle}*`
        }, { quoted: message });

        let videoData;
        let downloadSuccess = false;
        const failedSources = [];
        const apiMethods = [
            { name: 'EliteProTech', method: () => getEliteProTechVideoByUrl(videoUrl) },
            { name: 'Yupra', method: () => getYupraVideoByUrl(videoUrl) },
            { name: 'Okatsu', method: () => getOkatsuVideoByUrl(videoUrl) },
            { name: 'yt-dlp', method: async () => ({
                download: await getDirectUrl(videoUrl, 'best[ext=mp4][height<=720]/best[ext=mp4]/best'),
                title: videoTitle
            }) }
        ];
        
        for (const apiMethod of apiMethods) {
            try {
                videoData = await apiMethod.method();
                if (videoData.download) {
                    downloadSuccess = true;
                    break;
                }
            } catch (err) {
                console.log(`${apiMethod.name} failed:`, err.message);
                failedSources.push(apiMethod.name);
            }
        }
        
        if (!downloadSuccess) {
            const sourceSummary = failedSources.length ? ` (${failedSources.join(', ')})` : '';
            throw new Error(`No pude obtener el archivo desde YouTube${sourceSummary}. Intenta con otro enlace o más tarde.`);
        }

        await sock.sendMessage(chatId, {
            video: { url: videoData.download },
            mimetype: 'video/mp4',
            fileName: `${(videoData.title || videoTitle || 'youtube-video').replace(/[^\w\s-]/g, '').trim() || 'youtube-video'}.mp4`,
            caption: `*${videoData.title || videoTitle || 'YouTube Video'}*\n\n> *Downloaded by NIKU MD BOT*`
        }, { quoted: message });

    } catch (error) {
        console.error('Video error:', error);
        await sock.sendMessage(chatId, {
            text: `❌ ${error.message}\n\n🔗 Enlace original:\n${message.message?.conversation?.match(/https?:\/\/\S+/i)?.[0] || 'Revisa el enlace de YouTube.'}`
        }, { quoted: message });
    }
}

module.exports = videoCommand;
