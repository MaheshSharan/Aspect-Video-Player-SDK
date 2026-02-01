export interface Stream {
    name: string;
    url: string;
    type?: 'hls' | 'dash' | 'mp4';
    subtitles?: {
        id: string;
        label: string;
        language: string;
        url: string;
    }[];
}

export const streams: Stream[] = [
    {
        name: 'Big Buck Bunny (HLS)',
        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        type: 'hls'
    },
    {
        name: 'Sintel (HLS)',
        url: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
        type: 'hls',
        subtitles: [
            {
                id: 'en',
                label: 'English',
                language: 'en',
                url: 'https://bitdash-a.akamaihd.net/content/sintel/subtitles/subtitles_en.vtt'
            },
            {
                id: 'es',
                label: 'Spanish',
                language: 'es',
                url: 'https://bitdash-a.akamaihd.net/content/sintel/subtitles/subtitles_es.vtt'
            }
        ]
    },
    {
        name: 'Big Buck Bunny (DASH)',
        url: 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd',
        type: 'dash'
    },
    {
        name: 'Elephants Dream (MP4)',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        type: 'mp4'
    },
    {
        name: 'Tears of Steel (MP4)',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
        type: 'mp4'
    },
    {
        name: 'Planète Interdite (HLS)',
        url: 'http://sample.vodobox.com/planete_interdite/planete_interdite_alternate.m3u8',
        type: 'hls'
    }
];

