# Search history and filters

Search keeps recent queries on this device and offers ordering and duration filters. Results and pagination stay tied to the submitted query and filters while users edit the search input.

## Acceptance

- Persist at most 20 trimmed, distinct recent queries on this device. Reuse, remove individually, and clear all queries. Invalid persisted data resets safely.
- Offer relevance, most viewed, newest, and most saved ordering plus all five supported duration ranges using the existing extractor search API.
- Changing filters starts a new search for the submitted query. Typing a draft does not change pagination.
- New submissions replace older requests. Stale success and failure cannot alter current results. Concurrent pagination is deduplicated; repeated/non-increasing cursors stop pagination and duplicate videos merge by BV ID.
- Failed pages preserve existing results and expose explicit retry for the same page.
- All new text has English and Simplified Chinese translations and buttons expose accessible roles and selection state.

## Verification

Run `bun run test`, `bun run typecheck`, and `bun run lint` for automated checks.

On iOS and Android, check keyboard submission, horizontal filter/history scrolling, history after restart, VoiceOver/TalkBack, and real Bilibili search pagination. No authenticated account is required.
