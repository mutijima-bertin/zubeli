import { expect, type Page } from "@playwright/test";

/**
 * My account /account (owner: account-agent). Profile form is prefilled from
 * the server session; the header AccountMenu shows the signed-in name.
 */
export class AccountPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/account");
  }

  async expectHeading(): Promise<void> {
    await expect(this.page.getByRole("heading", { level: 1, name: "My account" })).toBeVisible();
  }

  /** Header account menu trigger carries the signed-in customer's name. */
  async expectUserName(name: string): Promise<void> {
    await expect(this.page.getByRole("button", { name: new RegExp(name) })).toBeVisible();
  }

  async expectEmailPrefilled(email: string): Promise<void> {
    await expect(this.page.getByLabel("Email")).toHaveValue(email);
  }

  async viewOrderHistory(): Promise<void> {
    await this.page.getByRole("link", { name: "View order history" }).click();
    await this.page.waitForURL(/\/account\/orders$/);
  }

  /** Open the account dropdown and sign out (lands back on the home page). */
  async signOut(name: string): Promise<void> {
    await this.page.getByRole("button", { name: new RegExp(name) }).click();
    await this.page.getByRole("button", { name: "Sign out" }).click();
    await expect(this.page.getByRole("link", { name: "Sign in" })).toBeVisible();
  }
}