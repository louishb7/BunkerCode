import { Module } from "@nestjs/common";
import {
  LaboratoryController,
  SystemsController,
} from "./laboratory.controller";
import { LaboratoryService } from "./laboratory.service";
@Module({
  controllers: [LaboratoryController, SystemsController],
  providers: [LaboratoryService],
})
export class AppModule {}
