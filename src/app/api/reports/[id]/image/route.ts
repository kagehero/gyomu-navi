import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { requireUser } from "@/lib/auth/guards";
import { canAccessStaff } from "@/lib/auth/scope";
import { getPool } from "@/lib/db/pool";
import { handleRouteError } from "@/lib/api/errors";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Auth-gated proxy for private report images.
 *
 * We never expose the raw Blob URL to the client — `business_reports.image_url`
 * is `access: "private"` and not directly fetchable. Browsers ask this route,
 * we verify the caller can see the underlying report (same scoping as the
 * report detail endpoint), and stream the bytes through.
 *
 * If/when traffic grows, swap this for a short-lived presigned URL flow
 * (`issueSignedToken` + `presignUrl`) so the bytes can bypass our origin.
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser(request);
    const { id } = await ctx.params;

    const { rows } = await getPool().query<{
      staff_id: string;
      image_url: string | null;
    }>(
      `SELECT staff_id, image_url FROM business_reports WHERE id = $1`,
      [id],
    );
    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
    }
    if (!row.image_url) {
      return NextResponse.json({ error: "画像がありません" }, { status: 404 });
    }
    if (!(await canAccessStaff(user, row.staff_id))) {
      return NextResponse.json({ error: "閲覧権限がありません" }, { status: 403 });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      // Configured to store URLs but no token — operator error. Surface it as a
      // 503 rather than a confusing 500 from the SDK.
      return NextResponse.json(
        { error: "画像ストレージ未設定", code: "blob_unconfigured" },
        { status: 503 },
      );
    }

    const blob = await get(row.image_url, { access: "private" });
    if (!blob || blob.statusCode !== 200) {
      return NextResponse.json({ error: "画像が見つかりません" }, { status: 404 });
    }

    return new NextResponse(blob.stream, {
      status: 200,
      headers: {
        "content-type": blob.blob.contentType,
        // Private content — let the browser cache for the session but never
        // a shared cache. Forces re-auth on a fresh load.
        "cache-control": "private, max-age=300",
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
