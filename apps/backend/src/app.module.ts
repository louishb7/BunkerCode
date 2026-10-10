import { PracticeController } from "./practice/practice.controller";
import { Module } from "@nestjs/common";
import { ContentController } from "./content/content.controller";

@Module({ controllers: [ContentController, PracticeController] })
export class AppModule {}
