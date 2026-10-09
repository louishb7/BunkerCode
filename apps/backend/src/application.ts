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
    bodyParser: false,
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
      if (req.header("x-bunkercode-client") !== "local") {
        res.status(403).json({ message: "Comando local inválido." });
        return;
      }
    }
    next();
  });
  // Markdown can expand through JSON escapes; the decoded byte limit remains 256 KiB.
  app.use("/content/courses", json({ limit: 1600 * 1024 }));
  app.enableShutdownHooks();
  return app;
}
