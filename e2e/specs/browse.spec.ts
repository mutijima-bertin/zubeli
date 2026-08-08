import { test } from "@playwright/test";
import {
  ANGLE_GRINDER,
  CLAW_HAMMER,
  SAFETY_VEST,
  UNPUBLISHED_PRODUCT,
} from "../data";
import { CatalogPage } from "../pages/CatalogPage";
import { HomePage } from "../pages/HomePage";
import { ProductPage } from "../pages/ProductPage";

/**
 * Journey: browse. Home → catalog → search → category filter → product
 * detail, plus the out-of-stock product state (critical state).
 */
test.describe("Browse", () => {
  test("home → catalog → search → filter → product detail", async ({ page }) => {
    // Home: hero + a featured seeded product with an RWF price.
    const home = new HomePage(page);
    await home.goto();
    await home.expectHeroVisible();
    await home.expectFeaturedProduct(ANGLE_GRINDER.name);
    await home.expectPrice(ANGLE_GRINDER.priceRwf);

    // Catalog: seeded content, RWF prices, pagination; unpublished product
    // must never appear.
    const catalog = new CatalogPage(page);
    await catalog.goto();
    await catalog.expectHeading("All tools");
    await catalog.expectResultCount(/20 products/);
    await catalog.expectLoadMore();
    await catalog.expectProductHidden(UNPUBLISHED_PRODUCT);

    // Search q=hammer → Claw Hammer 500g.
    await catalog.search("hammer");
    await catalog.expectHeading("Search results");
    await catalog.expectProduct(CLAW_HAMMER.name);
    await catalog.expectPrice(CLAW_HAMMER.priceRwf);

    // Category filter preserves the search (Hand Tools + hammer → same hit).
    await catalog.filterCategory("Hand Tools");
    await catalog.expectHeading("Hand Tools");
    await catalog.expectProduct(CLAW_HAMMER.name);

    // Product detail: title, price, live stock badge.
    await catalog.openProduct(CLAW_HAMMER.name);
    const product = new ProductPage(page);
    await product.expectTitle(CLAW_HAMMER.name);
    await product.expectPrice(CLAW_HAMMER.priceRwf);
    await product.expectStockBadge("In stock");
  });

  test("out-of-stock product shows the unavailable state", async ({ page }) => {
    const product = new ProductPage(page);
    await product.goto(SAFETY_VEST.slug);
    await product.expectTitle(SAFETY_VEST.name);
    await product.expectPrice(SAFETY_VEST.priceRwf);
    await product.expectOutOfStock();
    await product.expectUnavailableNotice();
  });
});
