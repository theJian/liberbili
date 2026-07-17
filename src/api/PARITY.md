# PipePipeExtractor Bilibili parity

The TypeScript API mirrors the Bilibili-specific behavior of PipePipeExtractor. UI adoption is intentionally separate from extraction parity.

| PipePipeExtractor area | TypeScript equivalent |
| --- | --- |
| `BilibiliService`, `DeviceForger`, `utils` | `session.ts`, `crypto.ts`, shared request/WBI/app signing, anonymous and imported-account cookies |
| Stream/channel/playlist/comment/bullet-comment link handlers | `resolveStreamUrl`, BV/AV conversion, typed identifiers and direct method arguments |
| Recommended videos, recommended lives, Top 100 | `getRecommendations`, `getRecommendedLives`, `getTop100` |
| Search filters and suggestions | `search` with content/order/duration filters, `getSuggestions` |
| Normal and premium metadata, staff, stats and payment state | `getVideoComplete`, `getPremiumSeason` |
| Progressive, DASH, audio, Dolby and FLAC streams | `getPlayback` |
| Tags, related items, partitions, subtitles and video-shot data | `getTags`, `getRelated`, `getVideoParts`, `getSubtitles`, `getVideoShot` |
| Comments, pins, uploader hearts, jump links, pictures and reply pagination | `getComments`, `getCommentReplies` |
| Creator profile/live status | `getChannel` |
| Creator videos: web, keyword-search and signed client fallbacks | `getChannelVideos`, `getChannelVideosWithFallback` |
| Creator seasons and series | `getChannelPlaylists`, `getRemotePlaylist` |
| Recorded XML danmaku | `getRecordedDanmaku` |
| Live room/status/play URL and round-play video | `getLiveRoom`, `getLiveStream`, `getRoundPlay` |
| Live danmaku token and WebSocket protocol | `getLiveDanmakuCredentials`, `BilibiliLiveDanmakuClient` |
| URL/media recognition and quality labels | `resolveStreamUrl`, `isBilibiliUrl`, `isBilibiliMediaUrl`, `videoQualityLabel`, `audioQualityLabel` |

## Deliberately not ported

The following are Java/NewPipe integration mechanics rather than Bilibili API functionality:

- `StreamingService`, extractor base classes, collectors, `Page`, and `InfoItemExtractor`
- link-handler factory classes; URL parsing is represented by `resolveStreamUrl`
- `WatchDataCache`; CID, BVID, room ID, and pagination tokens are explicit typed arguments/results
- NewPipe global filtering and cookie-feature flags; callers select typed filters and opt into authenticated requests
- downloader wrappers, Java exception classes, and device POJOs

No TypeScript class exists solely to imitate one of those framework abstractions.

## Endpoint inventory

Every Bilibili endpoint called by the Java implementation has a TypeScript owner:

| Endpoint family | TypeScript owner |
| --- | --- |
| `/x/frontend/finger/spi`, ticket generation, `/x/web-interface/nav` | `SessionManager` |
| recommendation, ranking, live recommendation | `getRecommendations`, `getTop100`, `getRecommendedLives` |
| typed search and suggestions | `search`, `getSuggestions` |
| view, tag, related, page list, video shot | `getVideo`, `getTags`, `getRelated`, `getVideoParts`, `getVideoShot` |
| WBI/free, PGC/paid, and round-play playback | `getPlayback`, `getRoundPlay` |
| PGC season/episode metadata | `getPremiumSeason` |
| subtitle metadata and BCC payload | `getSubtitles`, `getSubtitleSrt` |
| creator card/live state and all three creator-video fallbacks | `getChannel`, `getChannelVideos`, `getChannelVideosWithFallback` |
| creator season/series lists and archives | `getChannelPlaylists`, `getRemotePlaylist` |
| WBI comments and reply threads | `getComments`, `getCommentReplies` |
| recorded danmaku XML | `getRecordedDanmaku` |
| live room init/state/play URL/round play/danmaku credentials | `getLiveRoom`, `getLiveStream`, `getRoundPlay`, `getLiveDanmakuCredentials` |
