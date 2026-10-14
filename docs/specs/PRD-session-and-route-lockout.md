# PRD: Session Persistence & Route Lockout
Date: 2026-06-23

## 1. Overview
This feature fixes a security defect and adds session-lifetime control. Today, signing out and pasting a protected URL (e.g. `/replenishment?...`) still loads the page with live data, because the route is incorrectly whitelisted as public in middleware. This PRD (a) restricts every route except login and the authentication endpoints to signed-in users, and (b) introduces a "Remember me" login option that controls whether a session survives a browser close, on a single 24-hour rolling idle window for all sessions.

## 2. Goals
- An unauthenticated user cannot access **any** route except the login screen and NextAuth's own auth endpoints — including via direct URL with query params.
- Every session expires after 24 hours of inactivity (rolling/idle window), refreshed by NextAuth's native session check.
- A "Remember me" checkbox on login (checked by default) controls cookie persistence:
  - Checked → session survives browser/tab close.
  - Unchecked → session ends on browser/tab close.
- When a user lands on a protected URL while signed out or expired, they are redirected to login, and after signing in are dropped on the home launcher `/`.
- When a session expires while a page is already open, returning focus to the tab redirects the user to login (active detection via window-focus re-check).
- Signing out in one tab signs out all open tabs.

## 3. Non-Goals
- No "remember my email/username" pre-fill on the login screen (session lifetime only).
- No client-side idle timer for a focused-but-motionless tab (window-focus re-check only).
- No interval/polling-based session refresh (it would defeat the idle timeout).
- No per-login differing timeout windows (single 24h window for everyone).
- No return-to-original-URL after login (always home).
- No changes to the authentication mechanism itself (still NextAuth v5, JWT strategy, role in token).
- No audit logging or session-management dashboard.

## 4. Users & Roles
- All authenticated users (admin and staff) are subject to the same session rules and the same 24-hour rolling window.
- The "Remember me" checkbox is available to every user on the login screen.
- Admin-only route protection (`/admin/*` requires `role === "admin"`) is unchanged by this PRD and continues to redirect non-admins to `/`.

## 5. Functional Requirements

**Route lockout**
- FR-1: The middleware public path list contains only `/login` and the NextAuth authentication endpoints (`/api/auth`). No business or selection routes (`/replenishment`, `/location`, `/supplier`, etc.) appear in it.
- FR-2: Any request to a non-public route without an active session is redirected to `/login`, regardless of path or query parameters.
- FR-3: The public-path matching must not allow a public prefix to unintentionally whitelist unrelated sub-paths; the list stays minimal and intentional.
- FR-4: Existing admin gating (`/admin/*` requires admin role; non-admins → `/`) remains in effect after the public list is corrected.

**Session lifetime**
- FR-5: All sessions use a single 24-hour rolling (idle) expiration: the window resets whenever NextAuth performs a session check on an authenticated request.
- FR-6: When "Remember me" is **checked** at login, the auth cookie is persistent and survives a browser/tab close (subject to the 24h idle window).
- FR-7: When "Remember me" is **unchecked** at login, the auth cookie is session-only and is cleared on browser/tab close (and also subject to the 24h idle window while open).
- FR-8: The "Remember me" checkbox defaults to **checked** on page load.
- FR-9: The session token's 24-hour validity is enforced server-side, so that a stale persistent cookie past the idle window is rejected even if the cookie file still exists in the browser.

**Post-login routing**
- FR-10: After a successful sign-in, the user is sent to the home launcher `/`, never to a previously requested deep link.

**Active expiry detection**
- FR-11: The app re-checks the session when an open tab/window regains focus.
- FR-12: If a focus-triggered re-check finds the session unauthenticated/expired, the user is redirected to `/login`.
- FR-13: The app must not use interval polling to refresh the session (to preserve the idle-timeout semantics).

**Sign-out**
- FR-14: Explicit sign-out clears the session and redirects to `/login` (current behavior, retained).
- FR-15: Signing out in one tab propagates sign-out to all other open tabs of the app.

