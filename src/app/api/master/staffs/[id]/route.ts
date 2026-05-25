import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PoolClient } from "pg";
import { requireAdmin } from "@/lib/auth/guards";
import { getPool } from "@/lib/db/pool";
import { handleRouteError, parseJsonBody } from "@/lib/api/errors";

export const runtime = "nodejs";

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    department_id: z.string().uuid().optional(),
    hourly_rate: z.number().int().min(0).max(1_000_000).optional(),
    client_ids: z.array(z.string().uuid()).min(1).optional(),
    business_line_ids: z.array(z.string().uuid()).min(1).optional(),
    approve: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "更新する項目を指定してください",
  });

type Ctx = { params: Promise<{ id: string }> };

async function loadStaffApprovalState(client: PoolClient, id: string) {
  const { rows } = await client.query<{
    login_approved_at: string | null;
    login_email: string | null;
    department_id: string | null;
    client_count: number;
    business_line_count: number;
  }>(
    `SELECT u.login_approved_at,
            u.email AS login_email,
            s.department_id,
            (SELECT count(*)::int FROM staff_client_assigns sca WHERE sca.staff_id = s.id) AS client_count,
            (SELECT count(*)::int FROM staff_business_line_assigns sbla WHERE sbla.staff_id = s.id) AS business_line_count
       FROM staffs s
       JOIN users u ON u.staff_id = s.id
                     AND u.app_role = 'employee'
                     AND u.deleted_at IS NULL
      WHERE s.id = $1 AND s.deleted_at IS NULL`,
    [id],
  );
  return rows[0] ?? null;
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await requireAdmin(request);
    const { id } = await ctx.params;
    const body = await parseJsonBody(request);
    const v = updateSchema.parse(body);

    await client.query("BEGIN");

    const before = await loadStaffApprovalState(client, id);
    if (!before) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
    }

    const { rows, rowCount } = await client.query<{
      id: string;
      name: string;
      hourly_rate: number;
      department_id: string | null;
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

    const staff = rows[0]!;
    const displayName = v.name ?? staff.name;

    if (v.name !== undefined) {
      await client.query(
        `UPDATE users SET display_name = $1
          WHERE staff_id = $2 AND app_role = 'employee' AND deleted_at IS NULL`,
        [displayName, id],
      );
    }

    if (v.client_ids !== undefined) {
      await client.query(`DELETE FROM staff_client_assigns WHERE staff_id = $1`, [id]);
      if (v.client_ids.length > 0) {
        await client.query(
          `INSERT INTO staff_client_assigns (staff_id, client_id)
           SELECT $1, client_id FROM UNNEST($2::uuid[]) AS client_id`,
          [id, v.client_ids],
        );
      }
    }
    if (v.business_line_ids !== undefined) {
      await client.query(`DELETE FROM staff_business_line_assigns WHERE staff_id = $1`, [id]);
      if (v.business_line_ids.length > 0) {
        await client.query(
          `INSERT INTO staff_business_line_assigns (staff_id, business_line_id)
           SELECT $1, bl_id FROM UNNEST($2::uuid[]) AS bl_id`,
          [id, v.business_line_ids],
        );
      }
    }

    if (v.approve) {
      const after = await loadStaffApprovalState(client, id);
      if (!after) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
      }
      if (after.login_approved_at) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "すでに承認済みです" }, { status: 400 });
      }
      if (!staff.department_id) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "社内部門を設定してください" }, { status: 400 });
      }
      if (after.client_count < 1) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "担当顧客を1件以上設定してください" }, { status: 400 });
      }
      if (after.business_line_count < 1) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "担当部門を1件以上設定してください" }, { status: 400 });
      }
      await client.query(
        `UPDATE users
            SET login_approved_at = now()
          WHERE staff_id = $1 AND app_role = 'employee' AND deleted_at IS NULL`,
        [id],
      );
    }

    const { rows: agg } = await client.query<{
      department_name: string | null;
      client_ids: string[];
      business_line_ids: string[];
      login_email: string | null;
      login_approved_at: string | null;
    }>(
      `SELECT d.name AS department_name,
              COALESCE(
                ARRAY_AGG(DISTINCT sca.client_id) FILTER (WHERE sca.client_id IS NOT NULL),
                ARRAY[]::uuid[]
              ) AS client_ids,
              COALESCE(
                ARRAY_AGG(DISTINCT sbla.business_line_id) FILTER (WHERE sbla.business_line_id IS NOT NULL),
                ARRAY[]::uuid[]
              ) AS business_line_ids,
              MAX(u.email) AS login_email,
              MAX(u.login_approved_at) AS login_approved_at
         FROM staffs s
    LEFT JOIN departments d ON d.id = s.department_id
    LEFT JOIN staff_client_assigns sca ON sca.staff_id = s.id
    LEFT JOIN staff_business_line_assigns sbla ON sbla.staff_id = s.id
    LEFT JOIN users u ON u.staff_id = s.id
                      AND u.app_role = 'employee'
                      AND u.deleted_at IS NULL
        WHERE s.id = $1
     GROUP BY d.name`,
      [id],
    );

    await client.query("COMMIT");
    return NextResponse.json({
      item: { ...staff, ...agg[0]! },
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    return handleRouteError(err);
  } finally {
    client.release();
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await requireAdmin(request);
    const { id } = await ctx.params;

    await client.query("BEGIN");
    const { rowCount } = await client.query(
      `UPDATE staffs SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
    }
    await client.query(
      `UPDATE users SET deleted_at = now()
        WHERE staff_id = $1 AND app_role = 'employee' AND deleted_at IS NULL`,
      [id],
    );
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    return handleRouteError(err);
  } finally {
    client.release();
  }
}
