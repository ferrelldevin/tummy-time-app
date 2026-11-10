# Credits

## People
- Devin Ferrell: project lead.
- Muhammad: developer.
- Dr. Ajay Gupta: lab director, Hands-On Lab, Old Dominion University.
- The client and the client's clinician: content owner and medical reviewer.

## AI assistance
Planning, documents and code in this repo are produced with AI assistance (Anthropic's Claude models) and reviewed by the people above. Each pull request says what was AI-drafted.

## Standards and sources
- OWASP Application Security Verification Standard, OWASP Top 10, OWASP Cheat Sheet Series.
- NIST SP 800-63B, Digital Identity Guidelines.
- W3C Web Content Accessibility Guidelines (WCAG) 2.2.
- Michael Nygard's Architecture Decision Record format (docs/adr).
- STRIDE threat modeling (Microsoft), used in docs/threat-model.md.
- PostgreSQL documentation (roles and privileges, pg_dump, pg_restore), used for infra/db/ and the backup scripts. PostgreSQL License.
- Flesch-Kincaid grade level formula (Kincaid and others, 1975), implemented by us in apps/web/src/strings/readability.ts as an approximation.
- AHRQ PEMAT and the CDC Clear Communication Index (content checks).

## Libraries and assets
Every library, image, font or dataset is listed here by name, with its license.

Runtime libraries
- React and React DOM (build the screens). MIT.
- Fastify (the API server). MIT.
- Zod (checks data shapes, shared by web and API). MIT.
- marked 18.2.0 (reads Markdown from lesson files into a list of parts; we turn the parts into React elements ourselves and never pass raw HTML). MIT.
- yaml 2.9.1 (reads the settings at the top of lesson files). ISC.
- react-router 8.5.1 (screen routing in the web app), with its two dependencies cookie-es and @remix-run/route-pattern. MIT.
- Drizzle ORM (drizzle-orm) 0.45.4 (database queries, always parameterized, and the migration runner). Apache-2.0.
- node-postgres (pg) 8.23.1 (connects the API to PostgreSQL). MIT.
- @fastify/helmet 13.2.0, with Helmet (security headers on every API response). MIT.
- @fastify/rate-limit 11.2.1 (general request limit, counted in memory), with its dependencies toad-cache, ip-address and @lukeed/ms. MIT.
- argon2 (node-argon2) 0.45.1 by Ranieri Althoff (hashes and checks PINs with Argon2id; we write no hashing code ourselves). MIT. It binds the Argon2 reference C implementation by Daniel Dinu, Dmitry Khovratovich, Jean-Philippe Aumasson and Samuel Neves, which it ships inside the package: CC0 1.0 or Apache-2.0, at our option. Its dependencies: @phc/format 1.0.0, node-gyp-build 4.8.4, node-addon-api 8.9.2, cross-env 10.1.0 (with @epic-web/invariant and cross-spawn). All MIT. The package ships prebuilt binaries for Linux, macOS and Windows; pnpm does not run its install script, and none is needed.
- @fastify/cookie 11.1.3 (reads and writes the session cookie), with its dependencies cookie 2.0.2 and fastify-plugin 6.0.1. MIT.
- Node.js's built-in `node:crypto` (random bytes, HMAC-SHA-256, SHA-256, constant-time compare). MIT.
- idb 8.0.4 by Jake Archibald (a small promise wrapper around the browser's IndexedDB, for the phone's copy of the log, its outbox and the last rev seen). ISC. No dependencies.
- Workbox 7.4.1 by Google: workbox-core, workbox-precaching and workbox-routing are built into the service worker (`sw.js` and `workbox-*.js` in the build) by vite-plugin-pwa. They keep the app's own files on the phone and answer from them offline. MIT. No other library runs in the browser for offline or install; the page registers the worker with its own code (`apps/web/src/update/`).

Build and test tools
- Vite and @vitejs/plugin-react (dev server and bundler). MIT.
- vite-plugin-pwa 2.0.0 by Anthony Fu and others (writes the service worker at build time). MIT. It brings workbox-build 7.4.1 (Google, MIT), which builds the worker with Rollup and Babel, and workbox-window 7.4.1 (MIT), which this app does not load. Its dependencies debug, tinyglobby and pretty-bytes are MIT. `pnpm.overrides` in the root `package.json` moves workbox-build's glob to 14.0.2 and that glob's minimatch to 11.0.1, the fixed lines for two moderate advisories (GHSA-3g3m-2fjr-6pw4, GHSA-g3hv-75wg-m249). Remove both overrides once workbox-build moves on. One low advisory stays open: deepmerge 4.3.1 (GHSA-gcqx-w48m-w2h4, no fixed version exists), used by Rollup's node-resolve plugin inside workbox-build, at build time only, on our own config.
- TypeScript (types). Apache-2.0.
- tsx (runs the API in development). MIT.
- drizzle-kit 0.31.11 (writes SQL migration files from the schema; never connects to a database). MIT. Its old helper pulls in esbuild 0.18, which has a moderate advisory for development servers (GHSA-67mh-4wv8-2f99); `pnpm.overrides` in the root `package.json` moves that one copy to esbuild 0.25.12, the fixed line. Remove the override once drizzle-kit drops the helper.
- @types/pg (type definitions). MIT.
- Vitest (unit and API tests). MIT.
- jsdom (browser stand-in for unit tests). MIT.
- fake-indexeddb 6.2.6 by Jeremy Scheff (an in-memory IndexedDB for the web app's unit tests, which run in jsdom). Apache-2.0. No dependencies.
- @testing-library/react and @testing-library/dom (test React screens like a user). MIT.
- Playwright Test (@playwright/test) (end-to-end tests). Apache-2.0.
- @axe-core/playwright and axe-core (automatic accessibility scan, in browser tests and in component unit tests). MPL-2.0.
- @types/react, @types/react-dom, @types/node (type definitions). MIT.

Code quality tools
- ESLint and @eslint/js (lint). MIT.
- typescript-eslint (TypeScript lint rules). MIT.
- eslint-plugin-jsx-a11y (accessibility lint rules). MIT.
- eslint-plugin-security (security lint rules). Apache-2.0.
- globals (names of built-in globals for lint). MIT.
- Prettier (code formatting). MIT.
- simple-git-hooks and lint-staged (pre-commit checks). MIT.

Tools run in CI (downloaded, not added to the code)
- gitleaks (secret scan). MIT.
- OSV-Scanner (known-vulnerability scan). Apache-2.0.
- GitHub Actions: actions/checkout, actions/setup-node, actions/upload-artifact (MIT), pnpm/action-setup (MIT), github/codeql-action (MIT).

Container images
- postgres, nginx, node (official Docker images; CI also runs postgres as a throwaway service container). Licenses of the software inside: PostgreSQL License, BSD-2-Clause, MIT.

Images
- App icons (`apps/web/public/icons/`): a PLACEHOLDER, drawn for this repo as a plain SVG in the design token colors, and rendered to PNG by `scripts/render-icons.mjs` with Playwright's Chromium. No third-party art, no fonts. Not the client's logo; replace it when the client supplies one.

Licenses are as published by each project; confirm before any release.
