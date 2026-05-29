import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { UploadModule } from "./upload/upload.module";
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
  ],
  controllers: [HealthController],
})
export class AppModule {}
