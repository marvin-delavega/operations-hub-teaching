# PRD: Clean Architecture Restructure
Date: 2026-06-16

## 1. Overview
Restructure the GreatwallScanningApp from a co-located flat module layout into
a clean architecture with layers nested inside each module. The goal is strict
separation of concerns, inversion of control, and swappable volatile
dependencies (database, ERP integration, scanner input) without requiring a
third-party DI framework.

## 2. Goals
- Domain and application layers have zero knowledge of infrastructure specifics
- All volatile dependencies (DB, ERP, scanner) are injectable via interfaces
- Any infrastructure adapter can be swapped by changing only container.ts and
  the infrastructure/ folder of the affected module
- The codebase is testable at each layer in isolation
- Naming is unambiguous without tautological suffixes or prefixes

## 3. Non-Goals
- Introducing a third-party DI container (tsyringe, InversifyJS, etc.)
- Autowiring / decorator-based injection
- Splitting modules across top-level layer directories
- Adding tests in this restructure (testability is enabled, not implemented)

## 4. Users & Roles
This is a developer-facing architectural change. No end-user behavior changes.
Single developer maintains the codebase.

## 5. Functional Requirements

FR-1: Each module directory must contain exactly four concerns:
      domain/, application/, infrastructure/, page.tsx, api/route.ts.

FR-2: domain/ holds entities, value objects, domain behaviors, and repository
      port interfaces. It must not import from application/ or infrastructure/.

FR-3: application/ holds use cases (pure orchestration) and external service
      port interfaces (ERP, scanner, notifications). It may import from
      domain/ only.

FR-4: infrastructure/ holds concrete adapter implementations for all ports
      defined in domain/ and application/. It may import from both.

FR-5: api/route.ts acts as the HTTP primary adapter. It resolves its use case
      from container.ts, maps the HTTP request to use case input, and maps the
      use case output to an HTTP response. No business logic lives here.

FR-6: page.tsx remains a client-only component. It communicates with the server
      exclusively through the module's api/route.ts endpoint.

FR-7: kernel/ is eliminated and replaced by app/shared/ with three sub-layers:
      domain/, infrastructure/, ui/.

FR-8: app/shared/domain/ holds cross-module types (e.g. UserRole).

FR-9: app/shared/infrastructure/ holds the MySQL connection pool and all
      NextAuth configuration files.

FR-10: app/shared/ui/ holds shadcn/ui components, the cn() utility, and
       useScanner.ts.

FR-11: A single container.ts at the project root serves as the composition
       root. It exports one named factory function per use case
       (e.g. createGetDeliveriesUseCase()). Each factory manually instantiates
       and wires all concrete dependencies.

FR-12: File names carry only distinguishing information. The containing folder
       provides layer context. No Entity, Interface, I- prefix, or UseCase
       suffixes unless genuinely needed for disambiguation.

## 6. Data Model
No data model changes. This restructure is purely organizational.

## 7. API Contract
No API contract changes. Route URLs and shapes remain identical.

## 8. UI/UX Flow
No UI/UX changes. This restructure is invisible to end users.

## 9. Edge Cases & Error Handling

- If a use case needs to call another use case, it must do so via an
  application-layer interface, not by direct instantiation — keep orchestration
  decoupled.
- If shared logic is needed by only one module, it stays inside that module's
  folder. It moves to app/shared/ only when a second module needs it.
- middleware.ts stays at the project root; it is a Next.js platform concern,
  not an architectural layer.

## 10. Open Questions
- None. All key decisions are resolved.

## 11. Out of Scope / Deferred
- Actual test suite (architecture enables it; writing tests is a separate task)
- DI container library (deferred; manual wiring is sufficient at current scale)
- ERP integration adapters (infrastructure stubs exist; real implementations
  come with each module's feature work)
