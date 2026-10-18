# Resource and comment reliability

## Confirmed baseline defects

- `useResource` retains a previous dependency key's data and does not mark dependency changes as loading. Video route reuse can render a previous video and trigger its playback effect before a new detail request resolves.
- Video comments combine a resource's first page with component-local extra pages and cursor state that are never reset when the BV ID changes. Late pages can append another video's comments.
- Comment pagination catches no request errors. Only its spinner resets, leaving an unhandled rejection and no retry control.
- React state alone guards concurrent `onEndReached` calls, so repeated calls before render can request the same page. Repeated server cursors are not detected; pinned entries and overlapping pages are duplicated.

## Acceptance

- A resource dependency key change yields an empty loading snapshot during render. Dependencies use React's Object.is semantics. Prior requests are aborted, and loaders that ignore abort still cannot publish stale data or errors.
- Reload preserves same-key cached data, reports failures, and remains retryable. The home screen exposes refresh failures alongside cached recommendations. Existing call sites were checked: home recommendations and video details; initial comments move to their own scoped model.
- Video details must match the route BV ID before they produce a playback summary. This fixes stale request playback without changing queue/automatic playback policy.
- Each BV ID and archive ID pair owns a new comment thread. It starts at the initial page with no prior comments/cursor. Late results update only their originating instance.
- Both initial and subsequent comment failures expose retry; retry uses the failed cursor and preserves existing comments. Automatic pagination pauses on error.
- Concurrent page loads are deduplicated synchronously. Completed cursors stop repeats/cycles. Duplicate comment IDs merge in stable order and retain pinned status.
- Reuse existing localized loading, empty, error, and retry UI; no new interface messages are introduced.

## Verification

`bun run test` passes 23 tests, including 12 offline regressions covering new dependency snapshots, cancellation, ignored abort signals, synchronous errors, reload failures, dependency comparison, comment scoping, pin merging, repeated cursors, concurrent loads, and retry. `bun run typecheck`, `bun run lint`, and `git diff --check` pass.

Device follow-up: rapidly open different videos under delayed networking, verify playback belongs to the visible route, scroll comments with repeated end events, retry initial and later pages offline, and refresh home recommendations offline. No physical-device or simulator screenshot was captured. Hook rendering and native playback require device integration QA; tests exercise the request/thread lifecycle models with deferred promises and fixtures.

## Integration

Independent branch from ca3dd2f. `src/app/video/[bvid].tsx` overlaps creator discovery, share-link, and playback-control PRs. Preserve the matching-BV guard, CommentThread data/footer, uploader navigation, related preview, share handling, and focused route/queue playback policy while resolving conflicts. Creator discovery already includes the same matching-BV guard. Playback/queue behavior is owned by its separate PR; this branch leaves the baseline playback effect otherwise unchanged.

Home layout may also overlap icon/feature entrypoint work. Resource semantics remain compatible with keyed creator/related child components. After integration run catalog extraction and full test/typecheck/lint checks, then device QA.
