import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET, POST } from "./route";
import { setupFixtures, type Fixtures } from "@/test/fixtures";
import { closePool } from "@/test/db";
import { getAs, postAs } from "@/test/auth";
import { getPool } from "@/lib/db/pool";

let fx: Fixtures;
let admin: { id: string; email: string };
let manager: { id: string; email: string };
let employee: { id: string; email: string };

beforeAll(async () => {
  fx = await setupFixtures();
  admin = { id: fx.ids.userAdmin, email: fx.emails.admin };
  manager = { id: fx.ids.userManager, email: fx.emails.manager };
  employee = { id: fx.ids.userEmployee, email: fx.emails.employee };

  // Seed three notices that exercise each target_type. We bypass the API for
  // this so the test focuses on the visibility logic, not the writer rules.
  const pool = getPool();
  await pool.query(
    `INSERT INTO notices (from_user_id, target_type, title, body)
     VALUES ($1, 'all', 'broadcast', 'to everyone')`,
    [fx.ids.userAdmin],
  );
  await pool.query(
    `INSERT INTO notices (from_user_id, target_type, target_department_id, title, body)
     VALUES ($1, 'department', $2, 'dept-cleaning', 'to cleaning dept')`,
    [fx.ids.userAdmin, fx.ids.deptCleaning],
  );
  await pool.query(
    `INSERT INTO notices (from_user_id, target_type, target_department_id, title, body)
     VALUES ($1, 'department', $2, 'dept-security', 'to security dept')`,
    [fx.ids.userAdmin, fx.ids.deptSecurity],
  );
});

afterAll(async () => {
  await closePool();
});

const NOTICES_URL = "http://t/api/notices";

describe("/api/notices visibility", () => {
  it("admin sees every notice", async () => {
    const res = await GET(getAs(admin, NOTICES_URL));
    expect(res.status).toBe(200);
    const json = await res.json();
    const titles = json.items.map((n: { title: string }) => n.title).sort();
    expect(titles).toEqual(["broadcast", "dept-cleaning", "dept-security"]);
  });

  it("manager (cleaning dept) sees broadcast + own dept, not other dept", async () => {
    const res = await GET(getAs(manager, NOTICES_URL));
    expect(res.status).toBe(200);
    const titles = (await res.json()).items
      .map((n: { title: string }) => n.title)
      .sort();
    expect(titles).toEqual(["broadcast", "dept-cleaning"]);
  });

  it("employee (cleaning dept via staff) sees broadcast + own dept", async () => {
    const res = await GET(getAs(employee, NOTICES_URL));
    const titles = (await res.json()).items
      .map((n: { title: string }) => n.title)
      .sort();
    expect(titles).toEqual(["broadcast", "dept-cleaning"]);
  });
});

describe("/api/notices write rules", () => {
  it("employee cannot create notices (403)", async () => {
    const res = await POST(
      postAs(employee, NOTICES_URL, {
        target_type: "all",
        title: "x",
        body: "y",
      }),
    );
    expect(res.status).toBe(403);
  });

  it("manager cannot broadcast to all (403)", async () => {
    const res = await POST(
      postAs(manager, NOTICES_URL, {
        target_type: "all",
        title: "x",
        body: "y",
      }),
    );
    expect(res.status).toBe(403);
  });

  it("manager can post to their own department (201)", async () => {
    const res = await POST(
      postAs(manager, NOTICES_URL, {
        target_type: "department",
        target_department_id: fx.ids.deptCleaning,
        title: "manager-to-cleaning",
        body: "x",
      }),
    );
    expect(res.status).toBe(201);
  });

  it("manager cannot post to a different department (403)", async () => {
    const res = await POST(
      postAs(manager, NOTICES_URL, {
        target_type: "department",
        target_department_id: fx.ids.deptSecurity,
        title: "manager-to-security",
        body: "x",
      }),
    );
    expect(res.status).toBe(403);
  });

  it("validates target_type + id consistency (department w/o id → 400)", async () => {
    const res = await POST(
      postAs(admin, NOTICES_URL, {
        target_type: "department",
        title: "x",
        body: "y",
      }),
    );
    expect(res.status).toBe(400);
  });
});
