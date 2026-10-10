import { expect, type Page } from "@playwright/test";
import { OWNER_SESSION_PATH } from "../admin-session";
import { ADMIN_NAV_LINKS, OWNER_EMAIL, OWNER_PASSWORD } from "../data";
import { LoginPage } from "./LoginPage";

/** Admin shell plumbing (dashboard-agent foundations).
 *
 * `signInAsOwner` drives the REAL middleware guard path: navigating to a
 * protected /admin/* route as a guest bounces to /login?next=…, and signing
 * in with the seeded owner honors the sanitized next path and lands back on
 * the original admin route. Specs never log in "directly".
 *
 * Reuse: admin specs run under a shared owner storageState session
 * (see e2e/admin-session.ts), so the page renders the admin route directly —
 * signInAsOwner detects that there is no /login bounce and skips the login.
 *
 * SELF-HEALING shared session: signing in creates a FRESH owner session and
 * the app revokes every previous session for that user
 * (createSessionRow → deleteMany({ userId }), src/lib/auth/session-token.ts).
 * So the one real owner login in admin-login.spec.ts would otherwise kill the
 * bootstrapped session and every LATER admin spec would bounce to /login and
 * burn another login attempt — 10 owner logins per run against a 10-per-15min
 * bucket, i.e. a guaranteed 429 for the last admin spec. Re-capturing the
 * storage state after a real login keeps the run at the intended TWO owner
 * logins (bootstrap + this one) and leaves the rate-limit headroom alone.
 */
export class AdminPage {
  constructor(private readonly page: Page) {}

  /** Land on the given admin route as the owner (login when bounced). */
  async signInAsOwner(adminPath = "/admin"): Promise<void> {
    await this.page.goto(adminPath);
    const bounced = await this.page.evaluate(() => location.pathname.startsWith("/login"));
    if (bounced) {
      const login = new LoginPage(this.page);
      await login.expectPath();
      await expect(this.page).toHaveURL(/next=%2F/);
      await login.signIn(OWNER_EMAIL, OWNER_PASSWORD);
      // Hand the fresh session to every later admin spec. Best-effort: a
      // storage-state write failure must not fail a journey that already
      // passed its assertions (the next spec simply logs in again).
      await this.page.context().storageState({ path: OWNER_SESSION_PATH }).catch(() => {});
    }
    await expect(this.page).toHaveURL((url) => url.pathname === adminPath.split("?")[0]);
  }

  /** All six admin nav links are visible in the sidebar. */
  async expectSidebarLinks(): Promise<void> {
    for (const label of ADMIN_NAV_LINKS) {
      await expect(this.page.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
  }

  /** The sidebar must be ABSENT (e.g. after a non-owner bounces home). */
  async expectNoSidebar(): Promise<void> {
    await expect(this.page.getByRole("link", { name: "Overview", exact: true })).toHaveCount(0);
  }

  /** Sign out from the admin top bar (lands back on the storefront). */
  async signOut(): Promise<void> {
    await this.page.getByRole("button", { name: "Sign out" }).click();
    await expect(this.page.getByRole("link", { name: "Sign in" })).toBeVisible();
  }
}