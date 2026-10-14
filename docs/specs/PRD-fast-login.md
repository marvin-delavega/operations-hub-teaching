# PRD: Fast Login (User Picker + Branded Login Screen)
Date: 2026-06-25

## 1. Overview
A faster, more polished login experience for the `/login` screen. Returning users on a device are remembered as tappable **display-name cards**, letting them skip typing a username — but a **password is still required every time**. The screen also gains an engaging, branded layer: a subtle theme-aware animated background, brand/company identity, and a rotating carousel explaining the app's modules. The credential flow (picker → password → manual entry) lives inside a single widget that **slides between states in-element**, with no route change and a fixed background.

## 2. Goals
- Let returning users authenticate faster by skipping username entry on a shared device.
- Preserve current security: password is always required; no passwordless entry.
- Remember users **per device** (localStorage), gated by the existing "Remember me" toggle.
- Provide a seamless in-widget transition between picker, password, and manual-entry states (no URL change).
- Make the login screen feel polished and informative: branding, company identity, and a feature carousel covering the full module lineup.
- Respect the existing design system (semantic tokens, 48px touch targets, `prefers-reduced-motion`, theme-aware light/dark).

## 3. Non-Goals
- **No passwordless / one-tap login.** Selecting a user never bypasses the password.
- **No change to auto-login behavior.** A live session already skips `/login` via existing middleware — unchanged, not re-implemented here.
- No cross-device or server-stored user list. The remembered list is per-device only.
- No change to session lifetime, the 24-hour rolling window, or the window-focus re-check.
- No change to the meaning of "Remember me" for cookie persistence (it gains a second, additive meaning only).
- No new rate-limiting / brute-force protection (out of scope; behavior unchanged).

## 4. Users & Roles
- **All authenticated roles** (`admin`, `staff`). The picker and branded screen are role-agnostic.
- No role gating on the picker, the delete action, or manual entry. Any user of a shared device may remove any remembered card from **that device** (a local convenience only — it never affects the actual account).

## 5. Functional Requirements

### Remembered-user picker
- **FR-1** The login screen shows a list of users previously remembered **on this device**, most-recently-logged-in first.
- **FR-2** A user is added to the device's remembered list only when they complete a successful login with **"Remember me" checked** (the toggle defaults to checked).
- **FR-3** Once a user is in the list, they remain until explicitly removed. Logging in later with "Remember me" **unchecked** does **not** remove them (it only affects cookie persistence for that session).
- **FR-4** Each remembered user is rendered as a card showing **display name only**. The username is retained locally (not displayed) to pre-fill and submit credentials. **No password is ever stored.**
- **FR-5** The list keeps all remembered users; the visible window shows ~5 cards, and the list scrolls to reach the rest.
- **FR-6** Tapping a card transitions to the **password step** for that user.
- **FR-7** The picker offers an explicit option to **sign in manually** (different account), transitioning to the manual-entry state.
- **FR-8** If the remembered list is **empty**, the screen opens directly in the **manual-entry** state (no empty picker shown).
- **FR-9** A card can be **deleted** via swipe-left to reveal a delete action, followed by a confirmation ("Remove [name] from this device?"). An accessible non-gesture alternative (e.g. long-press / edit affordance) is also provided.
- **FR-10** Deleting a card removes it only from this device's local list; it does not modify or disable the underlying account.

### Credential states & transitions
- **FR-11** The login experience is a single `/login` route with three widget states: **Picker**, **Password step**, **Manual entry**.
- **FR-12** Transitions between states **slide in-element** within the widget. The branded background and ambient layer remain fixed; the URL does not change.
- **FR-13** **Password step:** shows the selected user's display name, a password field, a "Remember me" toggle (default checked), a back control returning to the picker, and submits the pre-filled username + entered password.
- **FR-14** **Manual entry:** shows username + password fields, a "Remember me" toggle (default checked), and a back control returning to the picker (when a picker exists).
- **FR-15** "Remember me" appears on both the password step and manual entry, defaulted checked. On the password step it governs cookie persistence only (the user is already in the picker).
- **FR-16** On successful login with "Remember me" checked, the user's `{ username, displayName, lastLoginAt }` is written to the device list (or its `lastLoginAt` updated and moved to the top if already present).

### Branded / engaging content
- **FR-17** The login screen displays a **logo**, the **app name** ("Operations Hub"), and the **company name** read from `app_settings.company_name`, falling back to **"Operations Hub"** when absent.
- **FR-18** A **feature carousel** rotates through short capability descriptions covering the **full module lineup** (all nine modules). Slides are presented as capabilities and **never labeled "Coming Soon."**
- **FR-19** The background is a **subtle, corporate-style animated gradient with a blur effect and slight motion**, and is **theme-aware** (adapts to Light/Dark).
- **FR-20** A welcome line and a one-sentence purpose statement are shown alongside the brand identity.

