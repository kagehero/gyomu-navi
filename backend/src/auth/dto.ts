import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";
import { Transform } from "class-transformer";

export class LoginDto {
  @IsEmail()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  email!: string;

  @IsString()
  @MinLength(1, { message: "パスワードを入力してください" })
  @MaxLength(200)
  password!: string;
}

export class RegisterDto {
  @IsEmail()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  email!: string;

  @IsString()
  @MinLength(8, { message: "パスワードは8文字以上で入力してください" })
  @MaxLength(200)
  password!: string;

  @IsString()
  @MaxLength(255)
  displayName!: string;
}
