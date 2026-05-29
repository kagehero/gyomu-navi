import { IsIn, IsInt, IsString, Matches, Max, Min } from "class-validator";

/**
 * Client requests a presigned PUT URL for an object it will upload directly
 * to S3. The server picks the final object key (so clients can't smuggle
 * arbitrary prefixes); the client supplies content-type and size for the
 * presigned policy.
 */
export class PresignUploadDto {
  @IsString()
  @Matches(/^[A-Za-z0-9._\- ]{1,128}$/, {
    message: "filename には英数字/.-_/空白のみ（128文字以内）が使えます",
  })
  filename!: string;

  @IsIn(["image/jpeg", "image/png", "image/webp", "image/heic"])
  contentType!: string;

  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024)
  contentLength!: number;
}
