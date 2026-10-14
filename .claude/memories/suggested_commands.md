# Suggested Commands

```bash
npm run dev       # dev server (Turbopack) — http://localhost:3000
npm run build     # production build (Turbopack)
npm run start     # serve production build
npm run lint      # ESLint
npm test          # Vitest (single run)
npm run test:watch # Vitest (watch)
```

Unit tests run under **Vitest** (`vitest.config.ts`); pure-logic tests live in `tests/` mirroring `src/`.

## Windows-specific notes
- Shell: PowerShell (primary) or Git Bash
- `schtasks` is the Windows Task Scheduler CLI — available natively, no install needed
- `child_process.exec/execSync` work in Next.js API routes (server-side Node.js)
