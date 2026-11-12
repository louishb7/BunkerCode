import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { accessSync, constants, lstatSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const exec = promisify(execFile);
let configDirectory: string | undefined;
export function sqlDockerMode() {
  const mode = process.env.BUNKERCODE_SQL_RUNNER_MODE;
  if (mode !== "development" && mode !== "rootless")
    throw new Error("SQL runner mode required");
  if (mode === "development") {
    const origins = process.env.BUNKERCODE_AUTH_ORIGINS?.split(",") ?? [];
    if (
      process.env.NODE_ENV === "production" ||
      origins.some((value) => {
        const url = new URL(value);
        return (
          url.protocol !== "http:" ||
          !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
        );
      })
    )
      throw new Error("Rootful SQL is development only");
    return { mode, socket: "/var/run/docker.sock" };
  }
  const uid = process.getuid?.();
  if (!uid) throw new Error("Rootless SQL needs an unprivileged identity");
  const directory = `/run/user/${uid}`;
  const socket = process.env.BUNKERCODE_SQL_DOCKER_SOCKET;
  if (socket !== directory + "/docker.sock")
    throw new Error("Explicit rootless Unix socket required");
  const parent = lstatSync(directory),
    endpoint = lstatSync(socket);
  if (
    !parent.isDirectory() ||
    parent.uid !== uid ||
    (parent.mode & 0o077) !== 0 ||
    !endpoint.isSocket() ||
    endpoint.uid !== uid ||
    (endpoint.mode & 0o007) !== 0
  )
    throw new Error("Unsafe rootless socket ownership");
  try {
    accessSync("/var/run/docker.sock", constants.R_OK | constants.W_OK);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      ["ENOENT", "EACCES"].includes(String(error.code))
    )
      return { mode, socket };
    throw error;
  }
  throw new Error("HTTP identity still controls rootful Docker");
}
function options() {
  const { socket } = sqlDockerMode();
  // Never inherit database/JWT/proxy/context/credential configuration into the CLI.
  configDirectory ??= mkdtempSync(
    join(tmpdir(), "bunkercode-sql-docker-config-"),
  );
  return {
    env: {
      PATH: process.env.PATH,
      HOME: configDirectory,
      DOCKER_CONFIG: configDirectory,
      DOCKER_HOST: "unix://" + socket,
      LANG: "C",
      LC_ALL: "C",
    },
  };
}
export function sqlDocker(args: string[], timeout = 4000, maxBuffer = 4096) {
  return exec("docker", args, { ...options(), timeout, maxBuffer });
}
export function attachSqlDocker(name: string) {
  return spawn("docker", ["start", "--attach", "--interactive", name], {
    ...options(),
    stdio: ["pipe", "pipe", "pipe"],
  });
}
export async function assertNoSqlContainers() {
  const result = await sqlDocker([
    "ps",
    "--all",
    "--filter",
    "label=bunkercode.sql.runner=1",
    "--format",
    "{{.Names}}",
  ]);
  if (result.stdout.trim())
    throw new Error("SQL containers require operator inspection");
}
