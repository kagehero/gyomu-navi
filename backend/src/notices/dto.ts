import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";
import { Transform } from "class-transformer";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class CreateNoticeDto {
  @IsIn(["all", "department", "individual"])
  target_type!: "all" | "department" | "individual";

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID()
  target_department_id?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID()
  target_user_id?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID()
  client_id?: string | null;

  @IsString() @Transform(trim) @MinLength(1) @MaxLength(255)
  title!: string;

  @IsString() @Transform(trim) @MinLength(1) @MaxLength(10_000)
  body!: string;
}

export class PatchNoticeDto {
  @IsOptional() @IsString() @Transform(trim) @MinLength(1) @MaxLength(255)
  title?: string;

  @IsOptional() @IsString() @Transform(trim) @MinLength(1) @MaxLength(10_000)
  body?: string;
}
