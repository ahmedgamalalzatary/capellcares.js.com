# Auth Audit

## Purpose

This document compares the current auth systems in `apps/erp` and `apps/storefront` against a production-ready auth baseline. It is evidence-based and points to the exact files where each behavior was found.

## Production-Ready Auth Baseline

A production-ready auth system usually has most or all of these properties:

- Authentication is enforced by the backend, not only by frontend state.
- Protected API access depends on real credentials or server-trusted tokens, not public env vars exposed to the browser.
- Logout invalidates the active session meaningfully, not only local UI state.
- Token storage avoids unnecessary exposure to JavaScript when possible.
- Refresh/session persistence is explicit and consistent.
- Cookies used for auth are hardened for production with HTTPS and clear expiry behavior.
- Session refresh, revocation, and rotation are designed so stolen long-lived credentials can be cut off.
- Login endpoints are hardened against abuse with rate limiting and related controls.
- The system has a clear way to distinguish development shortcuts from production auth behavior.

---

## `/erp` Admin Auth Audit

## Current System

The current `/erp` auth flow is primarily a frontend gate plus a development backdoor for API access.

- The frontend login checks typed credentials against `NEXT_PUBLIC_DEV_ADMIN_EMAIL` and `NEXT_PUBLIC_DEV_ADMIN_PASSWORD` in the browser in [apps/erp/src/components/providers/admin-auth.tsx](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/erp/src/components/providers/admin-auth.tsx:16).
- If the credentials match, the frontend stores only a `user` object in `sessionStorage` under `capella.admin.v1` in [apps/erp/src/components/providers/admin-auth.tsx](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/erp/src/components/providers/admin-auth.tsx:14).
- ERP API calls send `x-admin-basic` built from `NEXT_PUBLIC_DEV_ADMIN_EMAIL` and `NEXT_PUBLIC_DEV_ADMIN_PASSWORD` on every request in [apps/erp/src/lib/api/client.ts](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/erp/src/lib/api/client.ts:2).
- The API accepts that header as a development fallback in [apps/api/src/middlewares/admin-auth.middleware.ts](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/api/src/middlewares/admin-auth.middleware.ts:11).
- The API also contains an admin JWT login route in [apps/api/src/modules/admin/auth/admin-auth.routes.ts](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/api/src/modules/admin/auth/admin-auth.routes.ts:7), but the ERP frontend is not using it.

## Gaps vs Production-Ready Auth

### 1. Frontend-only login state is not real security

What exists now:
- The ERP app decides "logged in" by whether a `user` object exists in `sessionStorage` in [apps/erp/src/components/providers/admin-auth.tsx](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/erp/src/components/providers/admin-auth.tsx:30).

Why this fails production expectations:
- `sessionStorage` is only browser state. It is not a trustworthy authentication source.
- A production auth system should rely on backend-validated sessions or tokens, not only a client-side flag.
- Anyone who can control browser state can appear logged in to the UI.

Where found:
- [apps/erp/src/components/providers/admin-auth.tsx](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/erp/src/components/providers/admin-auth.tsx:30)
- [apps/erp/src/components/shell/admin-shell.tsx](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/erp/src/components/shell/admin-shell.tsx:30)

### 2. Credentials are exposed to the browser through public env vars

What exists now:
- The ERP frontend reads `NEXT_PUBLIC_DEV_ADMIN_EMAIL` and `NEXT_PUBLIC_DEV_ADMIN_PASSWORD` directly in browser code in [apps/erp/src/components/providers/admin-auth.tsx](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/erp/src/components/providers/admin-auth.tsx:16) and [apps/erp/src/lib/api/client.ts](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/erp/src/lib/api/client.ts:2).

Why this fails production expectations:
- `NEXT_PUBLIC_*` values are exposed to the client bundle by design.
- Production admin auth must not put real admin credentials into browser-visible configuration.
- This is a development shortcut, not a secure auth model.

Where found:
- [apps/erp/src/components/providers/admin-auth.tsx](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/erp/src/components/providers/admin-auth.tsx:16)
- [apps/erp/src/lib/api/client.ts](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/erp/src/lib/api/client.ts:2)

### 3. ERP API access depends on a dev fallback header, not a user session

What exists now:
- Every ERP API request includes `x-admin-basic` in [apps/erp/src/lib/api/client.ts](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/erp/src/lib/api/client.ts:21).
- The backend accepts this header and bypasses normal token auth when it matches the configured fallback in [apps/api/src/middlewares/admin-auth.middleware.ts](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/api/src/middlewares/admin-auth.middleware.ts:12).

Why this fails production expectations:
- API authorization is effectively tied to a shared static secret, not to an authenticated admin session.
- This does not support proper account identity, device/session management, logout invalidation, or per-user accountability.
- A production admin system should not trust a browser-supplied static admin header as its normal auth path.

