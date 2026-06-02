import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db/pool";
import { handleRouteError, parseJsonBody } from "@/lib/api/errors";
import { SELECT_NOTICE_PREFIX, visibilityClause, type NoticeRow } from "@/lib/notices";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);

    const vis = visibilityClause(user, 1);
    const params: unknown[] = [user.id, ...vis.params];

    const { rows } = await getPool().query<NoticeRow>(
      `${SELECT_NOTICE_PREFIX}
        WHERE ${vis.sql}
        ORDER BY n.created_at DESC
        LIMIT 500`,
      params,
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}

const createSchema = z
  .object({
    target_type: z.enum(["all", "department", "individual"]),
    target_department_id: z.string().uuid().optional().nullable(),
    target_user_id: z.string().uuid().optional().nullable(),
    client_id: z.string().uuid().optional().nullable(),
    title: z.string().trim().min(1).max(255),
    body: z.string().trim().min(1).max(10_000),
  })
  .refine(
    (v) =>
      (v.target_type === "all" && !v.target_department_id && !v.target_user_id) ||
      (v.target_type === "department" && v.target_department_id && !v.target_user_id) ||
      (v.target_type === "individual" && v.target_user_id && !v.target_department_id),
    { message: "target_type と対象IDが整合していません" },
  );

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (user.role === "employee") {
      return NextResponse.json(
        { error: "通知を作成する権限がありません" },
        { status: 403 },
      );
    }
    const body = await parseJsonBody(request);
    const v = createSchema.parse(body);

    if (user.role === "manager") {
      if (v.target_type === "all") {
        return NextResponse.json(
          { error: "全社向けはマネージャから送信できません" },
          { status: 403 },
        );
      }
      if (v.target_type === "department" && v.target_department_id !== user.departmentId) {
        return NextResponse.json(
          { error: "自部門以外への通知は送信できません" },
          { status: 403 },
        );
      }
      if (v.target_type === "individual" && v.target_user_id) {
        const { rows } = await getPool().query<{ in_dept: boolean }>(
          `SELECT EXISTS (
             SELECT 1 FROM users u
              LEFT JOIN staffs st ON st.id = u.staff_id
             WHERE u.id = $1
               AND COALESCE(u.department_id, st.department_id) = $2
           ) AS in_dept`,
          [v.target_user_id, user.departmentId],
        );
        if (!rows[0]?.in_dept) {
          return NextResponse.json(
            { error: "自部門以外のユーザーには送信できません" },
            { status: 403 },
          );
        }
      }
    }

    const { rows: insertedRows } = await getPool().query<{ id: string }>(
      `INSERT INTO notices
         (from_user_id, target_type, target_department_id, target_user_id,
          client_id, title, body)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        user.id,
        v.target_type,
        v.target_department_id ?? null,
        v.target_user_id ?? null,
        v.client_id ?? null,
        v.title,
        v.body,
      ],
    );
    const newId = insertedRows[0]!.id;
    const { rows } = await getPool().query<NoticeRow>(
      `${SELECT_NOTICE_PREFIX} WHERE n.id = $2`,
      [user.id, newId],
    );
    return NextResponse.json({ item: rows[0] }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
