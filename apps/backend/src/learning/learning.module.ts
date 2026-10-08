import { Module } from "@nestjs/common";
import { Attempts } from "./attempts";
import { LearningController } from "./learning.controller";
@Module({ controllers: [LearningController], providers: [Attempts] })
export class LearningModule {}
