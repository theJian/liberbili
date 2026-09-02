# Repository Guidelines

## Project Structure & Module Organization

LiberBili is a Bun-workspace monorepo containing an Expo 57 React Native application and a reusable TypeScript API package.

- `packages/app/src/app/`: Expo Router screens and route layouts.
- `packages/app/src/components/`: reusable UI components.
- `packages/app/src/state/`: player, playlist, and download state providers.
- `packages/app/src/i18n.ts` and `packages/app/src/locales/`: Lingui configuration and English/Chinese message catalogs.
- `packages/app/assets/`: bundled images and application artwork.
- `packages/api/src/`: Bilibili API clients, session/signing logic, models, and tests.

Keep tests next to the implementation using the `*.test.ts` suffix.

## Build, Test, and Development Commands

Use Bun for project commands:

- `bun install`: install dependencies.
- `bun start`: start the Expo development server.
- `bun run ios` / `bun run android`: launch the corresponding Expo target.
- `bun run test`: run the Bun unit-test suite.
- `bun run typecheck`: run TypeScript without emitting files.
- `bun run lint`: run the Expo ESLint configuration.
- `bun run i18n:extract`: extract messages into the Lingui catalogs.
- `bun run i18n:extract:clean`: extract messages and remove obsolete catalog entries.
- `cd packages/app && bunx expo-doctor`: validate Expo dependencies and configuration.
- `cd packages/app && bunx expo export --platform ios`: create a production iOS bundle.

## Coding Style & Naming Conventions

Use strict TypeScript, two-space indentation, single quotes, and semicolons. Prefer compact, declarative code and explicit typed return values at public API boundaries.

- Components and exported types: `PascalCase`
- Functions, variables, and methods: `camelCase`
- Route and utility filenames: lowercase or kebab-case
- React hooks: `use` prefix

Run typechecking and ESLint before committing. Keep public API models idiomatic to TypeScript and avoid unnecessary framework abstractions.

## Testing Guidelines

Tests use Bun’s `describe`, `test`, and `expect` APIs. Add regression tests for API URL construction, response normalization, signing, pagination, and bug fixes. Tests must not depend on authenticated accounts or unstable live data unless explicitly marked as integration tests.

## Localization

Use Lingui for user-facing text. Keep source messages in code and update the English and Simplified Chinese catalogs in `packages/app/src/locales/` with `bun run i18n:extract`. Review catalog changes before committing and do not edit generated message identifiers manually.

## Commit & Pull Request Guidelines

Use Conventional Commits: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, and `chore:`. Keep commits atomic.

Pull requests should include a concise summary, verification commands, linked issues when applicable, and screenshots or recordings for UI changes. Call out authenticated, premium, live-stream, or physical-device testing requirements.

## Security & API Maintenance

Never commit account cookies, tokens, downloaded media, or generated Expo output. Treat API credentials and authenticated test data as local-only secrets.
