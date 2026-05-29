import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthedUser } from "../auth/types";
import { PresignUploadDto } from "./dto";
import { UploadService } from "./upload.service";

@Controller("uploads")
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploads: UploadService) {}

  /**
   * Issue a presigned S3 PUT URL for the caller's next upload.
   *
   * Replaces Phase1's POST /api/reports/upload-url (which spoke @vercel/blob
   * and returned a token payload). The SPA's client-side flow now does:
   *   1. POST /api/uploads/presign       → { uploadUrl, objectKey }
   *   2. PUT  <uploadUrl> with the file bytes
   *   3. PATCH /api/reports/<id> with { image_url: objectKey }
   */
  @Post("presign")
  async presign(@Body() body: PresignUploadDto, @CurrentUser() user: AuthedUser) {
    return this.uploads.presignPut({
      userId: user.id,
      filename: body.filename,
      contentType: body.contentType,
      contentLength: body.contentLength,
    });
  }
}
