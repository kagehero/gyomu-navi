import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";
import { Transform } from "class-transformer";

export class MeSitesQueryDto {
  @IsOptional() @IsUUID()
  client_id?: string;
}

export class MeBusinessTypesQueryDto {
  @IsUUID()
  business_line_id!: string;

  @IsUUID()
  client_id!: string;

  @IsOptional() @IsUUID()
  site_id?: string;
}

export class MeClientsQueryDto {
  @IsUUID(undefined, { message: "部門を選択してください" })
  business_line_id!: string;
}

export class MeVehiclesQueryDto {
  @IsUUID()
  client_id!: string;

  @IsOptional() @IsUUID()
  business_line_id?: string;
}

/**
 * Self-service password change — available to every logged-in user
 * (admin / manager / employee). The caller must prove ownership of the
 * account by supplying the current password.
 */
export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: "現在のパスワードを入力してください" })
  @MaxLength(200)
  current_password!: string;

  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @MinLength(8, { message: "新しいパスワードは8文字以上にしてください" })
  @MaxLength(200)
  new_password!: string;
}
