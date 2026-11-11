import { SqlAssessmentController } from "./sql/assessment.controller";
import { SqlService, SQL_CONFIG } from "./sql/sql.service";
import { SqlController } from "./sql/sql.controller";
import { LearningController } from "./learning/learning.controller";
import { LearningService } from "./learning/learning.service";
import { AuthModule } from "./auth/auth.module";
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
            (await import("./sql/authoring.controller")).SqlAuthoringController,
            (await import("./content/authoring.controller"))
              .AuthoringController,
            (await import("./practice/practice.controller")).PracticeController,
          ]
        : [];
    return {
      module: AppModule,
      imports: [AuthModule],
      controllers: [
        ContentController,
        SqlController,
        SqlAssessmentController,
        LearningController,
        ...privateControllers,
      ],
      providers: [
        LearningService,
        SqlService,
        { provide: SQL_CONFIG, useValue: config },
        { provide: ContentReader, useValue: new ContentReader(config) },
      ],
    };
  }
}
