import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { json, type NextFunction, type Request, type Response } from "express";
import { AppModule } from "./app.module";
import { operationalConfig } from "./operational-profile";
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
  const config = operationalConfig();
  const allowedOrigin =
    config.profile === "authoring" ? studioOrigin() : undefined;
  const app = await NestFactory.create(await AppModule.configure(config), {
    logger: quiet ? false : undefined,
    bodyParser: false,
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (
      req.method !== "GET" &&
      req.method !== "HEAD" &&
      (req.path.toLowerCase().startsWith("/content/courses") ||
        req.path.toLowerCase().startsWith("/practice"))
    ) {
      if (config.profile === "public") {
        res
          .status(403)
          .json({ message: "Operação indisponível no perfil público." });
        return;
      }
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
  app.use("/practice", json({ limit: 800 * 1024 }));
  app.enableShutdownHooks();
  return app;
}
