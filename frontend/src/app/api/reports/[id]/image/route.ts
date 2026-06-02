import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { requireUser } from "@/lib/auth/guards";
import { canAccessStaff } from "@/lib/auth/scope";
import { getPool } from "@/lib/db/pool";
import { handleRouteError } from "@/lib/api/errors";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

function backendBase(): string | null {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  return base || null;
}

/**
 * Auth-gated proxy for private report images.
 *
 * When the NestJS API is configured (`NEXT_PUBLIC_API_BASE_URL`), we forward
 * the session cookie to the backend image endpoint so uploads stored in S3 /
 * local disk are served correctly. Otherwise fall back to Vercel Blob (Phase1).
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

    const apiBase = backendBase();
    if (apiBase) {
      const cookie = request.headers.get("cookie");
      const upstream = await fetch(`${apiBase}/api/reports/${id}/image`, {
        headers: cookie ? { cookie } : {},
        redirect: "manual",
      });

      if (upstream.status === 301 || upstream.status === 302) {
        const location = upstream.headers.get("location");
        if (location) {
          return NextResponse.redirect(location, upstream.status);
        }
      }
      if (!upstream.ok) {
        const errBody = await upstream.text();
        return new NextResponse(errBody, {
          status: upstream.status,
          headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
        });
      }

      const headers = new Headers();
      const contentType = upstream.headers.get("content-type");
      if (contentType) headers.set("content-type", contentType);
      headers.set("cache-control", "private, max-age=300");
      return new NextResponse(upstream.body, { status: 200, headers });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
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
        "cache-control": "private, max-age=300",
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
