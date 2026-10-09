import { Module } from "@nestjs/common";
import { ContentController } from "./content/content.controller";

@Module({ controllers: [ContentController] })
export class AppModule {}
