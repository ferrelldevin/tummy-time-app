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
- AHRQ PEMAT and the CDC Clear Communication Index (content checks).

## Libraries and assets
Every library, image, font or dataset is listed here by name, with its license.

Runtime libraries
- React and React DOM (build the screens). MIT.
- Fastify (the API server). MIT.
- Zod (checks data shapes, shared by web and API). MIT.

Build and test tools
- Vite and @vitejs/plugin-react (dev server and bundler). MIT.
- TypeScript (types). Apache-2.0.
- tsx (runs the API in development). MIT.
- Vitest (unit and API tests). MIT.
- jsdom (browser stand-in for unit tests). MIT.
- @testing-library/react and @testing-library/dom (test React screens like a user). MIT.
- Playwright Test (@playwright/test) (end-to-end tests). Apache-2.0.
- @axe-core/playwright and axe-core (automatic accessibility scan). MPL-2.0.
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
- postgres, nginx, node (official Docker images). Licenses of the software inside: PostgreSQL License, BSD-2-Clause, MIT.

Licenses are as published by each project; confirm before any release.
