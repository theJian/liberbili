# Playlist persistence recovery

PlaylistProvider normalizes persisted data before mounting. Invalid JSON or a wrong root shape becomes an empty list; valid playlists within mixed data remain available. Stable playlist IDs, order, supported video metadata and legacy data shape are preserved. Duplicate playlist IDs retain the first valid list; duplicate video IDs within each list retain the first valid item. Missing/invalid item collections recover as empty lists and invalid creation timestamps recover as zero.

Required IDs, names, video fields and numeric values are validated. Strings have explicit upper bounds (playlist names: 200 characters; oversized legacy names are trimmed to this limit while retaining their IDs and videos); unknown/invalid optional video fields are discarded. No collection count caps silently discard otherwise valid lists or videos. The existing name input uses the same length bound. Public create/rename actions reject blank or excessive names before scheduling state changes; valid names are trimmed. No new playlist flows are introduced.

Verification: `bun run test`, `bun run typecheck`, `bun run lint`, `git diff --check`. Pure regression tests cover malformed storage, mixed valid/invalid lists/items, stable IDs/order, duplicates, metadata recovery, bounded fields and invalid create/rename actions. Device acceptance remains untested: inject malformed local playlist storage in a development build and confirm launch recovery, then create/open/play a valid playlist and relaunch.

Integration note: the parallel creator-discovery PR adds optional uploaderId to VideoSummary. Retain that field in the normalizer when combining the model changes; this independent baseline branch only declares the current model fields.
