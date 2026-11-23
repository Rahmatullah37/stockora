# Development Log

## 2026-11-22 — Phase 1 review and documentation
- Found existing Phase 1 code (auth, shop registration, settings, i18n, 3 migrations), uncommitted.
- tsc and eslint pass. Fixed an ESLint/React Compiler warning (`watch` → `useWatch`) in the regional settings form.
- Production build verified with Google Fonts imports temporarily removed (sandbox has no access to Google Fonts); layout restored.
- Replaced the default create-next-app README; added the docs/ files.
- Open question: product name (Stockora in code vs ShopNexa in the Claude Project).
