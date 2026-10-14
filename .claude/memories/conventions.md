# Conventions

## Clean Architecture Layer Rules (hard constraints)
- `domain/` must not import `application/` or `infrastructure/`
- `application/` may import `domain/` only (same module)
- `infrastructure/` may import `domain/` and `application/`
- `page.tsx` — client-only ("use client"); no DB/auth/server-only imports
- `api/route.ts` — HTTP adapter only; no business logic; resolves use case from container
- `src/container.ts` — only file importing infrastructure for wiring

## Naming
- No tautological prefixes: `domain/Delivery.ts` not `DeliveryEntity.ts`
- Interface names: `domain/DeliveryRepository.ts` not `IDeliveryRepository.ts`
- Impl prefix only for disambiguation: `infrastructure/MySQLDeliveryRepository.ts`
- No re-export wrapper files

## Design System
- Semantic tokens only — never raw Tailwind colors (`bg-blue-600` etc.)
- Token set: shadcn base + `critical`, `success`, `warning`, `incoming`
- 48px minimum touch target (Android)
- Type scale roles: `type-page-title`, `type-section-title`, `type-body`, `type-label`, `type-caption`, `data/mono`

## Other
- No comments unless the WHY is non-obvious
- YAGNI — no generics/config flags for future flexibility
- Fail Fast — validate at API boundary
- Command-Query Separation — GET returns data only; POST/PUT/DELETE change state
