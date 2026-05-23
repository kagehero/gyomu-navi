import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db/pool";
import { handleRouteError, parseJsonBody } from "@/lib/api/errors";
import { visibleSitesClause } from "@/lib/board";

export const runtime = "nodejs";

type BoardRow = {
  id: string;
  site_id: string;
  site_name: string;
  author_user_id: string;
  author_display_name: string;
  title: string;
  body: string;
  pinned: boolean;
  created_at: Date;
  updated_at: Date;
};

const SELECT_BOARD = `
  SELECT bp.id, bp.site_id, st.name AS site_name,
         bp.author_user_id, au.display_name AS author_display_name,
         bp.title, bp.body, bp.pinned,
         bp.created_at, bp.updated_at
    FROM board_posts bp
    JOIN sites st ON st.id = bp.site_id
    JOIN users au ON au.id = bp.author_user_id
`;

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const url = new URL(request.url);
    const siteIdParam = url.searchParams.get("site_id");

    const params: unknown[] = [];
    const conds: string[] = [];
    if (siteIdParam) {
      params.push(siteIdParam);
      conds.push(`bp.site_id = $${params.length}`);
    }
    const scope = visibleSitesClause(user, "bp.site_id", params.length);
    params.push(...scope.params);

    const where = [conds.join(" AND "), scope.sql.replace(/^ AND /, "")]
      .filter(Boolean)
      .join(" AND ");

    const { rows } = await getPool().query<BoardRow>(
      `${SELECT_BOARD}
        ${where ? "WHERE " + where : ""}
        ORDER BY bp.pinned DESC, bp.created_at DESC
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
  title: z.string().trim().min(1).max(255),
  body: z.string().trim().min(1).max(10_000),
  pinned: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await parseJsonBody(request);
    const v = createSchema.parse(body);

    // The user must be able to interact with the target site.
    if (user.role !== "admin") {
      const scope = visibleSitesClause(user, "id", 1);
      const { rows } = await getPool().query<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM sites WHERE id = $1 AND deleted_at IS NULL ${scope.sql}
         ) AS exists`,
        [v.site_id, ...scope.params],
      );
      if (!rows[0]?.exists) {
        return NextResponse.json(
          { error: "この現場には投稿できません" },
          { status: 403 },
        );
      }
    }

    const { rows: insertedRows } = await getPool().query<{ id: string }>(
      `INSERT INTO board_posts (site_id, author_user_id, title, body, pinned)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [v.site_id, user.id, v.title, v.body, v.pinned],
    );
    const { rows } = await getPool().query<BoardRow>(
      `${SELECT_BOARD} WHERE bp.id = $1`,
      [insertedRows[0]!.id],
    );
    return NextResponse.json({ item: rows[0] }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
