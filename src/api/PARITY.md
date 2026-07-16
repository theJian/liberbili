# PipePipeExtractor Bilibili parity

The TypeScript API mirrors the Bilibili-specific surface of PipePipeExtractor. UI adoption is intentionally separate from extraction parity.

| PipePipeExtractor area | TypeScript equivalent |
| --- | --- |
| `BilibiliService`, `DeviceForger`, `utils` | `session.ts`, `crypto.ts`, shared request/WBI/app signing, anonymous and imported-account cookies |
| Stream/channel/playlist/comment/bullet-comment link handlers | `resolveStreamUrl`, BV/AV conversion, typed identifiers and direct method arguments |
| Recommended videos, recommended lives, Top 100 | `getRecommendations`, `getRecommendedLives`, `getTop100` |
| Search filters and suggestions | `search` with content/order/duration filters, `getSuggestions` |
| Normal and premium metadata | `getVideoComplete`, `getPremiumSeason` |
| Progressive, DASH, audio, Dolby and FLAC streams | `getPlayback` |
| Tags, related items, partitions, subtitles and video-shot data | `getTags`, `getRelated`, video `parts`, `getSubtitles`, `getVideoShot` |
| Comments, pinned comments, pictures and reply pagination | `getComments`, `getCommentReplies` |
| Creator profile/live status | `getChannel` |
| Creator videos: web, keyword-search and signed client fallbacks | `getChannelVideos`, `getChannelVideosWithFallback` |
| Creator seasons and series | `getChannelPlaylists`, `getRemotePlaylist` |
| Recorded XML danmaku | `getRecordedDanmaku` |
| Live room/status/play URL and round-play video | `getLiveRoom`, `getLiveStream`, `getRoundPlay` |
| Live danmaku token and WebSocket protocol | `getLiveDanmakuCredentials`, `BilibiliLiveDanmakuClient` |
| `WatchDataCache` | Explicit `VideoPart`, room, CID and BVID values; no hidden cross-extractor cache is required |

PipePipe's generic NewPipe collector/filter framework is represented by normalized return types and caller-side filtering rather than copied Java framework classes.

