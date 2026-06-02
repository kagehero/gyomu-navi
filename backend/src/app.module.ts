import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { UploadModule } from "./upload/upload.module";
import { DepartmentsModule } from "./master/departments/departments.module";
import { ClientsModule } from "./master/clients/clients.module";
import { SitesModule } from "./master/sites/sites.module";
import { StaffsModule } from "./master/staffs/staffs.module";
import { BusinessTypesModule } from "./master/business-types/business-types.module";
import { BusinessLinesModule } from "./master/business-lines/business-lines.module";
import { AttendanceModule } from "./attendance/attendance.module";
import { AnalyticsModule } from "./analytics/analytics.module";
// Register the sessions module BEFORE the parent reports module so the
// literal `/reports/sessions` route is matched before `/reports/:id`.
import { ReportSessionsModule } from "./reports/sessions/sessions.module";
import { ReportsModule } from "./reports/reports.module";
import { MeModule } from "./me/me.module";
import { NoticesModule } from "./notices/notices.module";
import { BoardModule } from "./board/board.module";
import { HealthController } from "./health.controller";
import { typeOrmConfig } from "./database/typeorm.config";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: typeOrmConfig,
    }),
    AuthModule,
    UsersModule,
    UploadModule,
    DepartmentsModule,
    ClientsModule,
    SitesModule,
    StaffsModule,
    BusinessTypesModule,
    BusinessLinesModule,
    AttendanceModule,
    AnalyticsModule,
    ReportSessionsModule,
    ReportsModule,
    MeModule,
    NoticesModule,
    BoardModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
