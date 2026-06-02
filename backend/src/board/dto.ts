import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";
import { Transform, Type } from "class-transformer";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class ListBoardQueryDto {
  @IsOptional() @IsUUID()
  site_id?: string;
}

export class CreateBoardPostDto {
  @IsUUID(undefined, { message: "現場を選んでください" })
  site_id!: string;

  @IsString() @Transform(trim) @MinLength(1) @MaxLength(255)
  title!: string;

  @IsString() @Transform(trim) @MinLength(1) @MaxLength(10_000)
  body!: string;

  @IsOptional() @Type(() => Boolean) @IsBoolean()
  pinned?: boolean;
}

export class PatchBoardPostDto {
  @IsOptional() @IsString() @Transform(trim) @MinLength(1) @MaxLength(255)
  title?: string;

  @IsOptional() @IsString() @Transform(trim) @MinLength(1) @MaxLength(10_000)
  body?: string;

  @IsOptional() @IsBoolean()
  pinned?: boolean;
}
