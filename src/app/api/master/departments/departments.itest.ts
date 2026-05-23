import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET, POST } from "./route";
import { DELETE, PATCH } from "./[id]/route";
import { setupFixtures, type Fixtures } from "@/test/fixtures";
import { closePool } from "@/test/db";
import { buildRequest, deleteAs, getAs, patchAs, postAs } from "@/test/auth";

let fx: Fixtures;
let admin: { id: string; email: string };
let manager: { id: string; email: string };
let employee: { id: string; email: string };

beforeAll(async () => {
  fx = await setupFixtures();
  admin = { id: fx.ids.userAdmin, email: fx.emails.admin };
  manager = { id: fx.ids.userManager, email: fx.emails.manager };
  employee = { id: fx.ids.userEmployee, email: fx.emails.employee };
});

afterAll(async () => {
  await closePool();
});

describe("/api/master/departments", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await GET(buildRequest({ url: "http://t/api/master/departments" }));
    expect(res.status).toBe(401);
  });

  it("rejects non-admins (employee) with 403", async () => {
    const res = await GET(getAs(employee, "http://t/api/master/departments"));
    expect(res.status).toBe(403);
  });

  it("rejects non-admins (manager) with 403", async () => {
    const res = await GET(getAs(manager, "http://t/api/master/departments"));
    expect(res.status).toBe(403);
  });

  it("returns live departments for admin (sorted by name)", async () => {
    const res = await GET(getAs(admin, "http://t/api/master/departments"));
    expect(res.status).toBe(200);
    const json = await res.json();
    const names = json.items.map((d: { name: string }) => d.name);
    expect(names).toEqual(["清掃部門", "警備部門"]);
  });

  it("validates POST body (empty name → 400)", async () => {
    const res = await POST(postAs(admin, "http://t/api/master/departments", { name: "" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("validation");
  });

  it("creates → updates → soft-deletes a department", async () => {
    // create
    const createRes = await POST(
      postAs(admin, "http://t/api/master/departments", { name: "テスト部門" }),
    );
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()).item;
    expect(created.name).toBe("テスト部門");

    // update
    const patchRes = await PATCH(
      patchAs(admin, `http://t/api/master/departments/${created.id}`, {
        name: "テスト部門-更新",
      }),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(patchRes.status).toBe(200);
    expect((await patchRes.json()).item.name).toBe("テスト部門-更新");

    // delete
    const delRes = await DELETE(
      deleteAs(admin, `http://t/api/master/departments/${created.id}`),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(delRes.status).toBe(200);

    // second delete → 404 (soft-deleted row is invisible)
    const delAgain = await DELETE(
      deleteAs(admin, `http://t/api/master/departments/${created.id}`),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(delAgain.status).toBe(404);
  });

  it("returns 409 on duplicate live name", async () => {
    // 清掃部門 already exists in fixtures
    const res = await POST(
      postAs(admin, "http://t/api/master/departments", { name: "清掃部門" }),
    );
    expect(res.status).toBe(409);
  });
});
