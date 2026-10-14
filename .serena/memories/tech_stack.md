# Tech Stack

- **Framework**: Next.js 15, App Router, TypeScript, React 19
- **CSS**: Tailwind CSS v4 (CSS-first, no tailwind.config.js) — semantic tokens in `app/globals.css`
- **UI components**: shadcn/ui → `src/shared/ui/`; lucide-react icons
- **DB**: MySQL via `mysql2/promise`; no ORM; `pool.execute()` for all queries
- **Auth**: Auth.js (NextAuth) v5 — JWT strategy; `src/shared/infrastructure/auth.ts`
- **Bundler**: Turbopack (`npm run dev`, `npm run build`)
- **Package manager**: npm
- **Runtime**: Node.js (Windows 11); `child_process` available in API routes
- **Themes**: next-themes (light/dark/system)
- **Fonts**: Geist Sans + Geist Mono
