# Doodle Icons integration

Purpose: replace ad hoc text glyphs with consistent artwork across search, library, playlists, download controls, mini player, video actions, and comment reactions.

Acceptance:

- Use the published `@doodle-icons/react-native` package (0.2.0) and Expo SDK 57 compatible `react-native-svg` (15.15.4).
- Centralize verified exports in a typed `AppIcon` wrapper, defaulting to theme foreground and 24 pixels, supporting explicit size and semantic theme colors.
- Keep artwork decorative to accessibility services; containing controls provide localized labels. Download controls have 44-point minimum targets.
- Preserve existing native tab icons and native video controls.
- Translate new icon-only control labels in English and Simplified Chinese.

Verification completed:

- `bun run typecheck`
- `bun run lint`
- `bun test`: 11 passing tests.
- `bunx expo export --platform ios --output-dir /private/tmp/liberbili-doodle-ios` from `packages/app`: success, 2232 modules.
- `git diff --check`

Device QA remains: inspect light/dark mode rendering, narrow download rows, mini-player controls, and VoiceOver/TalkBack labels on iOS and Android. No simulator/device screenshot was captured in this environment. No authenticated or premium account is required for the icon integration itself; network data screens still require normal service availability.

Attribution: [Doodle Icons](https://github.com/theJian/doodle-icons), based on artwork by Khushmeen Sidhu. Icons are CC0 1.0; package code is MIT licensed. Dependencies retain their upstream licensing metadata.
