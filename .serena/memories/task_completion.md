# Task Completion

After any coding task:

1. `npm run lint` — ESLint must pass (no new errors)
2. `npm run build` — TypeScript + Next.js build must pass (no type errors)

No formatter step (Prettier not configured). Unit tests: `npm test` (Vitest, pure-logic tests in `tests/`).

UI changes should be verified by running `npm run dev` and checking in a browser.
