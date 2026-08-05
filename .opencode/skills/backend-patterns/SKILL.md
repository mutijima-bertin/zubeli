---
name: backend-patterns
description: "Use when writing route handlers, server actions, or any server-side logic in zubeli. Covers action structure, zod validation, error handling, auth checks, rate limiting, and typed returns."
---

# Backend Patterns

Server-side conventions for zubeli: route handlers, server actions, validation, auth, and errors.

## When to use
- Creating or editing anything in `src/app/**/actions.ts`, `src/app/api/**`, or `src/lib` (server-side).

## Core rules
- **Server actions for mutations** (`"use server"`), route handlers only when the client/3rd party needs a plain HTTP endpoint (webhooks, public API).
- Structure every action:
  ```ts
  export async function createOrder(input: unknown) {
    const data = createOrderSchema.parse(input); // zod
    const user = await requireUser();             // auth first
    return withOrderRepo(async (repo) => {        // DI + transaction boundary
      return repo.create(data, user.id);
    });
  }
  ```
- Validate every input with zod (`zod` v4). Coerce/transform at the boundary; never trust raw `FormData` or body.
- Errors: throw typed errors (`ProductOutOfStockError`, `NotAuthorizedError`); let the global handler map them to responses/messages. No bare `throw new Error` in actions — use the shared error classes in `src/lib/errors`.
- Auth check at the top of every action/route that touches user data. Never skip auth in a function "because the UI hides it".
- Rate limiting on public-facing routes (checkout, login, API): token bucket per IP/user via shared `rateLimit()` helper in `src/lib/rate-limit`.
- DI via function composition: repositories take a Prisma client, actions take repositories. No global singletons imported deep inside functions — makes tests trivial.
- Return typed, serializable objects from actions. Use `ActionResult<T>` union (`{ ok: true, data } | { ok: false, error }`) for mutations consumed by client forms.
- Log with the project logger: request id, action name, user id where available. Never log values (passwords, payment data).
- Keep actions thin: validation → auth → repository call. Business rules live in `src/lib` so they're unit-testable (see tdd-workflow).

## Do NOT
- Do NOT put DB logic directly in actions — route through repositories.
- Do NOT use `any` or `unknown` at call sites without parsing.
- Do NOT forget `revalidatePath`/`revalidateTag` after mutations that change storefront-visible data.
- Do NOT expose internal errors to clients — map to friendly messages.
- Do NOT write new pages/API without checking auth requirements (see security-review).

## Related
- api-design (HTTP endpoints), postgres-patterns + prisma-patterns (repositories), tdd-workflow, security-review. Agents: backend-agent, database-agent, checkout-agent, account-agent, stock-agent.
