# Repository Guidelines

## Project Structure & Module Organization

LiberBili is an Expo 57 React Native application written in TypeScript.

- `src/app/`: Expo Router screens and route layouts.
- `src/api/`: Bilibili API clients, session/signing logic, models, and tests.
- `src/components/`: reusable UI components.
- `src/state/`: player, playlist, and download state providers.
- `src/i18n/`: English and Chinese localization.
- `src/constants/`: shared theme values.
- `assets/`: bundled images and application artwork.

Keep tests next to the implementation using the `*.test.ts` suffix.

## Build, Test, and Development Commands

Use Bun for project commands:

- `bun install`: install dependencies.
- `bun start`: start the Expo development server.
- `bun run ios` / `bun run android`: launch the corresponding Expo target.
- `bun run test`: run the Bun unit-test suite.
- `bun run typecheck`: run TypeScript without emitting files.
- `bun run lint`: run the Expo ESLint configuration.
- `bunx expo-doctor`: validate Expo dependencies and configuration.
- `bunx expo export --platform ios`: create a production iOS bundle.

## Coding Style & Naming Conventions

Use strict TypeScript, two-space indentation, single quotes, and semicolons. Prefer compact, declarative code and explicit typed return values at public API boundaries.

- Components and exported types: `PascalCase`
- Functions, variables, and methods: `camelCase`
- Route and utility filenames: lowercase or kebab-case
- React hooks: `use` prefix

Run typechecking and ESLint before committing. Keep public API models idiomatic to TypeScript and avoid unnecessary framework abstractions.

## Testing Guidelines

Tests use Bun’s `describe`, `test`, and `expect` APIs. Add regression tests for API URL construction, response normalization, signing, pagination, and bug fixes. Tests must not depend on authenticated accounts or unstable live data unless explicitly marked as integration tests.

## Commit & Pull Request Guidelines

Use Conventional Commits: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, and `chore:`. Keep commits atomic.

Pull requests should include a concise summary, verification commands, linked issues when applicable, and screenshots or recordings for UI changes. Call out authenticated, premium, live-stream, or physical-device testing requirements.

## Security & API Maintenance

Never commit account cookies, tokens, downloaded media, or generated Expo output. Treat API credentials and authenticated test data as local-only secrets.
