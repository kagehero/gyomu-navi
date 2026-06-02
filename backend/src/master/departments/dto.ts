import { IsString, MaxLength, MinLength } from "class-validator";
import { Transform } from "class-transformer";

/**
 * Department mutation payload. Phase1 used a single field (`name`); the
 * trim() and length bounds mirror the original zod schema.
 */
export class DepartmentMutationDto {
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @MinLength(1, { message: "名称を入力してください" })
  @MaxLength(100)
  name!: string;
}
