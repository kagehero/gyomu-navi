import bcrypt from "bcrypt";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPool } from "@/lib/db/pool";
import { getCookieName, getCookieOptions, signUserToken } from "@/lib/auth/tokens";

export const runtime = "nodejs";

const registerSchema = z.object({
  email: z.string().email("メール形式が正しくありません"),
  password: z.string().min(1, "パスワードを入力してください"),
  displayName: z.string().max(255).optional(),
});

const SALT_ROUNDS = 10;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  if (process.env.ALLOW_REGISTER !== "true") {
    return NextResponse.json({ error: "新規登録は無効です" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    const f = parsed.error.flatten().fieldErrors;
    const first = f.email?.[0] || f.password?.[0] || "入力内容を確認してください";
    return NextResponse.json({ error: first }, { status: 400 });
  }
  const { email, password, displayName } = parsed.data;
  const norm = normalizeEmail(email);
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  const pool = getPool();
  try {
    const { rows } = await pool.query<{
      id: string;
      email: string;
      display_name: string;
      app_role: string;
      staff_profile_id: string | null;
    }>(
      `INSERT INTO users (email, password_hash, display_name, app_role, staff_profile_id)
       VALUES ($1, $2, $3, 'admin', NULL)
       RETURNING id, email, display_name, app_role, staff_profile_id`,
      [norm, hash, displayName?.trim() ?? ""],
    );
    const u = rows[0]!;
    const token = signUserToken({ id: u.id, email: u.email });
    const opts = getCookieOptions();
    const res = NextResponse.json(
      {
        user: {
          id: u.id,
          email: u.email,
          displayName: u.display_name,
          role: "admin" as const,
          staffId: null,
        },
      },
      { status: 201 },
    );
    res.cookies.set(getCookieName(), token, {
      httpOnly: opts.httpOnly,
      secure: opts.secure,
      sameSite: opts.sameSite,
      maxAge: Math.floor(opts.maxAge / 1000),
      path: opts.path,
    });
    return res;
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "23505") {
      return NextResponse.json({ error: "このメールアドレスは登録済みです" }, { status: 409 });
    }
    throw e;
  }
}
