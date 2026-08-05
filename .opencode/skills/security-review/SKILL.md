---
name: security-review
description: "Use when reviewing or writing code that handles auth, admin routes, payments, or user input in zubeli. Checklist for sessions, RBAC, validation, injection, secrets, rate limiting, and dependency safety."
---

# Security Review

Security checklist for zubeli. Run before merging any PR that touches auth, admin surfaces, payments, or user input.

## When to use
- Before merging auth/session changes, admin dashboard routes, checkout/payment code, or any feature accepting user input.
- As a pass over the whole codebase before go-live and after each milestone.

## Checklist
- **Auth/session hardening**: HTTP-only, `Secure`, `SameSite=Lax/Strict` cookies; short-lived sessions with refresh/rotation; hashed passwords (argon2/bcrypt) — never plaintext; logout invalidates server-side; account lockout after failed attempts.
- **RBAC on admin routes**: every `/admin/**` page, action, and API route checks role (owner/admin) server-side — client-side hiding is not a control. Central `requireAdmin()`/`requireRole()` helper used consistently (backend-patterns).
- **Input validation**: zod schema on every server action/route (backend-patterns). Never trust client-side validation alone.
- **Injection**: Prisma parameterizes queries — never string-concatenate raw SQL. Escape/whitelist sort and filter params (api-design). Use `textContent`-equivalent rendering; React escapes by default — no `dangerouslySetInnerHTML` without sanitizing (e.g., DOMPurify) for admin-entered content.
- **XSS**: no user HTML into `dangerouslySetInnerHTML`; sanitize rich text; CSP headers in `next.config` (no `unsafe-inline` for scripts) — add nonce/hash as needed.
- **Secrets**: env files only (`DATABASE_URL`, payment keys, session secret). `.env` gitignored; never log or commit secrets; rotate immediately if leaked; no secrets in client components or build-time code that ships to the browser.
- **Rate limiting**: login, password reset, checkout, and public API behind the shared `rateLimit()` helper (backend-patterns).
- **Payment data safety**: never store raw card data — use the provider's hosted/iframe checkout and tokens; store only provider references and last-4/expiry; payment keys are server-only; verify webhook signatures (never trust a callback's data blindly).
- **CSRF**: same-site cookies + origin checks on state-changing requests; server actions are CSRF-protected by Next.js — keep that intact.
- **IDOR / authorization**: check object ownership on every fetch (`order.userId === session.userId`), not just "logged in".
- **Dependency audits**: `npm audit` / `pnpm audit` in CI; pin deps; flag high-severity advisories before merge; keep Next.js and Prisma patched.
- **Defense in depth**: assume any single control can fail — session cookie leaked? Login still requires password. Admin endpoint exposed? RBAC still rejects non-owners. Verify controls independently, not through the same check.

## Review procedure
- Read the diff against this checklist, item by item; check the related tests exist (tdd-workflow) and are not superficial.
- Attack it like an attacker: try privilege escalation (customer hitting `/admin` actions), IDOR (order `:id` of another user), tampered `quantity`/`price` fields, replay of checkout requests.
- Sign off explicitly: "security review: passed / exceptions listed" on the PR before merge.

## Do NOT
- Do NOT merge admin routes without an RBAC test (see tdd-workflow).
- Do NOT add `user` details to responses unless the route needs them (api-design).
- Do NOT disable security defaults to "make it work" (e.g., `images.unoptimized`, relaxed CSP, `crossOrigin` hacks).
- Do NOT merge auth or payment changes without a second reviewer on the security checklist.

## Related
- backend-patterns (auth checks, rate limiting), api-design (error shape, validation), deployment-patterns (env vars in prod). Agents: backend-agent, account-agent, dashboard-agent, checkout-agent, uiux-reviewer.