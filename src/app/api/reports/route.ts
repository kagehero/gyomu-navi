import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { staffScopeWhere } from "@/lib/auth/scope";
import { getPool } from "@/lib/db/pool";
import { handleRouteError, parseJsonBody } from "@/lib/api/errors";

export const runtime = "nodejs";

type ReportRow = {
  id: string;
  staff_id: string;
  staff_name: string;
  site_id: string;
  site_name: string;
  client_id: string;
  client_name: string;
  business_type_id: string;
  business_type_name: string;
  business_line_name: string | null;
  count: number;
  image_url: string | null;
  memo: string | null;
  session_memo: string | null;
  unit_price_excl: number | null;
  unit_price_incl: number | null;
  line_amount_excl: number | null;
  line_amount_incl: number | null;
  reported_at: Date;
  created_at: Date;
  updated_at: Date;
};

function selectReport(userIsAdmin: boolean) {
  const priceCols = userIsAdmin
    ? `, bt.unit_price_excl::float8 AS unit_price_excl
       , bt.unit_price_incl::float8 AS unit_price_incl
       , (r.count * bt.unit_price_excl)::float8 AS line_amount_excl
       , (r.count * bt.unit_price_incl)::float8 AS line_amount_incl`
    : `, NULL::float8 AS unit_price_excl
       , NULL::float8 AS unit_price_incl
       , NULL::float8 AS line_amount_excl
       , NULL::float8 AS line_amount_incl`;

  return `
  SELECT r.id,
         r.staff_id, s.name AS staff_name,
         r.site_id,  st.name AS site_name,
         r.client_id, c.name  AS client_name,
         r.business_type_id, bt.name AS business_type_name,
         bl.name AS business_line_name,
         r.count, r.image_url, r.memo,
         rs.memo AS session_memo
         ${priceCols},
         r.reported_at, r.created_at, r.updated_at
    FROM business_reports r
    JOIN staffs           s  ON s.id  = r.staff_id
    JOIN sites            st ON st.id = r.site_id
    JOIN client_companies c  ON c.id  = r.client_id
    JOIN business_types   bt ON bt.id = r.business_type_id
    LEFT JOIN report_sessions rs ON rs.id = r.session_id
    LEFT JOIN business_lines bl ON bl.id = rs.business_line_id OR bl.id = bt.business_line_id
`;
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 形式で指定してください");

const listQuery = z.object({
  date: isoDate.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  staff_id: z.string().uuid().optional(),
  site_id: z.string().uuid().optional(),
  client_id: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const url = new URL(request.url);
    const q = listQuery.parse({
      date: url.searchParams.get("date") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      staff_id: url.searchParams.get("staff_id") ?? undefined,
      site_id: url.searchParams.get("site_id") ?? undefined,
      client_id: url.searchParams.get("client_id") ?? undefined,
    });

    const params: unknown[] = [];
    const conds: string[] = [];
    if (q.date) {
      params.push(q.date);
      conds.push(`(r.reported_at AT TIME ZONE 'Asia/Tokyo')::date = $${params.length}`);
    } else {
      if (q.from) {
        params.push(q.from);
        conds.push(`(r.reported_at AT TIME ZONE 'Asia/Tokyo')::date >= $${params.length}`);
      }
      if (q.to) {
        params.push(q.to);
        conds.push(`(r.reported_at AT TIME ZONE 'Asia/Tokyo')::date <= $${params.length}`);
      }
    }
    if (q.staff_id) {
      params.push(q.staff_id);
      conds.push(`r.staff_id = $${params.length}`);
    }
    if (q.site_id) {
      params.push(q.site_id);
      conds.push(`r.site_id = $${params.length}`);
    }
    if (q.client_id) {
      params.push(q.client_id);
      conds.push(`r.client_id = $${params.length}`);
    }
    const scope = staffScopeWhere(user, "r.staff_id", params.length);
    params.push(...scope.params);

    const where = [conds.join(" AND "), scope.sql.replace(/^ AND /, "")]
      .filter(Boolean)
      .join(" AND ");

    const { rows } = await getPool().query<ReportRow>(
      `${selectReport(user.role === "admin")}
        ${where ? "WHERE " + where : ""}
        ORDER BY r.reported_at DESC
        LIMIT 500`,
      params,
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}

const createSchema = z.object({
  site_id: z.string().uuid("現場を選んでください"),
  business_type_id: z.string().uuid("業務内容を選んでください"),
  count: z.number().int().min(0).max(100_000),
  memo: z.string().max(2000).optional().nullable(),
  image_url: z.string().url().max(2000).optional().nullable(),
  reported_at: z.string().datetime({ offset: true }).optional(),
  /** Admin can submit on behalf of another staff member. */
  staff_id: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (user.role === "manager") {
      return NextResponse.json(
        { error: "マネージャは報告を作成できません" },
        { status: 403 },
      );
    }
    const body = await parseJsonBody(request);
    const v = createSchema.parse(body);

    let staffId: string;
    if (user.role === "admin") {
      if (!v.staff_id) {
        return NextResponse.json(
          { error: "staff_id が必要です", code: "validation" },
          { status: 400 },
        );
      }
      staffId = v.staff_id;
    } else {
      // employee
      if (!user.staffId) {
        return NextResponse.json(
          { error: "スタッフプロフィールが連携されていません" },
          { status: 403 },
        );
      }
      staffId = user.staffId;
    }

    const pool = getPool();

    // Resolve site → client_id and validate employee assignment + business_type.client_id match
    const { rows: siteRows } = await pool.query<{
      client_id: string;
      assigned: boolean;
    }>(
      `SELECT s.client_id,
              CASE WHEN $2::uuid IS NULL THEN true
                   ELSE EXISTS (
                     SELECT 1 FROM staff_client_assigns sca
                      WHERE sca.client_id = s.client_id AND sca.staff_id = $2
                   )
              END AS assigned
         FROM sites s
        WHERE s.id = $1 AND s.deleted_at IS NULL`,
      [v.site_id, user.role === "employee" ? user.staffId : null],
    );
    const site = siteRows[0];
    if (!site) {
      return NextResponse.json({ error: "現場が見つかりません" }, { status: 404 });
    }
    if (!site.assigned) {
      return NextResponse.json(
        { error: "この現場には配属されていません" },
        { status: 403 },
      );
    }

    const { rows: btRows } = await pool.query<{ client_id: string }>(
      `SELECT client_id FROM business_types WHERE id = $1 AND deleted_at IS NULL`,
      [v.business_type_id],
    );
    if (!btRows[0]) {
      return NextResponse.json({ error: "業務内容が見つかりません" }, { status: 404 });
    }
    if (btRows[0].client_id !== site.client_id) {
      return NextResponse.json(
        { error: "選択した業務内容はこの現場の顧客では使えません" },
        { status: 400 },
      );
    }

    const reportedAt = v.reported_at ?? new Date().toISOString();

    const { rows: insertedRows } = await pool.query<{ id: string }>(
      `INSERT INTO business_reports
         (staff_id, site_id, client_id, business_type_id, count, image_url, memo, reported_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        staffId, v.site_id, site.client_id, v.business_type_id,
        v.count, v.image_url ?? null, v.memo ?? null, reportedAt,
      ],
    );
    const { rows } = await pool.query<ReportRow>(
      `${selectReport(user.role === "admin")} WHERE r.id = $1`,
      [insertedRows[0]!.id],
    );
    return NextResponse.json({ item: rows[0] }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