Where found:
- [apps/erp/src/lib/api/client.ts](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/erp/src/lib/api/client.ts:21)
- [apps/api/src/middlewares/admin-auth.middleware.ts](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/api/src/middlewares/admin-auth.middleware.ts:8)

### 4. Logout only clears UI state

What exists now:
- ERP logout just sets `user` to `null` in the frontend in [apps/erp/src/components/providers/admin-auth.tsx](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/erp/src/components/providers/admin-auth.tsx:59).

Why this fails production expectations:
- A production logout should end or invalidate the active authenticated session on the server side.
- Here, there is no real session to revoke. The API still relies on dev credentials from env vars, not on login state.

Where found:
- [apps/erp/src/components/providers/admin-auth.tsx](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/erp/src/components/providers/admin-auth.tsx:59)

### 5. The implemented admin JWT flow is not wired into the ERP frontend

What exists now:
- The API can issue an admin access token in [apps/api/src/modules/admin/auth/admin-auth.service.ts](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/api/src/modules/admin/auth/admin-auth.service.ts:33).
- That token defaults to a `15m` lifetime if `JWT_ACCESS_TTL` is not set in [apps/api/src/modules/admin/auth/admin-auth.service.ts](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/api/src/modules/admin/auth/admin-auth.service.ts:16).
- The current ERP frontend does not appear to call `/api/erp/auth/login` or store/use the returned token.

Why this fails production expectations:
- The codebase contains the start of a more real admin auth flow, but the actual ERP app is not using it.
- In practice, the live ERP auth behavior is still the dev fallback path described above.

Where found:
- [apps/api/src/modules/admin/auth/admin-auth.routes.ts](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/api/src/modules/admin/auth/admin-auth.routes.ts:7)
- [apps/api/src/modules/admin/auth/admin-auth.service.ts](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/api/src/modules/admin/auth/admin-auth.service.ts:33)
- No corresponding ERP frontend usage found in `apps/erp`.

## `/erp` Summary

`/erp` is not production-ready auth. It is a development-only pattern built around:

- client-side `sessionStorage` state
- public env credentials in the browser
- a static `x-admin-basic` fallback header

It should be treated as a temporary development shortcut, not as deployable admin authentication.

---

## `/storefront` Customer Auth Audit

## Current System

The current `/storefront` auth flow is a real token-based customer auth system, but it still falls short of production-ready hardening.

- Login validates the customer against the database and issues:
  - a `15m` access JWT
  - a `30d` refresh JWT
  in [apps/api/src/modules/auth/auth.service.ts](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/api/src/modules/auth/auth.service.ts:16).
- The refresh token is set in a cookie named `capella_refresh` in [apps/api/src/modules/auth/auth.controller.ts](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/api/src/modules/auth/auth.controller.ts:18).
- The storefront frontend stores both the user and the access token in `localStorage` in [apps/storefront/src/components/providers/auth-provider.tsx](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/storefront/src/components/providers/auth-provider.tsx:20).
- On hydration, if the user exists but the access token is missing, the frontend calls `/api/v1/auth/refresh` with `credentials: "include"` to get a new access token in [apps/storefront/src/components/providers/auth-provider.tsx](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/storefront/src/components/providers/auth-provider.tsx:44).
- Protected storefront requests use `Authorization: Bearer <accessToken>` in [apps/storefront/src/lib/api/client.ts](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/storefront/src/lib/api/client.ts:93), and the API validates that bearer token in [apps/api/src/middlewares/auth.middleware.ts](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/api/src/middlewares/auth.middleware.ts:8).

## Gaps vs Production-Ready Auth

### 1. Access token is stored in `localStorage`

What exists now:
- The access token is persisted in `localStorage` under `capella.auth.token.v1` in [apps/storefront/src/components/providers/auth-provider.tsx](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/storefront/src/components/providers/auth-provider.tsx:21).

Why this fails production expectations:
- Tokens in `localStorage` are readable by JavaScript.
- If the app ever suffers from XSS, an attacker can steal the token.
- Production systems usually try to reduce JavaScript access to long-lived auth material and often avoid browser-readable bearer-token persistence.

Where found:
- [apps/storefront/src/components/providers/auth-provider.tsx](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/storefront/src/components/providers/auth-provider.tsx:75)

### 2. Refresh cookie is not hardened for production transport

What exists now:
- The refresh cookie is `httpOnly` and `sameSite: "lax"`, but it is also `secure: false` in [apps/api/src/modules/auth/auth.controller.ts](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/api/src/modules/auth/auth.controller.ts:18).

Why this fails production expectations:
- In production, auth cookies should normally be sent only over HTTPS.
- `secure: false` is acceptable for local development, not for production deployment.

Where found:
- [apps/api/src/modules/auth/auth.controller.ts](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/api/src/modules/auth/auth.controller.ts:18)

### 3. Logout does not clear the refresh cookie on the server

