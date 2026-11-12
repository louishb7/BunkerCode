// Development/deployment entry point: migrate before opening HTTP.
// --dev starts the TypeScript watcher; low-level entry points remain migration-free.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const backend = fileURLToPath(new URL("../apps/backend/", import.meta.url));
const development = process.argv[2] === "--dev";
const label = development ? "Dev" : "Deploy";
let child;
let stopping;
let phase = "configuration";
function stop(signal) {
  stopping = signal;
  child?.kill(signal);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
function run(args, capture) {
  return new Promise((resolve, reject) => {
    let output = "";
    child = spawn(process.execPath, args, {
      cwd: backend,
      env: process.env,
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    if (capture) {
      // Retain only a bounded tail for extracting a Prisma error code, never raw logs.
      const collect = (chunk) => {
        output = (output + chunk.toString()).slice(-16384);
      };
      child.stdout.on("data", collect);
      child.stderr.on("data", collect);
    }
    child.once("error", reject);
    child.once("close", (code, signal) => {
      child = undefined;
      resolve({ code, signal, output });
    });
  });
}
function databaseUrl(key) {
  try {
    const url = new URL(process.env[key]);
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !url.hostname ||
      url.pathname.length < 2
    )
      throw new Error();
  } catch {
    throw new Error(
      `${key} must identify the intended PostgreSQL database; values are withheld.`,
    );
  }
}
async function start() {
  if (
    process.argv.length > (development ? 3 : 2) ||
    (development &&
      (process.env.BUNKERCODE_PROFILE !== "authoring" ||
        process.env.NODE_ENV === "production"))
  )
    throw new Error("Invalid launcher mode.");
  if (!["authoring", "public"].includes(process.env.BUNKERCODE_PROFILE))
    throw new Error(
      "BUNKERCODE_PROFILE must explicitly be authoring or public.",
    );
  databaseUrl("DATABASE_URL");
  if (process.env.DIRECT_URL !== undefined) databaseUrl("DIRECT_URL");
  await Promise.all(
    [
      development ? "src/main.ts" : "dist/main.js",
      "prisma/schema.prisma",
      "prisma/migrations/migration_lock.toml",
      "prisma.config.ts",
    ].map((path) => access(join(backend, path))),
  );
  const require = createRequire(join(backend, "package.json"));
  const prisma = require.resolve("prisma/build/index.js");
  const serverArgs = development
    ? [require.resolve("tsx/cli"), "watch", "src/main.ts"]
    : [join(backend, "dist/main.js")];
  phase = "database connectivity";
  const { Client } = require("pg");
  // Require a provisioned database; do not let migrate deploy create a mistyped database.
  const connection = new Client({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    statement_timeout: 5000,
  });
  try {
    await connection.connect();
    await connection.query("SELECT 1");
  } finally {
    await connection.end();
  }
  if (stopping) return stopping === "SIGINT" ? 130 : 143;
  phase = "migration process";
  process.stdout.write(
    `${label}: applying versioned Prisma migrations before HTTP startup.\n`,
  );
  const migration = await run([prisma, "migrate", "deploy"], true);
  if (stopping) return stopping === "SIGINT" ? 130 : 143;
  if (migration.code !== 0) {
    const code = migration.output.match(/\bP\d{4}\b/)?.[0];
    process.stderr.write(
      `${label}: migration failed${code ? ` (${code})` : ""}; HTTP server was not started. Check database connectivity, TLS, migration history and permissions; see docs/deployment.md. Raw CLI output is withheld to protect credentials.\n`,
    );
    return migration.code || 1;
  }
  process.stdout.write(`${label}: migrations ready; starting backend.\n`);
  phase = "backend process";
  const server = await run(serverArgs, false);
  return server.code ?? ((server.signal ?? stopping) === "SIGINT" ? 130 : 143);
}
try {
  process.exitCode = await start();
} catch {
  process.stderr.write(
    `${label}: ${phase} failed. HTTP server was not started. Check DATABASE_URL, optional DIRECT_URL, BUNKERCODE_PROFILE and the ${development ? "local configuration" : "deployment artifact"}; see docs/deployment.md. Values and raw errors are withheld.\n`,
  );
  process.exitCode = stopping === "SIGINT" ? 130 : stopping ? 143 : 1;
} finally {
  process.off("SIGINT", stop);
  process.off("SIGTERM", stop);
}
