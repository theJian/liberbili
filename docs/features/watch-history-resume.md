# Watch history and resume

Local history retains the 200 most recently watched video parts, keyed by bvid and cid. Progress is persisted every five seconds during playback, on pause, on app backgrounding, and before source replacement. A corrupt record is discarded safely. Completed videos restart; positions before five seconds or within the final 5% (capped at ten seconds) restart. Explicit part selection resumes only that part. Default playback selects the latest watched part when still available.

Library links to the history screen and shows a continue-watching shortcut. History supports opening individual parts, removal, confirmed clearing, and a persisted pause-recording switch. Recording resumes for active playback after removal/clear unless paused. History remains on this device; there is no server sync. Local downloads omit cid metadata, so they play without applying or recording potentially incorrect per-part progress.

Automated verification: `bun run test`, `bun run typecheck`, `bun run lint`. Pure regression tests cover malformed storage, invalid records, bounded deduplication, paused recording, completion, duration changes, and selected/deleted parts.

Device acceptance (requires a development build because the existing app uses MMKV): play beyond five seconds, pause and relaunch; open the video from history and verify its part and position. Switch parts and confirm independent progress. Finish and reopen a video; verify restart. Pause history and verify no changes while playback continues. Delete and clear entries, cancel the confirmation, verify both languages, and play downloaded media without a network request. Native playback/background lifecycle has not been exercised in the CLI environment.

This independent PR touches player state, the provider layout, Library, and both Lingui catalogs; parallel playback and icon PRs may require a small merge reconciliation in these files.
