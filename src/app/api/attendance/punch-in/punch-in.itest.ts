import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST } from "./route";
import { setupFixtures, type Fixtures } from "@/test/fixtures";
import { closePool } from "@/test/db";
import { postAs } from "@/test/auth";
import { getPool } from "@/lib/db/pool";

let fx: Fixtures;
let employee: { id: string; email: string };
let admin: { id: string; email: string };

beforeAll(async () => {
  fx = await setupFixtures();
  employee = { id: fx.ids.userEmployee, email: fx.emails.employee };
  admin = { id: fx.ids.userAdmin, email: fx.emails.admin };
});

afterAll(async () => {
  await closePool();
});

const PUNCH_IN_URL = "http://t/api/attendance/punch-in";

describe("/api/attendance/punch-in", () => {
  it("admins are not allowed to punch (403)", async () => {
    const res = await POST(
      postAs(admin, PUNCH_IN_URL, {
        site_id: fx.ids.siteAlpha,
        latitude: 35.6896,
        longitude: 139.6917,
      }),
    );
    expect(res.status).toBe(403);
  });

  it("rejects punch-in to a site under an unassigned client (siteGamma)", async () => {
    const res = await POST(
      postAs(employee, PUNCH_IN_URL, {
        site_id: fx.ids.siteGamma,
        latitude: 35.67,
        longitude: 139.71,
      }),
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/配属/);
  });

  it("rejects punch-in when GPS is outside the radius", async () => {
    // Alpha 拠点 is at 35.6896,139.6917 with radius_m=100. Bump latitude
    // by 0.01° ≈ 1.1km — well outside.
    const res = await POST(
      postAs(employee, PUNCH_IN_URL, {
        site_id: fx.ids.siteAlpha,
        latitude: 35.7000,
        longitude: 139.6917,
      }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("out_of_range");
    expect(json.error).toMatch(/離れています/);
  });

  it("succeeds at the site centre and inserts a working row", async () => {
    const res = await POST(
      postAs(employee, PUNCH_IN_URL, {
        site_id: fx.ids.siteAlpha,
        latitude: 35.6896,
        longitude: 139.6917,
      }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.item.status).toBe("working");
    expect(json.item.staff_id).toBe(fx.ids.staffSato);
    expect(json.item.punch_in_lat).toBeCloseTo(35.6896, 4);
  });

  it("rejects a second punch-in on the same JST day with 409", async () => {
    const res = await POST(
      postAs(employee, PUNCH_IN_URL, {
        site_id: fx.ids.siteAlpha,
        latitude: 35.6896,
        longitude: 139.6917,
      }),
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatch(/既に出勤打刻/);
  });

  it("the working row is visible via direct query (consistency check)", async () => {
    const { rows } = await getPool().query<{ c: number }>(
      `SELECT count(*)::int AS c FROM attendance_logs
        WHERE staff_id = $1 AND status = 'working'`,
      [fx.ids.staffSato],
    );
    expect(rows[0]!.c).toBe(1);
  });
});