### Motion & accessibility
- **FR-21** Under `prefers-reduced-motion`, a single consistent fallback applies: the ambient background becomes **static**, the widget state change **cross-fades or cuts** (no slide), and the feature carousel becomes a **static or cross-fading list** (no sliding auto-advance).
- **FR-22** All interactive targets meet the **48px minimum** touch target. Colors resolve through **semantic tokens** only (no hardcoded Tailwind colors). Theme load shows **no flash**.

## 6. Data Model

### Local (per-device, `localStorage`)
Remembered-users list — an ordered collection (most-recent first) of entries:

| Field | Type | Notes |
|---|---|---|
| `username` | string | Credential identifier; used to pre-fill/submit. Not displayed. |
| `displayName` | string | Captured from the session after successful login; shown on the card. |
| `lastLoginAt` | timestamp | Drives ordering (most-recent first) and top-of-list promotion. |

- No password or token is ever stored locally.
- Stored under a single app-namespaced key. Clearing browser data / incognito → empty list → manual entry (FR-8). Acceptable, non-recoverable by design.
- Display-name collisions: cards are keyed by `username`; when two visible cards share a display name, a small disambiguator is shown.

### Server / DB
- No new tables. Reuses `app_settings.company_name`.
- **New requirement:** `company_name` must be readable **pre-authentication** so `/login` can render it (see API Contract). Single non-sensitive value.

## 7. API Contract

### Read company name (pre-auth)
- **Purpose:** allow the unauthenticated `/login` screen to display the company name.
- **Method / shape:** a public read returning `{ companyName: string | null }`, where `null`/absent → client falls back to "Operations Hub".
- **Access:** publicly readable (no session). Exposes only the company-name string; no other settings.
- **Type:** query only (no state change).

### Authentication
- Unchanged. Login submits the existing credentials flow (username + password + remember-me) through the current NextAuth credentials path. The picker and password step are UI adapters that pre-fill and submit these existing fields.
- On success, the client captures the session's display name and updates the local remembered-users list per FR-16.

## 8. UI/UX Flow

**Entry (has remembered users):**
1. User opens `/login`. Branded background, logo, app/company name, welcome + purpose line, and rotating feature carousel render around a central widget.
2. Widget opens on the **Picker**: up to ~5 display-name cards (scroll for more), most-recent first, plus a "Sign in manually" option.
3. User taps their card → widget **slides** to the **Password step** (display name shown, password field, "Remember me" checked, back arrow).
4. User enters password → submit. On success, they enter the app; their card moves to top with refreshed `lastLoginAt`.

**Entry (no remembered users):**
1. Widget opens directly on **Manual entry** (username + password + "Remember me" checked).
2. On successful login with "Remember me" checked, the user is added to the device list for next time.

**Switch / different account:**
1. From the Picker, tap "Sign in manually" → widget **slides** to **Manual entry**.
2. Back control returns to the Picker.

**Remove a remembered user:**
1. In the Picker, swipe a card left to reveal delete (or use the accessible alternative).
2. Confirm "Remove [name] from this device?" → card removed locally only.

**Reduced-motion:** background static, transitions cross-fade/cut, carousel static/fading.

## 9. Edge Cases & Error Handling
- **Wrong password (any state):** standard inline error; user retries. No state change.
- **Account deleted/disabled since being remembered:** login fails with a **generic error** (no "user not found" disclosure). The stale card is **not** auto-removed (auto-removal would confirm the account's absence). User may swipe-delete it manually.
- **Empty / cleared list:** open directly on manual entry (FR-8).
- **Duplicate display names:** disambiguate visible collisions (FR-4 / Data Model).
- **"Remember me" unchecked on re-login of a remembered user:** stays in picker; only cookie persistence changes (FR-3).
- **`company_name` unavailable (missing or read fails):** fall back to "Operations Hub" (FR-17).
- **Live session lands on `/login`:** existing middleware skips straight into the app (unchanged; out of this feature's scope).
- **Reduced-motion preference:** consistent static/cross-fade fallback across all three animated elements (FR-21).

## 10. Open Questions
- Exact wording of the welcome line and the one-sentence purpose statement (to be finalized during implementation).
- Final copy for each module's carousel slide and the auto-advance interval.
- Exact accessible (non-gesture) delete affordance — long-press vs. an explicit edit toggle — to be chosen during UI build.

## 11. Out of Scope / Deferred
- Passwordless / biometric / PIN login.
- Cross-device or server-synced remembered-user lists.
- Changes to session lifetime, rolling window, focus re-check, or auto-login.
- New brute-force / rate-limiting protections.
- Per-module filtering of which users appear (list is global per device).
