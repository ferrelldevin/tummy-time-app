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

Build and test tools
- Vite and @vitejs/plugin-react (dev server and bundler). MIT.
- TypeScript (types). Apache-2.0.
- tsx (runs the API in development). MIT.
- drizzle-kit 0.31.11 (writes SQL migration files from the schema; never connects to a database). MIT. Its old helper pulls in esbuild 0.18, which has a moderate advisory for development servers (GHSA-67mh-4wv8-2f99); `pnpm.overrides` in the root `package.json` moves that one copy to esbuild 0.25.12, the fixed line. Remove the override once drizzle-kit drops the helper.
- @types/pg (type definitions). MIT.
- Vitest (unit and API tests). MIT.
- jsdom (browser stand-in for unit tests). MIT.
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

Licenses are as published by each project; confirm before any release.
