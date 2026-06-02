import { Module } from "@nestjs/common";
import { UploadController } from "./upload.controller";
import { UploadLocalController } from "./upload-local.controller";
import { UploadService } from "./upload.service";

@Module({
  controllers: [UploadController, UploadLocalController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
