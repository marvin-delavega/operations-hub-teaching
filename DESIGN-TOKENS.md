# Design Tokens Reference

The single source of truth for color, radius, and type in Operations Hub. All
tokens are CSS variables defined once in [app/globals.css](app/globals.css) and
exposed to Tailwind via `@theme inline`. **Never hardcode raw Tailwind color
classes** (`bg-blue-600`, `text-red-700`, …) in components — resolve everything
through these semantic utilities.

## Theming

Theme is controlled by `next-themes` (class strategy). Light values live on
`:root`; dark values on `.dark`. The provider lives in
[app/shared/ui/ThemeProvider.tsx](app/shared/ui/ThemeProvider.tsx) and is mounted
in the root layout. Options: **Light / Dark / System** (System is the default,
following `prefers-color-scheme`). Choice persists per-device in localStorage; a
pre-paint script prevents theme flash. Users change it from the account menu.

## Color tokens

Each token maps to a Tailwind color utility family. `bg-{token}`,
`text-{token}`, `border-{token}`, and the `/opacity` modifier
(`bg-critical/10`) all work.

| Token | Role | Foreground pair |
| --- | --- | --- |
| `background` / `foreground` | App canvas + default text | — |
| `card` / `card-foreground` | Raised surfaces, tiles, panels | — |
| `popover` / `popover-foreground` | Menus, dropdowns | — |
| `primary` / `primary-foreground` | Brand blue **and** informational/"info" | white / near-black (dark) |
| `secondary` / `secondary-foreground` | Secondary buttons, toggles | — |
| `muted` / `muted-foreground` | Subtle fills, captions, de-emphasized text | — |
| `accent` / `accent-foreground` | Hover/selected tint (blue-tinted) | — |
| `destructive` / `destructive-foreground` | **Dangerous actions** (delete, sign out) | — |
| `border` | Hairlines, dividers | — |
| `input` | Form control borders | — |
| `ring` | Focus rings (`focus-visible:ring-ring`) | — |

### Domain status tokens

Saturated colors used as text/border directly and as tinted surfaces via
`/opacity`. Each has a readable `-foreground` for solid fills.

| Token | Meaning |
| --- | --- |
| `critical` | **Data needs attention** (low days-of-supply). Distinct from `destructive`. |
| `success` | Positive outcome (PO created). |
| `warning` | Caution. |
| `incoming` | Inbound/ordered stock (`+N`). |

> `critical` ≠ `destructive`: critical flags data that needs attention;
> destructive marks a dangerous action. They may look similar but stay separate.

> `primary` doubles as informational blue — there is no separate `info` token.

## Radius

One `--radius` token (`0.625rem`) drives all rounding. Derived steps are
exposed as Tailwind utilities: `rounded-sm`, `rounded-md`, `rounded-lg`,
`rounded-xl`. Do not introduce ad-hoc radii.

## Type scale

Use role classes, not free-picked sizes. Defined in `globals.css`.

| Class | Role |
| --- | --- |
| `type-page-title` | Page `<h1>` |
| `type-section-title` | Section `<h2>` / card titles |
| `type-body` | Default body text (≈ `text-sm`) |
| `type-label` | Form labels, table headers |
| `type-caption` | Helper/secondary text (muted) |
| `type-data` | SKUs, PO numbers, numeric columns (Geist Mono, tabular) |

Fonts: **Geist Sans** (UI) + **Geist Mono** (data). Do not add fonts.

## Component primitives

shadcn-style primitives live in [app/shared/ui/](app/shared/ui/) with variants
defined once. Prefer these over hand-rolled markup:

- **Button** — `primary` · `secondary` · `ghost` · `link` · `destructive`;
  sizes `default` (48px touch) · `sm` · `compact` (dense tables) · `icon`.
- **Badge** — `neutral` · `critical` · `success` · `warning` · `incoming`.
- **Input**, **Label**, **Checkbox** (supports `indeterminate`), **Card**,
  **DropdownMenu**, **Skeleton**.
- **SelectionTile** — shared single-select (tap → navigate) and multi-select
  (tap → toggle, full-tile selected treatment + corner check) tile.

Data tables stay semi-hand-rolled (token-based, not a shadcn Table primitive).

## Quality rules

- Interactive elements meet a **48px minimum touch target** (`min-h-12`). The
  one exception is in-table segmented toggles, which use the `compact` size for
  density.
- Focus states use `focus-visible:ring-ring`.
- Motion (`active:scale-95`, `animate-pulse`) is gated behind
  `motion-safe:` / `prefers-reduced-motion`.
