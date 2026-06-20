import { describe, expect, it } from "vitest";
import { haversineMeters } from "./geo";

describe("haversineMeters", () => {
  it("returns 0 for identical points", () => {
    expect(haversineMeters(35.6896, 139.6917, 35.6896, 139.6917)).toBe(0);
  });

  it("matches a known short distance within tolerance", () => {
    // 新宿パークタワー → 渋谷スクランブルスクエア ≈ 3.6km
    const m = haversineMeters(35.6896, 139.6917, 35.658, 139.7016);
    expect(m).toBeGreaterThan(3_000);
    expect(m).toBeLessThan(4_000);
  });

  it("is symmetric: d(A,B) === d(B,A)", () => {
    const d1 = haversineMeters(35.6896, 139.6917, 35.658, 139.7016);
    const d2 = haversineMeters(35.658, 139.7016, 35.6896, 139.6917);
    expect(d1).toBeCloseTo(d2, 5);
  });

  it("handles antipodal points without NaN", () => {
    const d = haversineMeters(0, 0, 0, 180);
    expect(Number.isFinite(d)).toBe(true);
    expect(d).toBeCloseTo(Math.PI * 6_371_000, -3);
  });
});
