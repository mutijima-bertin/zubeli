import { expect, test } from "@playwright/test";
import { uniqueProductSlug } from "../data";
import { OWNER_SESSION_PATH } from "../admin-session";
import { AdminProductsPage, type NewProductValues } from "../pages/AdminProductsPage";

// Owner session bootstrapped once per run in global-setup (login is
// rate-limited: 10/15min per email) — see e2e/admin-session.ts.
test.use({ storageState: OWNER_SESSION_PATH });

/**
 * Journey: admin product CRUD (owner: inventory-agent).
 * - Create: server-side field errors first, then a valid product lands back
 *   on the list with its Unpublished badge (create default).
 * - Edit: rename + publish lifecycle via the quick actions.
 * - Delete: soft delete via the list row action with the confirm dialog.
 * Every spec creates its own product (unique slug) — no shared rows.
 */
test.describe("Admin — products", () => {
  test("create product — validation errors, then success on the list", async ({ page }) => {
    const products = new AdminProductsPage(page);
    await products.gotoAsOwner();
    await products.gotoCreate();

    // Empty submit -> server-side zod fieldErrors under the inputs.
    await products.submitCreate();
    await products.expectFieldError("Name is required");
    // The Slug fieldError combines the required + format messages in one alert.
    await products.expectFieldError(/Slug is required/);
    await products.expectFieldError("Category is required");
    await products.expectFieldError("Price must be a positive integer");
    await expect(page).toHaveURL(/\/admin\/products\/new$/);

    // Valid input -> redirect to the list, new row on top (createdAt desc).
    const values: NewProductValues = {
      name: `E2E Drill ${Date.now()}`,
      slug: uniqueProductSlug("e2e-drill"),
      categoryLabel: "Power Tools",
      price: "25000",
      stock: "10",
    };
    await products.fillNewProduct(values);
    await products.submitCreate();
    await page.waitForURL(/\/admin\/products$/);

    await products.search(values.name);
    await products.expectProductVisible(values.name);
    // Create defaults: unpublished, out of the storefront until published.
    await products.expectRowBadge(values.name, "Unpublished");
  });

  test("edit product — rename saves; publish toggle flips the badge", async ({ page }) => {
    const products = new AdminProductsPage(page);
    await products.gotoAsOwner();

    const values: NewProductValues = {
      name: `E2E Hammer ${Date.now()}`,
      slug: uniqueProductSlug("e2e-hammer"),
      categoryLabel: "Hand Tools",
      price: "12500",
      stock: "5",
    };
    await products.createProduct(values);
    await products.search(values.name);

    // Rename through the shared form -> success alert + updated heading.
    const renamed = `${values.name} Pro`;
    await products.openEdit(values.name);
    await products.rename(renamed);
    await products.expectEditHeading(renamed);

    // Quick action publish lifecycle: Published -> Unpublished -> Published.
    await products.expectQuickPublishState(false);
    await products.toggleQuickPublish();
    await products.expectQuickPublishState(true);
    await products.toggleQuickPublish();
    await products.expectQuickPublishState(false);
    await products.toggleQuickPublish();
    await products.expectQuickPublishState(true);
  });

  test("delete product with confirm — row disappears from the list", async ({ page }) => {
    const products = new AdminProductsPage(page);
    await products.gotoAsOwner();

    const values: NewProductValues = {
      name: `E2E Saw ${Date.now()}`,
      slug: uniqueProductSlug("e2e-saw"),
      categoryLabel: "Power Tools",
      price: "99000",
      stock: "3",
    };
    await products.createProduct(values);
    await products.search(values.name);
    await products.expectProductVisible(values.name);

    // Soft delete behind the confirm dialog -> row gone + success notice.
    await products.deleteRow(values.name);
    await products.expectProductGone(values.name);
  });
});