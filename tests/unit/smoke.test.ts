import { describe, expect, it } from "vitest";
// Home is the storefront homepage slot — Phase A relocated the scaffold
// page from src/app/page.tsx into the (store) route group (build plan §0).
import Home from "@/app/(store)/page";

describe("vitest harness", () => {
  it("runs assertions", () => {
    expect(1 + 1).toBe(2);
  });

  it("resolves the @/ path alias to src/", () => {
    // A pass here proves the "@/" -> ./src alias in vitest.config.ts works.
    expect(typeof Home).toBe("function");
  });
});