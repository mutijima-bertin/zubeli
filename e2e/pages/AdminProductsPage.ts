import { expect, type Page } from "@playwright/test";
import { AdminPage } from "./AdminPage";

export type NewProductValues = {
  name: string;
  slug: string;
  categoryLabel: string;
  price: string;
  stock: string;
};

/**
 * /admin/products (+ new + [id]/edit) (owner: inventory-agent). Create/edit
 * forms submit Flight-signed server actions; field errors are server-side
 * zod messages rendered by FormField (role="alert"). The publish toggle and
 * soft delete live in the list row actions and the edit quick-actions.
 */
export class AdminProductsPage {
  protected readonly main = this.page.locator("main#main");

  constructor(protected readonly page: Page) {}

  /** Bounce through the middleware guard and land on the product list. */
  async gotoAsOwner(): Promise<void> {
    const admin = new AdminPage(this.page);
    await admin.signInAsOwner("/admin/products");
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto("/admin/products/new");
    await expect(this.page.getByRole("heading", { level: 1, name: "New product" })).toBeVisible();
  }

  /** Narrow the list by name/slug (debounced client fetch). */
  async search(name: string): Promise<void> {
    await this.page.getByLabel("Search products").fill(name);
    await expect(this.page.getByRole("link", { name, exact: true }).first()).toBeVisible();
  }

  async expectProductVisible(name: string): Promise<void> {
    await expect(this.page.getByRole("link", { name, exact: true }).first()).toBeVisible();
  }

  async expectProductGone(name: string): Promise<void> {
    await expect(this.page.getByRole("link", { name, exact: true })).toHaveCount(0);
  }

  /** Row-scoped badge (Unpublished/Published/Low/…). */
  async expectRowBadge(name: string, label: string): Promise<void> {
    const row = this.page.getByRole("row").filter({ hasText: name });
    await expect(row.getByText(label, { exact: true }).first()).toBeVisible();
  }

  /** A server-side field error under the form (zod fieldErrors). */
  async expectFieldError(message: string | RegExp): Promise<void> {
    await expect(
      this.main.getByText(message, { exact: true }).first(),
    ).toBeVisible();
  }

  // --- create ---

  async fillNewProduct(values: NewProductValues): Promise<void> {
    // Labels render with a required-asterisk span (e.g. "Name*"), so exact
    // text matching would fail — substring match on the label text instead.
    await this.page.getByLabel("Name").fill(values.name);
    await this.page.getByLabel("Slug").fill(values.slug);
    await this.page.getByLabel("Category").selectOption({ label: values.categoryLabel });
    await this.page.getByLabel("Price (RWF)").fill(values.price);
    await this.page.getByLabel("Initial stock").fill(values.stock);
  }

  async submitCreate(): Promise<void> {
    await this.page.getByRole("button", { name: "Create product" }).click();
  }

  /** Submit the create form and wait for the redirect back to the list. */
  async createProduct(values: NewProductValues): Promise<void> {
    await this.gotoCreate();
    await this.fillNewProduct(values);
    await this.submitCreate();
    await this.page.waitForURL(/\/admin\/products$/);
  }

  // --- edit ---

  async openEdit(name: string): Promise<void> {
    await this.page.getByRole("link", { name, exact: true }).first().click();
    await expect(this.page).toHaveURL(/\/admin\/products\/[^/]+\/edit$/);
  }

  async rename(name: string): Promise<void> {
    await this.page.getByLabel("Name").fill(name);
    await this.page.getByRole("button", { name: "Save changes" }).click();
    await expect(this.main.getByText("Product saved", { exact: true })).toBeVisible();
  }

  async expectEditHeading(name: string): Promise<void> {
    await expect(
      this.page.getByRole("heading", { level: 1, name: `Edit: ${name}` }),
    ).toBeVisible();
  }

  /** Quick action: Publish / Unpublish (label flips with the product state). */
  async toggleQuickPublish(): Promise<void> {
    const publish = this.page.getByRole("button", { name: "Publish", exact: true });
    const unpublish = this.page.getByRole("button", { name: "Unpublish", exact: true });
    await (await publish.count() ? publish : unpublish).first().click();
  }

  async expectQuickPublishState(published: boolean): Promise<void> {
    const badge = this.page.locator("aside").getByText(published ? "Published" : "Unpublished", {
      exact: true,
    });
    await expect(badge.first()).toBeVisible();
  }

  // --- delete (from the list row action) ---

  async deleteRow(name: string): Promise<void> {
    await this.page.getByRole("button", { name: `Delete ${name}` }).click();
    const dialog = this.page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Delete product", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(this.main.getByText("Product deleted", { exact: true })).toBeVisible();
  }
}