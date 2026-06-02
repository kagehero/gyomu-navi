import { describe, expect, it } from "vitest";
import { formatBytes } from "./image-compression";

describe("formatBytes", () => {
  it("formats byte values across thresholds", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(2_500_000)).toBe("2.38 MB");
  });
});
