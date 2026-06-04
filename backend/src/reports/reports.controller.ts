import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { createReadStream } from "node:fs";
import { extname } from "node:path";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthedUser } from "../auth/types";
import { UploadService } from "../upload/upload.service";
import { ReportsListQueryDto } from "./dto";
import { ReportsService } from "./reports.service";
import { AddReportImagesDto, PatchReportDto } from "./single-report.dto";

@Controller("reports")
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(
    private readonly svc: ReportsService,
    private readonly uploads: UploadService,
  ) {}

  @Get()
  list(@Query() q: ReportsListQueryDto, @CurrentUser() user: AuthedUser) {
    return this.svc.list(user, q);
  }

  @Get(":id")
  detail(@Param("id", new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthedUser) {
    return this.svc.detail(user, id);
  }

  @Patch(":id")
  patch(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: PatchReportDto,
    @CurrentUser() user: AuthedUser,
  ) {
    return this.svc.patch(user, id, body);
  }

  @Delete(":id")
  async delete(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthedUser,
  ) {
    await this.svc.delete(user, id);
    return { ok: true };
  }

  /**
   * Legacy Phase1 path. The SPA now POSTs `/api/uploads/presign` directly,
   * so this is just a stable 503 for any cached frontend asking the old
   * way. Returning a structured `code` lets the caller distinguish.
   */
  @Post("upload-url")
  @HttpCode(HttpStatus.SERVICE_UNAVAILABLE)
  uploadUrl() {
    throw new ServiceUnavailableException({
      error: "このエンドポイントは廃止されました。POST /api/uploads/presign を使用してください。",
      code: "use_s3_presign",
    });
  }

  /**
   * Auth-gated image proxy.
   *
   * We verify the caller can see the underlying report, then 302 to a
   * short-lived presigned S3 GET URL. The bytes never traverse our origin;
   * the redirect is opaque to the `<img src>` consumer.
   *
   * If we eventually serve large images over a CDN, this can be replaced
   * with a CloudFront signed URL using the same access check.
   */
  @Get(":id/image")
  async image(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthedUser,
    @Res() res: Response,
  ) {
    const meta = await this.svc.loadImageMeta(user, id);
    await this.streamObject(meta.image_url, res);
  }

  // ----- multi-image endpoints -----

  /** Attach uploaded object keys to a report. Body: `{ objectKeys: string[] }`. */
  @Post(":id/images")
  addImages(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: AddReportImagesDto,
    @CurrentUser() user: AuthedUser,
  ) {
    return this.svc.addImages(user, id, body.objectKeys);
  }

  /** List a report's images (metadata only). */
  @Get(":id/images")
  listImages(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthedUser,
  ) {
    return this.svc.listImages(user, id);
  }

  /** Stream a single report image by its id. */
  @Get(":id/images/:imageId")
  async imageById(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("imageId", new ParseUUIDPipe()) imageId: string,
    @CurrentUser() user: AuthedUser,
    @Res() res: Response,
  ) {
    const meta = await this.svc.loadReportImageMeta(user, id, imageId);
    await this.streamObject(meta.object_key, res);
  }

  /** Delete a single report image. */
  @Delete(":id/images/:imageId")
  async deleteImage(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("imageId", new ParseUUIDPipe()) imageId: string,
    @CurrentUser() user: AuthedUser,
  ) {
    return this.svc.deleteImage(user, id, imageId);
  }

  /**
   * Resolve a stored object key to bytes for the `<img>` consumer:
   * full URL → 302; local disk → stream; S3 → 302 to a presigned GET URL.
   */
  private async streamObject(objectKey: string, res: Response): Promise<void> {
    if (isFullUrl(objectKey)) {
      res.redirect(HttpStatus.FOUND, objectKey);
      return;
    }

    if (this.uploads.isLocalStorage()) {
      const filePath = this.uploads.localFilePath(objectKey);
      if (!filePath || !(await this.uploads.localFileExists(objectKey))) {
        res.status(HttpStatus.NOT_FOUND).end();
        return;
      }
      res.type(contentTypeFromKey(objectKey));
      createReadStream(filePath).pipe(res);
      return;
    }

    const target = await this.uploads.presignGet(objectKey);
    res.redirect(HttpStatus.FOUND, target);
  }
}

function contentTypeFromKey(key: string): string {
  switch (extname(key).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".heic":
      return "image/heic";
    default:
      return "image/jpeg";
  }
}

function isFullUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}
