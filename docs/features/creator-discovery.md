# Creator pages and related videos

Baseline: the API exposes creator profiles, uploads, and related videos, but the app has no creator route or related-video section. Summary normalization omits creator IDs. The client archive fallback returns an archive cursor that the wrapper incorrectly treats as a page number on subsequent loads.

## Acceptance

- Tap an uploader on video details to open a creator page showing avatar, banner, name, follower count, biography, and uploads.
- Uploads paginate using existing web/search/client fallbacks. Preserve the client archive cursor and API mode. Deduplicate overlapping BV IDs and repeated cursors; retry failed pages without losing results.
- Show three related videos initially with explicit expand/collapse on video details, using existing VideoCard navigation. Related request loading, failure/retry, and empty states remain independent of playback and comments.
- Key creator and related components by their route identity so late results cannot appear under another creator/video. Ignore video details whose BV ID does not match the route.
- Invalid non-positive or unsafe creator IDs fail locally. Missing uploader IDs disable creator navigation. No authenticated follow mutation is introduced.
- Localize new interface text in English and Simplified Chinese.

## Verification

`bun run test` passes 18 offline tests, including creator ID normalization, established profile/related endpoints, client cursor continuity, concurrent uploads, retry preservation, repeated cursors, and independent creator instances. `bun run typecheck`, `bun run lint`, and `bun run i18n:extract` pass with zero missing Chinese messages.

Device follow-up: validate tapping uploader and related cards, stack back navigation, long biography/banner layout, rapid creator/video transitions, upload scroll pagination, and retry while offline on iOS/Android. No simulator/device screenshot or live authenticated validation was performed. Public Bilibili requests can still be blocked by service anti-bot rules.

## Integration

Independent branch from ca3dd2f. The video detail route and Lingui catalogs overlap resource/comment and playback feature PRs. Preserve uploader navigation and RelatedVideos while reconciling playback effects, route scoping, and comments. Re-extract catalogs after integration, retaining translations.