**Cookie hardening**
- FR-16: Auth cookies are `httpOnly`, `sameSite=lax`, and `secure` in production. (Verify NextAuth defaults; override only where needed.)

## 6. Data Model
No persistent data-model changes.

- The "Remember me" choice is **not** stored in the database. It is a per-login input that influences cookie persistence at sign-in time.
- Session state continues to live in the JWT/cookie (NextAuth JWT strategy). The token carries the existing claims (including `role`); no new DB tables or columns are introduced.

## 7. API Contract
No new business endpoints. Changes are confined to the auth/middleware layer and the login form.

- **Middleware (all routes via matcher):** On each request, evaluate path against the minimal public list. Public → pass through. Non-public + no session → redirect to `/login`. Non-public + session + admin route + non-admin role → redirect to `/`. Otherwise → pass through.
- **Sign-in (NextAuth credentials flow):** Request additionally carries the "Remember me" boolean. Response behavior: on success, establish a session whose cookie is persistent (checked) or session-only (unchecked); both with a 24h rolling token. Redirect target after sign-in is `/`.
- **Session check (NextAuth session endpoint):** Used by the client for window-focus re-validation. Returns current session or unauthenticated; an authenticated check refreshes the rolling window.
- **Sign-out (NextAuth):** Clears the session cookie, redirects to `/login`, and broadcasts sign-out to other tabs.

## 8. UI/UX Flow

**Login (happy path)**
1. User opens `/login`. "Remember me" is checked by default.
2. User enters credentials. Optionally unchecks "Remember me" for strict (browser-close-ends) behavior.
3. On success, user is redirected to the home launcher `/`.

**Blocked deep link / expired session**
1. Signed-out (or expired) user navigates to any protected URL (e.g. `/replenishment?locationId=2&supplierIds=2,1,3`).
2. Middleware redirects to `/login`.
3. After signing in, user lands on `/` (not the original URL).

**Walk-away / return (active detection)**
1. User leaves a protected page open and is inactive past the 24h window (or the session is otherwise invalid).
2. User returns and refocuses the tab.
3. The app re-checks the session, detects it is no longer valid, and redirects to `/login`.

**Persistence behavior**
1. Checked "Remember me": user closes the browser, reopens within the idle window, and is still signed in.
2. Unchecked "Remember me": user closes the browser/tab; on reopening they must sign in again.

**Cross-tab sign-out**
1. User has the app open in multiple tabs and signs out in one.
2. All other tabs reflect the signed-out state and route to `/login` on their next interaction/re-check.

## 9. Edge Cases & Error Handling
- **Direct deep link with query params while signed out:** Redirect to `/login`; query params are discarded (post-login goes to `/`).
- **Stale persistent cookie past 24h idle:** Server rejects the token; user is treated as unauthenticated and redirected to `/login`.
- **Session expires mid-action (navigation or API call):** The request is unauthenticated → redirect to `/login` (API calls return unauthorized and the app routes to login).
- **Session expires while tab sits unfocused:** Caught on next focus re-check (FR-11/12) or on next action, whichever comes first.
- **Focused, motionless tab for hours:** Not actively interrupted (no idle timer); caught the moment the user acts or refocuses. Accepted limitation.
- **Admin route accessed by non-admin (authenticated):** Redirect to `/` (unchanged).
- **Public-path collision risk:** Public list kept minimal and intentional to prevent a prefix from whitelisting unintended routes (FR-3).

## 10. Open Questions
- None outstanding. (Implementation should verify NextAuth's default cookie attributes against FR-16 and confirm the credentials flow can carry the "Remember me" flag through to per-login cookie options.)

## 11. Out of Scope / Deferred
- Username/email pre-fill on login.
- Client-side idle timer for focused-but-idle tabs.
- Per-login or per-role differing timeout windows.
- Return-to-original-URL after login.
- Session-management UI (active sessions list, remote sign-out of other devices).
- Audit logging of sign-in/sign-out events.
