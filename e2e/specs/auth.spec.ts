import { expect, test } from "@playwright/test";
import { CUSTOMER_ERIC, CUSTOMER_UMUTONI, DEMO_PASSWORD } from "../data";
import { AccountPage } from "../pages/AccountPage";
import { LoginPage } from "../pages/LoginPage";

/**
 * Journey: auth. Login (seeded customer), wrong-credentials error, protected
 * route bouncing guests to /login?next, the auth-route ?next bounce, and
 * sign-out restoring the guest header.
 */
test.describe("Auth", () => {
  test("seeded customer signs in and sees their account", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.signIn(CUSTOMER_UMUTONI.email, DEMO_PASSWORD);

    const account = new AccountPage(page);
    await account.expectHeading();
    await account.expectUserName(CUSTOMER_UMUTONI.name);
  });

  test("wrong password shows an error and stays on login", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.fillCredentials(CUSTOMER_UMUTONI.email, "definitely-wrong");
    await login.clickSignIn();
    await login.expectError("Invalid email or password");
    await login.expectPath();
  });

  test("guest /account bounces to /login?next=/account and returns after sign-in", async ({ page }) => {
    // Middleware redirect (no session).
    await page.goto("/account");
    const login = new LoginPage(page);
    await login.expectPath();
    await expect(page).toHaveURL(/next=%2Faccount/);

    // After signing in the sanitized next path is honored.
    await login.signIn(CUSTOMER_ERIC.email, DEMO_PASSWORD);
    const account = new AccountPage(page);
    await account.expectHeading();
    await account.expectUserName(CUSTOMER_ERIC.name);
  });

  test("login ?next targeting an auth route bounces to /account", async ({ page }) => {
    // Deliberate: sanitizeNextPath rejects /login and /register destinations.
    const login = new LoginPage(page);
    await login.goto("/login");
    await login.signIn(CUSTOMER_UMUTONI.email, DEMO_PASSWORD);

    const account = new AccountPage(page);
    await account.expectHeading();
    await account.expectUserName(CUSTOMER_UMUTONI.name);
  });

  test("signed-in customer signs out; /account bounces again", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.signIn(CUSTOMER_ERIC.email, DEMO_PASSWORD);

    const account = new AccountPage(page);
    await account.expectHeading();
    await account.signOut(CUSTOMER_ERIC.name);

    // Protected route is guarded again after the session is destroyed.
    await account.goto();
    await login.expectPath();
    await expect(page).toHaveURL(/next=%2Faccount/);
  });
});