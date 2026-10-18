# Video sharing and link opening

Users can share a clean canonical Bilibili URL from video details and open pasted links or video IDs from Library → Open video link.

Acceptance:

- Share the canonical `https://www.bilibili.com/video/BV…` link using the native share sheet, with a localized error on failure.
- Open exact BV IDs, positive bounded av IDs, regular desktop/mobile video links, and b23.tv short links.
- Reuse `resolveStreamUrl`, validate hosts/protocol/credentials, bound short-link redirects and timeout, and reject unsupported resource kinds in the video UI.
- Preserve linked part and timestamp, including same-video part changes and retry; stale route/selection completion cannot seek a newer video.
- Keep input after errors and provide a visible retry action. English and Simplified Chinese labels are included.
- Existing `liberbili` app scheme routes `liberbili://video/BV17x411w7KC?p=2&t=42` through Expo Router. Scheme registration already exists in app.json; no domain association or universal/app-link support is claimed. No system share-receive extension is added.

Verification:

- `bun run typecheck` and `bun run lint` pass.
- `bun test`: 20 tests pass, including malformed/unrelated URLs, trusted short-link redirects/failures/loops, unsupported reference kinds, and fake playback ownership/retry behavior.
- Production iOS export succeeds (1670 modules).
- `git diff --check` passes.

Device QA remains: native share sheet/cancel, pasting on device, short-link redirect behavior on iOS/Android, cold/warm custom-scheme opens, linked part/time playback and screen reader labels. No screenshot or recording was captured in this environment. Ordinary public links need no authenticated account; premium/live inputs are explicitly rejected by this screen.

Merge note: other independent video-detail/player PRs may overlap the playback effect. Preserve stable route ownership, linked part/time retry, and stale-seek protection when reconciling those changes. Queue navigation should clear old p/t parameters when moving to a different video.
