import bcrypt from "bcrypt";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPool } from "@/lib/db/pool";
import { getCookieName, getCookieOptions, signUserToken } from "@/lib/auth/tokens";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email("メール形式が正しくありません"),
  password: z.string().min(1, "パスワードを入力してください"),
});

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function POST(request: NextRequest) {
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
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    email: string;
    password_hash: string;
    display_name: string;
    app_role: string;
    staff_profile_id: string | null;
  }>(
    `SELECT id, email, password_hash, display_name, app_role, staff_profile_id FROM users WHERE email = $1`,
    [norm],
  );
  const user = rows[0];
  if (!user) {
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
  const token = signUserToken({ id: user.id, email: user.email });
  const opts = getCookieOptions();
  const res = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.app_role === "employee" ? "employee" : "admin",
      staffId: user.staff_profile_id,
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
}
