import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("vitest harness", () => {
  it("runs assertions", () => {
    expect(1 + 1).toBe(2);
  });

  it("resolves the @/ path alias to src/", () => {
    // Home is the default-exported component from src/app/page.tsx.
    // A pass here proves the "@/" -> ./src alias in vitest.config.ts works.
    expect(typeof Home).toBe("function");
  });
});