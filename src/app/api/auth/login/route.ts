import bcrypt from "bcrypt";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { normalizeEmail } from "@/lib/auth/credentials";
import { getPool } from "@/lib/db/pool";
import { getCookieName, getCookieOptions, signUserToken } from "@/lib/auth/tokens";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email("メール形式が正しくありません"),
  password: z.string().min(1, "パスワードを入力してください"),
});


export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL?.trim() || !process.env.JWT_SECRET?.trim()) {
    console.error(
      "[auth/login] Missing DATABASE_URL or JWT_SECRET in environment (e.g. set both in the Vercel project Settings → Environment Variables).",
    );
    return NextResponse.json(
      {
        error:
          "サーバー設定が不足しています。DATABASE_URL と JWT_SECRET をデプロイ先の環境変数に設定してください。",
        code: "config",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const f = parsed.error.flatten().fieldErrors;
    const first = f.email?.[0] || f.password?.[0] || "入力内容を確認してください";
    return NextResponse.json({ error: first }, { status: 400 });
  }
  const { email, password } = parsed.data;
  const norm = normalizeEmail(email);

  try {
    const pool = getPool();
    const { rows } = await pool.query<{
      id: string;
      email: string;
      password_hash: string;
      display_name: string;
      app_role: "admin" | "manager" | "employee";
      staff_id: string | null;
      department_id: string | null;
      staff_deleted: boolean | null;
      login_approved_at: string | null;
    }>(
      `SELECT u.id, u.email, u.password_hash, u.display_name, u.app_role,
              u.staff_id, u.department_id, u.login_approved_at,
              (st.deleted_at IS NOT NULL) AS staff_deleted
         FROM users u
         LEFT JOIN staffs st ON st.id = u.staff_id
        WHERE u.email = $1 AND u.deleted_at IS NULL`,
      [norm],
    );
    const user = rows[0];
    if (
      !user ||
      (user.app_role === "employee" && (!user.staff_id || user.staff_deleted))
    ) {
      return NextResponse.json(
        { error: "メールアドレスまたはパスワードが違います" },
        { status: 401 },
      );
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return NextResponse.json(
        { error: "メールアドレスまたはパスワードが違います" },
        { status: 401 },
      );
    }
    if (user.app_role === "employee" && !user.login_approved_at) {
      return NextResponse.json(
        {
          error: "管理者による承認待ちです。承認後にログインできます。",
          code: "pending_approval",
        },
        { status: 403 },
      );
    }
    const token = signUserToken({ id: user.id, email: user.email });
    const opts = getCookieOptions();
    const res = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.app_role,
        staffId: user.staff_id,
        departmentId: user.department_id,
      },
    });
    res.cookies.set(getCookieName(), token, {
      httpOnly: opts.httpOnly,
      secure: opts.secure,
      sameSite: opts.sameSite,
      maxAge: Math.floor(opts.maxAge / 1000),
      path: opts.path,
    });
    return res;
  } catch (e) {
    console.error("[auth/login]", e);
    return NextResponse.json(
      { error: "サーバーでエラーが発生しました。しばらくしてから再試行してください。" },
      { status: 500 },
    );
  }
}
