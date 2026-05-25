import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { hashPassword, normalizeEmail } from "@/lib/auth/credentials";
import { getPool } from "@/lib/db/pool";
import { handleRouteError, parseJsonBody } from "@/lib/api/errors";

export const runtime = "nodejs";

function employeeRegisterEnabled(): boolean {
  return process.env.ALLOW_EMPLOYEE_REGISTER !== "false";
}

const registerSchema = z.object({
  name: z.string().trim().min(1, "氏名を入力してください").max(100),
  email: z.string().trim().email("メール形式が正しくありません"),
  password: z.string().min(8, "パスワードは8文字以上にしてください"),
});

export async function POST(request: NextRequest) {
  if (!employeeRegisterEnabled()) {
    return NextResponse.json({ error: "従業員登録は現在受け付けていません" }, { status: 403 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const body = registerSchema.parse(await parseJsonBody(request));
    const email = normalizeEmail(body.email);
    const passwordHash = await hashPassword(body.password);
    const staffId = randomUUID();
    const userId = randomUUID();

    await client.query("BEGIN");

    await client.query(
      `INSERT INTO staffs (id, name, hourly_rate, department_id)
       VALUES ($1, $2, 0, NULL)`,
      [staffId, body.name],
    );

    await client.query(
      `INSERT INTO users (id, email, password_hash, display_name, app_role, staff_id, department_id, login_approved_at)
       VALUES ($1, $2, $3, $4, 'employee', $5, NULL, NULL)`,
      [userId, email, passwordHash, body.name, staffId],
    );

    await client.query("COMMIT");

    return NextResponse.json(
      {
        message:
          "登録を受け付けました。管理者が担当部署・顧客を設定して承認するまで、ログインはできません。",
      },
      { status: 201 },
    );
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
      return NextResponse.json({ error: "このメールアドレスは既に登録されています" }, { status: 409 });
    }
    return handleRouteError(err);
  } finally {
    client.release();
  }
}
