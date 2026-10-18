# Download lifecycle reliability

Purpose: make downloading, pausing, retrying, removing, and playing local videos reliable under overlapping user actions and asynchronous network callbacks.

Acceptance:

- One owned operation per video ID; repeated start/resume actions share lookup or transfer work.
- Each fresh operation writes a distinct destination, so removed work cannot corrupt a new transfer for the same video.
- Removal invalidates lookup, cancels active tasks, deletes video/artwork/partial files including legacy paths, and cleans again after late completion.
- Pause during lookup prevents task creation. Active pause/resume retains one task; saved state restores with fresh-source fallback when restoration fails.
- Terminal tasks release native handles; stale callbacks cannot update new operations.
- Progress renders at most four times per second and persists at most once per second; terminal status and app lifecycle changes flush immediately.
- Corrupt persistence cannot prevent startup. Active entries become interrupted. Missing completed files become retryable at startup and before playback.
- Downloads show queued/retry and localized pause/download/missing-file errors. Playback errors are caught. Controls have localized labels and 44-point targets.

Verification: typecheck, lint, 25 passing tests including 14 fake-task regressions, zero missing Chinese translations, production iOS export (1667 modules), and diff check.

Device QA remains: native pause data, background/suspend/terminate/relaunch behavior, disk failures, rapid removal/restart, and accessible layout. No screenshot/recording was available. Expo does not restore the original JavaScript task after process termination; those entries become interrupted and require retry. Public downloads need normal service availability; authenticated/premium media needs separate testing.

Merge note: the independent Doodle Icons PR updates download control markup. Preserve its SVG artwork while retaining these lifecycle handlers, status/error rendering, and labels.
