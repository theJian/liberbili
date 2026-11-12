# Search history and filters

Baseline: search has no recent queries or filters. Its pagination reads the editable input rather than a submitted search, and in-flight requests block new searches. Pagination errors have no retry while results exist.

## Acceptance

- Persist at most 20 trimmed, distinct recent queries on this device. Reuse, remove individually, and clear all queries. Invalid persisted data resets safely.
- Offer relevance, most viewed, newest, and most saved ordering plus all five supported duration ranges using the existing extractor search API.
- Changing filters starts a new search for the submitted query. Typing a draft does not change pagination.
- New submissions replace older requests. Stale success and failure cannot alter current results. Concurrent pagination is deduplicated; repeated/non-increasing cursors stop pagination and duplicate videos merge by BV ID.
- Failed pages preserve existing results and expose explicit retry for the same page.
- All new text has English and Simplified Chinese translations and buttons expose accessible roles and selection state.

## Verification

`bun run test` passes 17 tests, including six offline search history and request lifecycle regressions. `bun run typecheck` and `bun run lint` pass. `bun run i18n:extract` updates both catalogs; every new Chinese entry is filled.

Device follow-up: check keyboard submission, horizontal filter/history scrolling, history after restart, VoiceOver/TalkBack, and real Bilibili search pagination on iOS/Android. No authenticated account is required. No simulator/device screenshot was available in this worktree run.

## Integration

Independent branch from ca3dd2f. Search UI and both Lingui catalogs may overlap other feature PRs; regenerate catalogs after integration and retain all translations.
