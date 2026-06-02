import {
  BadRequestException,
  Controller,
  Headers,
  Param,
  Put,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { UploadService } from "./upload.service";

/**
 * Token-authenticated PUT target for local dev uploads.
 * No JWT — the presign step embeds a short-lived HMAC token in the URL.
 */
@Controller("uploads/local")
export class UploadLocalController {
  constructor(private readonly uploads: UploadService) {}

  @Put(":token")
  async putLocal(
    @Param("token") token: string,
    @Headers("content-type") contentType: string | undefined,
    @Req() req: Request,
  ) {
    if (!contentType) {
      throw new BadRequestException("Content-Type が必要です");
    }
    await this.uploads.completeLocalUpload(token, req, contentType);
    return { ok: true };
  }
}
