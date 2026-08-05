import "@testing-library/jest-dom/vitest";

// With `globals: true` in vitest.config.ts, @testing-library/react auto-cleans
// the DOM after each test (it registers its own afterEach when it detects a
// global afterEach hook). No explicit cleanup() call needed here.