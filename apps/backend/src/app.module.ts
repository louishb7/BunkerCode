import { Module } from "@nestjs/common";
import { LearningModule } from "./learning/learning.module";
import { ContentController } from "./content/content.controller";

@Module({ imports: [LearningModule], controllers: [ContentController] })
export class AppModule {}
