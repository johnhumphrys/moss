import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

class IntersectionObserverMock {
  observe() {}
  disconnect() {}
  unobserve() {}
}

Object.defineProperty(globalThis, "IntersectionObserver", {
  writable: true,
  value: IntersectionObserverMock
});

afterEach(() => {
  cleanup();
});
