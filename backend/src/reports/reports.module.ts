import { Module } from "@nestjs/common";
import { UploadModule } from "../upload/upload.module";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

@Module({
  imports: [UploadModule], // pulls in UploadService for the image proxy
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
