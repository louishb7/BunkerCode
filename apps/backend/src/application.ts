import "reflect-metadata";
import { HttpErrors } from "./auth/http-errors";
import { authConfig } from "./auth/config";
import { PrismaService } from "./auth/prisma.service";
import { authRateLimit } from "./auth/rate-limit";
import { NestFactory } from "@nestjs/core";
import { json, type NextFunction, type Request, type Response } from "express";
import { AppModule } from "./app.module";
import { operationalConfig } from "./operational-profile";
import { StartupError } from "./startup-error";
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
  let config: ReturnType<typeof operationalConfig>;
  try {
    config = operationalConfig();
  } catch (error) {
    throw new StartupError(
      "content/profile configuration",
      "Check BUNKERCODE_PROFILE (authoring/public), content access and BUNKERCODE_PUBLICATION_FILE. Public mode requires BUNKERCODE_CONTENT_DIR pointing to a valid read-only snapshot; see docs/publication.md.",
      { cause: error },
    );
  }
  const auth = authConfig();
  let allowedOrigin: string | undefined;
  try {
    allowedOrigin = config.profile === "authoring" ? studioOrigin() : undefined;
  } catch (error) {
    throw new StartupError(
      "studio configuration",
      "BUNKERCODE_STUDIO_ORIGIN must be an exact HTTP loopback origin; default http://127.0.0.1:5173.",
      { cause: error },
    );
  }
  const app = await NestFactory.create(await AppModule.configure(config), {
    abortOnError: false,
    logger: quiet ? false : ["log", "warn"],
    bodyParser: false,
  });
  app
    .getHttpAdapter()
    .getInstance()
    .set(
      "trust proxy",
      auth.trustedProxies.length ? auth.trustedProxies : false,
    );
  app.useGlobalFilters(new HttpErrors());
  app.enableCors({
    origin: [...auth.origins],
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Bunkercode-Client"],
  });
  app.use(
    ["/learning", "/sql"],
    (req: Request, res: Response, next: NextFunction) => {
      res.setHeader("Cache-Control", "no-store");
      if (req.method !== "GET" && req.method !== "HEAD") {
        if (
          !auth.origins.includes(req.header("origin") ?? "") ||
          req.header("sec-fetch-site") === "cross-site"
        ) {
          res.status(403).json({ message: "Origem não autorizada." });
          return;
        }
        if (!req.is("application/json")) {
          res.status(415).json({ message: "Envie JSON." });
          return;
        }
      }
      next();
    },
  );
  app.use("/learning", json({ limit: "4kb" }));
  app.use("/sql", json({ limit: "110kb" }));
  app.use(
    "/auth",
    (req: Request, res: Response, next: NextFunction) => {
      res.setHeader("Cache-Control", "no-store");
      if (req.method !== "GET" && req.method !== "HEAD") {
        if (
          !auth.origins.includes(req.header("origin") ?? "") ||
          req.header("sec-fetch-site") === "cross-site"
        ) {
          res.status(403).json({ message: "Origem não autorizada." });
          return;
        }
        if (!req.is("application/json")) {
          res.status(415).json({ message: "Envie JSON." });
          return;
        }
      }
      next();
    },
    json({ limit: "4kb" }),
    authRateLimit(app.get(PrismaService)),
  );
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (
      req.method !== "GET" &&
      req.method !== "HEAD" &&
      (req.path.toLowerCase().startsWith("/content/courses") ||
        req.path.toLowerCase().startsWith("/content/sql") ||
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
  app.use("/content/sql", json({ limit: "220kb" }));
  app.use("/practice", json({ limit: 800 * 1024 }));
  app.use(
    (error: unknown, _req: Request, res: Response, next: NextFunction) => {
      if (
        error &&
        typeof error === "object" &&
        "type" in error &&
        (error.type === "entity.parse.failed" ||
          error.type === "entity.too.large")
      ) {
        res
          .status(error.type === "entity.too.large" ? 413 : 400)
          .json({ message: "Corpo JSON inválido ou acima do limite." });
        return;
      }
      next(error);
    },
  );
  app.enableShutdownHooks();
  return app;
}
