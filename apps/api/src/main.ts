import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Mutations exigem JSON + header não simples; páginas externas não podem dispará-las por formulário.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (
      req.method !== "GET" &&
      req.method !== "HEAD" &&
      (req.header("x-bunkerlab-client") !== "local" ||
        !req.is("application/json"))
    ) {
      res.status(403).json({ message: "Comando local inválido." });
      return;
    }
    next();
  });
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3001), "127.0.0.1");
}
void bootstrap();