What exists now:
- Storefront logout only clears frontend `user` and `accessToken` state in [apps/storefront/src/components/providers/auth-provider.tsx](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/storefront/src/components/providers/auth-provider.tsx:109).
- There is no logout API route in the current auth module that clears `capella_refresh`.

Why this fails production expectations:
- A user can click logout while the browser may still retain a valid refresh cookie.
- That means the session is not meaningfully terminated server-side.
- Production auth should include a real logout path that clears or invalidates refresh state.

Where found:
- [apps/storefront/src/components/providers/auth-provider.tsx](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/storefront/src/components/providers/auth-provider.tsx:109)
- [apps/api/src/modules/auth/auth.routes.ts](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/api/src/modules/auth/auth.routes.ts:5)

### 4. No refresh-token rotation or revocation layer is visible

What exists now:
- The refresh token is a signed JWT with `30d` lifetime in [apps/api/src/modules/auth/auth.service.ts](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/api/src/modules/auth/auth.service.ts:22).
- Refresh simply verifies that JWT and issues a new access token in [apps/api/src/modules/auth/auth.controller.ts](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/api/src/modules/auth/auth.controller.ts:30).

Why this fails production expectations:
- I do not see refresh-token rotation, DB-backed refresh sessions, jti tracking, revocation lists, or per-device session management.
- If a refresh token is stolen, it appears valid until expiry unless secrets are changed globally.
- Production auth usually needs a way to cut off stolen or logged-out refresh credentials before their natural expiry.

Where found:
- [apps/api/src/modules/auth/auth.service.ts](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/api/src/modules/auth/auth.service.ts:16)
- [apps/api/src/modules/auth/auth.controller.ts](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/api/src/modules/auth/auth.controller.ts:30)

### 5. Cookie lifetime policy is not explicitly aligned with the refresh token lifetime

What exists now:
- The refresh JWT itself expires in `30d` in [apps/api/src/modules/auth/auth.service.ts](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/api/src/modules/auth/auth.service.ts:22).
- The cookie set in [apps/api/src/modules/auth/auth.controller.ts](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/api/src/modules/auth/auth.controller.ts:18) does not define `maxAge` or `expires`.

Why this falls short:
- The server defines a 30-day token lifetime, but the cookie persistence policy is not explicitly set to match it.
- That can create inconsistent browser behavior and makes the intended login persistence less explicit than a production auth system should be.

Where found:
- [apps/api/src/modules/auth/auth.service.ts](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/api/src/modules/auth/auth.service.ts:22)
- [apps/api/src/modules/auth/auth.controller.ts](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/api/src/modules/auth/auth.controller.ts:18)

### 6. No visible abuse protection on login and refresh endpoints

What exists now:
- I do not see rate limiting, cooldowns, lockouts, or similar auth endpoint protection around `/api/v1/auth/login` and `/api/v1/auth/refresh` in the current auth route/controller flow.

Why this fails production expectations:
- Production auth endpoints usually need brute-force and abuse protection.
- Without that, password guessing and auth endpoint abuse are easier.

Where found:
- [apps/api/src/modules/auth/auth.routes.ts](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/api/src/modules/auth/auth.routes.ts:5)
- [apps/api/src/app.ts](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/api/src/app.ts:1)

### 7. Server-side session control is limited

What exists now:
- The system trusts signed JWTs and does not appear to maintain server-side customer session records for normal auth refresh behavior.

Why this falls short:
- There is no obvious per-session kill switch, device list, forced logout capability, or targeted revocation path.
- Production systems often need these controls for security operations, account recovery, and suspicious-session handling.

Where found:
- [apps/api/src/modules/auth/auth.service.ts](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/api/src/modules/auth/auth.service.ts:16)
- [apps/api/src/modules/auth/auth.controller.ts](/D:/Documents/currentwork/capella/capellastore/capellacares.js.com/apps/api/src/modules/auth/auth.controller.ts:30)

## `/storefront` Summary

`/storefront` is a legitimate auth foundation, but not yet a production-ready auth system.

What it already has:
- customer credential verification against the database
- short-lived access JWTs
- refresh JWTs
- backend bearer-token validation

What still blocks production-readiness:
- access token stored in `localStorage`
- refresh cookie not configured for secure production transport
- no real logout endpoint or refresh-cookie invalidation
- no visible refresh-token rotation or revocation strategy
- no visible brute-force protection
- limited server-side session control

---

## Overall Comparison

### `/erp`

Current state:
- development-only auth shortcut
- frontend state in `sessionStorage`
- browser-visible admin credentials
- static admin header accepted by the API

Production-readiness:
- not production-ready

### `/storefront`

Current state:
- real customer login and token issuance
- access JWT plus refresh JWT
- bearer-token protected API routes
- browser persistence through `localStorage` and refresh cookie

Production-readiness:
- closer to production than `/erp`
- still not production-ready without security hardening and better session design
