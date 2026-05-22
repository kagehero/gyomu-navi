import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { getPool } from "@/lib/db/pool";
import { handleRouteError, parseJsonBody } from "@/lib/api/errors";

export const runtime = "nodejs";

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    department_id: z.string().uuid().optional(),
    hourly_rate: z.number().int().min(0).max(1_000_000).optional(),
    site_ids: z.array(z.string().uuid()).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "更新する項目を指定してください",
  });

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await requireAdmin(request);
    const { id } = await ctx.params;
    const body = await parseJsonBody(request);
    const v = updateSchema.parse(body);

    await client.query("BEGIN");

    const { rows, rowCount } = await client.query<{
      id: string;
      name: string;
      hourly_rate: number;
      department_id: string;
    }>(
      `UPDATE staffs
          SET name          = COALESCE($1, name),
              department_id = COALESCE($2, department_id),
              hourly_rate   = COALESCE($3, hourly_rate)
        WHERE id = $4 AND deleted_at IS NULL
        RETURNING id, name, department_id, hourly_rate`,
      [v.name ?? null, v.department_id ?? null, v.hourly_rate ?? null, id],
    );
    if (rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
    }

    if (v.site_ids !== undefined) {
      // Replace assignment set wholesale: simplest correct semantics for PATCH
      // when the caller explicitly sends the full intended set.
      await client.query(`DELETE FROM staff_site_assigns WHERE staff_id = $1`, [id]);
      if (v.site_ids.length > 0) {
        await client.query(
          `INSERT INTO staff_site_assigns (staff_id, site_id)
           SELECT $1, site_id FROM UNNEST($2::uuid[]) AS site_id`,
          [id, v.site_ids],
        );
      }
    }

    const { rows: agg } = await client.query<{
      department_name: string;
      site_ids: string[];
    }>(
      `SELECT d.name AS department_name,
              COALESCE(
                ARRAY_AGG(ssa.site_id) FILTER (WHERE ssa.site_id IS NOT NULL),
                ARRAY[]::uuid[]
              ) AS site_ids
         FROM staffs s
         JOIN departments d ON d.id = s.department_id
    LEFT JOIN staff_site_assigns ssa ON ssa.staff_id = s.id
        WHERE s.id = $1
     GROUP BY d.name`,
      [id],
    );

    await client.query("COMMIT");
    return NextResponse.json({
      item: { ...rows[0]!, ...agg[0]! },
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    return handleRouteError(err);
  } finally {
    client.release();
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin(request);
    const { id } = await ctx.params;
    const { rowCount } = await getPool().query(
      `UPDATE staffs
          SET deleted_at = now()
        WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (rowCount === 0) {
      return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
