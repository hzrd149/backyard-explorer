# Repository Guidelines

## Project Structure & Module Organization

Backyard Explorer is a SolidJS and TypeScript application for searching Nostr events and profiles, built with Vite, Tailwind CSS, and DaisyUI.

- `src/index.tsx` bootstraps the application; `src/App.tsx` coordinates searches and results.
- `src/componnts/` contains UI components (retain this existing directory spelling). Its `events/` and `previews/` subdirectories render event cards and media.
- `src/services/` contains query parsing, search, profile lookup, configuration, URL state, and media logic.
- `src/context/` holds shared Solid context; `src/index.css` defines application styles.
- `public/` contains static assets. `dist/` is generated build output.
- `.github/workflows/` contains GitHub Pages and nsite deployment workflows.

## Build, Test, and Development Commands

Use pnpm 9.15.6, as pinned in `package.json`; CI uses Node.js 22.

- `pnpm install` installs dependencies; preserve `pnpm-lock.yaml` when updating packages.
- `pnpm dev` starts the Vite development server, normally at `http://localhost:5173`.
- `pnpm build` runs TypeScript project checks and creates the production bundle in `dist/`.
- `pnpm preview` serves the production bundle locally after a build.
- `pnpm format` runs Prettier across the repository; review the diff for unrelated formatting changes.

## Coding Style & Naming Conventions

Use TypeScript with strict checking and SolidJS reactive primitives. Follow the existing two-space indentation, double quotes, and semicolons; `.prettierrc` specifies spaces and a tab width of two. Use PascalCase for component files and service modules, camelCase for functions and variables, and `import type` for type-only imports. Keep data-access logic in services and rendering in components. No standalone lint script is configured.

## Testing Guidelines

No automated test runner, test script, or coverage threshold is configured. `src/componnts/previews/FilePreviewTest.tsx` provides sample preview fixtures, rather than an automated test suite. Run `pnpm build` and manually verify affected search syntax, profile lookups, URL state, and media behavior using `pnpm dev`. For UI changes, check responsive layouts and loading/error states. Record verification steps in the pull request.

## Commit & Pull Request Guidelines

Recent commits use short, imperative descriptions such as “Pause feed media when scrolled off screen”; follow that style and keep commits focused. Agents should commit their work once a change is complete and `pnpm build` passes, rather than leaving it uncommitted; commit only their own paths (`git commit --only -- <paths>`) since the user may have unrelated work staged, and do not push unless asked. Pull requests should explain the behavior changed, link relevant issues, list validation performed, and include screenshots for visible UI changes. Pushes to `master` trigger both deployment workflows, so review deployment-related changes carefully. Keep credentials out of source; nsite deployment uses the `NSITE_BUNKER` repository secret.
