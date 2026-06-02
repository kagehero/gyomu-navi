import { describe, expect, it } from "vitest";
import { jstWorkDate } from "./dates";

describe("jstWorkDate", () => {
  it("returns the JST date for a UTC instant", () => {
    // 2026-05-22 23:00 UTC = 2026-05-23 08:00 JST → 2026-05-23
    expect(jstWorkDate(new Date("2026-05-22T23:00:00Z"))).toBe("2026-05-23");
  });

  it("does not roll the day for early-morning JST that is still yesterday UTC", () => {
    // 2026-05-23 00:30 JST = 2026-05-22 15:30 UTC → 2026-05-23
    expect(jstWorkDate(new Date("2026-05-22T15:30:00Z"))).toBe("2026-05-23");
  });

  it("uses now() when no argument is given", () => {
    const v = jstWorkDate();
    expect(v).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("handles the JST day boundary exactly", () => {
    // 2026-01-01 00:00 JST = 2025-12-31 15:00 UTC
    expect(jstWorkDate(new Date("2025-12-31T15:00:00Z"))).toBe("2026-01-01");
    // …and one second earlier is still 2025-12-31 JST
    expect(jstWorkDate(new Date("2025-12-31T14:59:59Z"))).toBe("2025-12-31");
  });
});
