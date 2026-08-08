import { type Page } from "@playwright/test";

export type RegistrationValues = {
  name: string;
  email: string;
  phone?: string;
  password: string;
};

/**
 * Create account /register (owner: account-agent). registerAction creates
 * the user AND a session, so success navigates straight to /account.
 */
export class RegisterPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/register");
  }

  async register(values: RegistrationValues): Promise<void> {
    await this.page.getByLabel("Full name").fill(values.name);
    await this.page.getByLabel("Email").fill(values.email);
    if (values.phone) await this.page.getByLabel("Phone").fill(values.phone);
    await this.page.getByLabel("Password").fill(values.password);
    await this.page.getByRole("button", { name: "Create account" }).click();
    await this.page.waitForURL(/\/account$/);
  }
}