import { Module } from "@nestjs/common";
import { ReportSessionsController } from "./sessions.controller";
import { ReportSessionsService } from "./sessions.service";

@Module({
  controllers: [ReportSessionsController],
  providers: [ReportSessionsService],
})
export class ReportSessionsModule {}
