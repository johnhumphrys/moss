import { describe, expect, it } from "vitest";
import { formatBytes, formatDate } from "./formatters";

describe("formatters", () => {
  it("formats byte sizes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
  });

  it("formats dates into readable strings", () => {
    const value = formatDate("2026-05-04T10:00:00.000Z");
    expect(value).toMatch(/2026|May/);
  });
});
