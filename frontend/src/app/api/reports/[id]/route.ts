import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { del } from "@vercel/blob";
import { requireUser } from "@/lib/auth/guards";
import { canAccessStaff } from "@/lib/auth/scope";
import { getPool } from "@/lib/db/pool";
import { handleRouteError, parseJsonBody } from "@/lib/api/errors";

export const runtime = "nodejs";

const SELECT_REPORT = `
  SELECT r.id,
         r.staff_id, s.name AS staff_name,
         r.site_id,  st.name AS site_name,
         r.client_id, c.name  AS client_name,
         r.business_type_id, bt.name AS business_type_name,
         r.count, r.image_url, r.memo,
         r.reported_at, r.created_at, r.updated_at
    FROM business_reports r
    JOIN staffs           s  ON s.id  = r.staff_id
    JOIN sites            st ON st.id = r.site_id
    JOIN client_companies c  ON c.id  = r.client_id
    JOIN business_types   bt ON bt.id = r.business_type_id
`;

type Ctx = { params: Promise<{ id: string }> };

async function loadReport(id: string) {
  const { rows } = await getPool().query<{
    id: string;
    staff_id: string;
    reported_at: Date;
  }>(`SELECT id, staff_id, reported_at FROM business_reports WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser(request);
    const { id } = await ctx.params;
    const meta = await loadReport(id);
    if (!meta) {
      return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
    }
    if (!(await canAccessStaff(user, meta.staff_id))) {
      return NextResponse.json({ error: "閲覧権限がありません" }, { status: 403 });
    }
    const { rows } = await getPool().query(`${SELECT_REPORT} WHERE r.id = $1`, [id]);
    return NextResponse.json({ item: rows[0] });
  } catch (err) {
    return handleRouteError(err);
  }
}

const updateSchema = z
  .object({
    site_id: z.string().uuid().optional(),
    business_type_id: z.string().uuid().optional(),
    count: z.number().int().min(0).max(100_000).optional(),
    memo: z.string().max(2000).nullable().optional(),
    image_url: z.string().url().max(2000).nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "更新する項目を指定してください",
  });

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser(request);
    const { id } = await ctx.params;
    const meta = await loadReport(id);
    if (!meta) {
      return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
    }

    // Authorisation: admin always; employee/manager own reports (any date).
    if (user.role !== "admin") {
      if (user.role !== "employee" || user.staffId !== meta.staff_id) {
        return NextResponse.json({ error: "編集権限がありません" }, { status: 403 });
      }
    }

    const body = await parseJsonBody(request);
    const v = updateSchema.parse(body);

    // If site_id changes, re-resolve client_id and validate business_type_id alignment.
    let newClientId: string | undefined;
    if (v.site_id !== undefined || v.business_type_id !== undefined) {
      const { rows: siteRows } = await getPool().query<{ client_id: string }>(
        `SELECT s.client_id
           FROM sites s
           JOIN business_reports r ON r.id = $1
          WHERE s.id = COALESCE($2, r.site_id) AND s.deleted_at IS NULL`,
        [id, v.site_id ?? null],
      );
      if (!siteRows[0]) {
        return NextResponse.json({ error: "現場が見つかりません" }, { status: 404 });
      }
      newClientId = siteRows[0].client_id;

      if (v.business_type_id) {
        const { rows: btRows } = await getPool().query<{ client_id: string }>(
          `SELECT client_id FROM business_types WHERE id = $1 AND deleted_at IS NULL`,
          [v.business_type_id],
        );
        if (!btRows[0]) {
          return NextResponse.json({ error: "業務内容が見つかりません" }, { status: 404 });
        }
        if (btRows[0].client_id !== newClientId) {
          return NextResponse.json(
            { error: "選択した業務内容はこの現場の顧客では使えません" },
            { status: 400 },
          );
        }
      }
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    const add = (col: string, val: unknown) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };
    if (v.site_id !== undefined) {
      add("site_id", v.site_id);
      add("client_id", newClientId!); // keep denormalised client_id in sync
    }
    if (v.business_type_id !== undefined) add("business_type_id", v.business_type_id);
    if (v.count !== undefined) add("count", v.count);
    if (v.memo !== undefined) add("memo", v.memo);
    if (v.image_url !== undefined) add("image_url", v.image_url);
    params.push(id);
    await getPool().query(
      `UPDATE business_reports SET ${sets.join(", ")} WHERE id = $${params.length}`,
      params,
    );

    const { rows } = await getPool().query(`${SELECT_REPORT} WHERE r.id = $1`, [id]);
    return NextResponse.json({ item: rows[0] });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser(request);
    const { id } = await ctx.params;

    const meta = await loadReport(id);
    if (!meta) {
      return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
    }

    if (user.role === "employee") {
      if (user.staffId !== meta.staff_id) {
        return NextResponse.json({ error: "削除権限がありません" }, { status: 403 });
      }
    } else if (user.role !== "admin") {
      return NextResponse.json({ error: "削除権限がありません" }, { status: 403 });
    }

    // Take the image_url before deleting so we can clean up the blob after.
    // We don't make the blob delete fail the request — the row is the source
    // of truth; an orphaned blob is an acceptable loss compared to a stuck
    // report row.
    const { rows } = await getPool().query<{ image_url: string | null }>(
      `SELECT image_url FROM business_reports WHERE id = $1`,
      [id],
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
    }
    const imageUrl = rows[0]!.image_url;

    await getPool().query(`DELETE FROM business_reports WHERE id = $1`, [id]);

    if (imageUrl && process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        await del(imageUrl);
      } catch (e) {
        console.error("[reports.delete] blob del failed (orphan ok):", e);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
