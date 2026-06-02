import { Module } from "@nestjs/common";
import { BusinessTypesController } from "./business-types.controller";
import { BusinessTypesService } from "./business-types.service";

@Module({
  controllers: [BusinessTypesController],
  providers: [BusinessTypesService],
})
export class BusinessTypesModule {}
