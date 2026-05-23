import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireUser } from "@/lib/auth/guards";
import { handleRouteError } from "@/lib/api/errors";

export const runtime = "nodejs";

/**
 * Issuer for Vercel Blob client-side uploads. The browser calls @vercel/blob's
 * `upload()` against this route, gets a short-lived signed token, then PUTs the
 * file directly to Blob storage (the bytes never traverse our server).
 *
 * Requires BLOB_READ_WRITE_TOKEN. Without it we 503 so the client can fall back
 * to submitting a text-only report.
 */
export async function POST(request: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error: "画像アップロードは未設定です。管理者にご連絡ください。",
        code: "blob_unconfigured",
      },
      { status: 503 },
    );
  }

  try {
    // Authentication: only logged-in users can request an upload token.
    // We don't gate by role — admin/manager/employee can all attach images
    // to their own reports (manager attach happens via admin endpoint anyway).
    const user = await requireUser(request);

    const body = (await request.json()) as HandleUploadBody;

    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Constrain what kinds of files can be uploaded, and to which prefix.
        // Pathname is suggested by the client; we accept it but the token
        // restricts where the upload can land.
        if (!pathname.startsWith("reports/")) {
          throw new Error("不正なアップロード先です");
        }
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/heic"],
          maximumSizeInBytes: 10 * 1024 * 1024,
          tokenPayload: JSON.stringify({ userId: user.id }),
        };
      },
      onUploadCompleted: async () => {
        // No-op: we record the resulting URL when the client subsequently
        // POSTs /api/reports with `image_url` set.
      },
    });

    return NextResponse.json(json);
  } catch (err) {
    return handleRouteError(err);
  }
}
