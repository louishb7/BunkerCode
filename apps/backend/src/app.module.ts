import { Module, type DynamicModule } from "@nestjs/common";
import { ContentController } from "./content/content.controller";
import { ContentReader } from "./content/content-reader";
import type { OperationalConfig } from "./operational-profile";

@Module({})
export class AppModule {
  static async configure(config: OperationalConfig): Promise<DynamicModule> {
    // No runtime/authoring import (or provider lifecycle) in the public process.
    const privateControllers =
      config.profile === "authoring"
        ? [
            (await import("./content/authoring.controller"))
              .AuthoringController,
            (await import("./practice/practice.controller")).PracticeController,
          ]
        : [];
    return {
      module: AppModule,
      controllers: [ContentController, ...privateControllers],
      providers: [
        { provide: ContentReader, useValue: new ContentReader(config) },
      ],
    };
  }
}
