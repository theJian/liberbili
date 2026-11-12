# Search history and filters

The search screen saves recent queries on this device and supports ordering and duration filters. `SearchSession` keeps results and pagination tied to the submitted query and filters while users edit the input.

## Behavior

- History stores at most 20 trimmed, distinct queries. Users can reuse queries, remove them individually, or clear the history. Invalid persisted data resets safely.
- Ordering options include relevance, most viewed, newest, and most saved. Duration filters cover all five supported ranges through the extractor search API.
- Changing filters starts a new search for the submitted query. Typing a draft does not change pagination.
- New submissions supersede older requests. Stale success and failure cannot alter current results. Concurrent pagination is deduplicated; cursors that do not convert to increasing integer page numbers stop pagination, and duplicate videos merge by BV ID.
- Failed pages preserve existing results and expose explicit retry for the same page.
- Search text has English and Simplified Chinese translations. Buttons expose accessible roles, and filter buttons expose selection state.

## Verification

Run `bun run test`, `bun run typecheck`, and `bun run lint`. When source messages change, run `bun run i18n:extract` and review both catalogs for missing translations.

On iOS and Android, check keyboard submission, horizontal filter/history scrolling, history after restart, VoiceOver/TalkBack, and real Bilibili search pagination. No authenticated account is required.
