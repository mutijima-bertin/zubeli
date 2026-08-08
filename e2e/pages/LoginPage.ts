import { expect, type Page } from "@playwright/test";

/**
 * Sign-in /login (owner: account-agent). The `?next` param is sanitized
 * server-side (anti open-redirect + auth-route bounce).
 */
export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto(nextPath?: string): Promise<void> {
    const suffix = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    await this.page.goto(`/login${suffix}`);
  }

  async fillCredentials(email: string, password: string): Promise<void> {
    await this.page.getByLabel("Email").fill(email);
    await this.page.getByLabel("Password").fill(password);
  }

  /** Click only — for negative cases that stay on /login (wrong password). */
  async clickSignIn(): Promise<void> {
    await this.page.getByRole("button", { name: "Sign in" }).click();
  }

  async submit(): Promise<void> {
    await this.page.getByRole("button", { name: "Sign in" }).click();
    await this.page.waitForURL((url) => !url.pathname.startsWith("/login"));
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.fillCredentials(email, password);
    await this.submit();
  }

  async expectError(message: string): Promise<void> {
    await expect(this.page.getByText(message, { exact: true })).toBeVisible();
  }

  /** Assert we are on /login (e.g. after a failed attempt or a bounce). */
  async expectPath(): Promise<void> {
    await expect(this.page).toHaveURL((url) => url.pathname === "/login");
  }
}