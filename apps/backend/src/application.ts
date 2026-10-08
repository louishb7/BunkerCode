import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { json, type NextFunction, type Request, type Response } from "express";
import { AppModule } from "./app.module";
const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
function studioOrigin() {
  const configured =
    process.env.BUNKERCODE_STUDIO_ORIGIN ?? "http://127.0.0.1:5173";
  const origin = new URL(configured);
  if (
    origin.protocol !== "http:" ||
    !loopbackHosts.has(origin.hostname) ||
    origin.origin !== configured ||
    origin.username ||
    origin.password
  )
    throw new Error(
      "BUNKERCODE_STUDIO_ORIGIN must be an exact HTTP loopback origin",
    );
  return configured;
}
export async function createApplication(quiet = false) {
  const allowedOrigin = studioOrigin();
  const app = await NestFactory.create(AppModule, {
    logger: quiet ? false : undefined,
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (
      req.method !== "GET" &&
      req.method !== "HEAD" &&
      req.path.toLowerCase().startsWith("/content/courses")
    ) {
      let localHost = false;
      try {
        const host = req.headers.host ?? "";
        const parsed = new URL("http://" + host);
        localHost = loopbackHosts.has(parsed.hostname) && parsed.host === host;
      } catch {
        localHost = false;
      }
      const site = req.header("sec-fetch-site");
      if (
        !localHost ||
        req.header("origin") !== allowedOrigin ||
        (site !== undefined && site !== "same-origin")
      ) {
        res.status(403).json({
          message:
            "Escrita permitida somente pela interface local configurada.",
        });
        return;
      }
      if (!req.is("application/json")) {
        res
          .status(415)
          .json({ message: "Envie o conteúdo como application/json." });
        return;
      }
    }
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
  // Only editorial JSON needs this limit (UTF-8 Markdown can be JSON-escaped).
  // Nest's normal parser/limits still handle the existing learning endpoints.
  const editorialJson = json({ limit: 1600 * 1024 });
  // Nest detects installed parsers by middleware name. A scoped jsonParser alone
  // would incorrectly suppress Nest's default JSON parser for learning routes.
  app.use(
    "/content/courses",
    (req: Request, res: Response, next: NextFunction) =>
      editorialJson(req, res, next),
  );
  app.enableShutdownHooks();
  return app;
}
