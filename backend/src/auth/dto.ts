import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { Transform } from "class-transformer";

const trimLower = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim().toLowerCase() : value;

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class LoginDto {
  @IsEmail({}, { message: "メール形式が正しくありません" })
  @Transform(trimLower)
  email!: string;

  @IsString()
  @MinLength(1, { message: "パスワードを入力してください" })
  @MaxLength(200)
  password!: string;
}

/**
 * Admin self-registration body — matches the legacy
 * `POST /api/auth/register` (gated by ALLOW_REGISTER=true).
 * `displayName` is optional in the legacy zod schema; we keep that here too.
 */
export class RegisterDto {
  @IsEmail({}, { message: "メール形式が正しくありません" })
  @Transform(trimLower)
  email!: string;

  @IsString()
  @MinLength(1, { message: "パスワードを入力してください" })
  @MaxLength(200)
  password!: string;

  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(255)
  displayName?: string;
}

/**
 * Employee self-registration body — matches the legacy
 * `POST /api/auth/register/employee` (gated by ALLOW_EMPLOYEE_REGISTER!=false).
 * The legacy route requires a min-8 password and a non-empty `name`.
 */
export class RegisterEmployeeDto {
  @IsString()
  @Transform(trim)
  @MinLength(1, { message: "氏名を入力してください" })
  @MaxLength(100)
  name!: string;

  @IsEmail({}, { message: "メール形式が正しくありません" })
  @Transform(trimLower)
  email!: string;

  @IsString()
  @MinLength(8, { message: "パスワードは8文字以上にしてください" })
  @MaxLength(200)
  password!: string;
}
