import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";
export async function createApplication(quiet = false) {
  const app = await NestFactory.create(AppModule, {
    logger: quiet ? false : undefined,
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (
      req.method !== "GET" &&
      req.method !== "HEAD" &&
      (req.header("x-bunkercode-client") !== "local" ||
        !req.is("application/json"))
    ) {
      res.status(403).json({ message: "Comando local inválido." });
      return;
    }
    next();
  });
  app.enableShutdownHooks();
  return app;
}
