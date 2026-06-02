import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth/guards";

/**
 * Convert anything thrown inside a Route Handler into a JSON error response.
 * Keeps the route bodies short and uniform.
 */
export function handleRouteError(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof ZodError) {
    const flat = err.flatten().fieldErrors;
    const first = Object.values(flat).flat()[0] ?? "入力内容を確認してください";
    return NextResponse.json({ error: first, code: "validation" }, { status: 400 });
  }
  if (isPgError(err)) {
    // 23503 = foreign_key_violation, 23505 = unique_violation, 23514 = check_violation
    if (err.code === "23503") {
      return NextResponse.json(
        { error: "参照先が存在しないか、紐付くデータがあるため操作できません" },
        { status: 400 },
      );
    }
    if (err.code === "23505") {
      return NextResponse.json(
        { error: "同じ値が既に登録されています" },
        { status: 409 },
      );
    }
    if (err.code === "23514") {
      return NextResponse.json(
        { error: "値の制約に違反しています" },
        { status: 400 },
      );
    }
  }
  console.error("[api] unhandled", err);
  return NextResponse.json(
    { error: "サーバーでエラーが発生しました。しばらくしてから再試行してください。" },
    { status: 500 },
  );
}

function isPgError(e: unknown): e is { code: string; message: string } {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    typeof (e as { code: unknown }).code === "string"
  );
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ZodError([
      {
        code: "custom",
        path: [],
        message: "JSON の形式が正しくありません",
      },
    ]);
  }
}
