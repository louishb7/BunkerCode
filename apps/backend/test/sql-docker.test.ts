import { test } from "node:test";
import assert from "node:assert/strict";
import { sqlDockerMode } from "../src/sql/docker";
test("SQL Docker configuration fails closed for missing mode, production rootful, remote origins and absent rootless boundary", () => {
  const keys = [
    "BUNKERCODE_SQL_RUNNER_MODE",
    "NODE_ENV",
    "BUNKERCODE_AUTH_ORIGINS",
    "BUNKERCODE_SQL_DOCKER_SOCKET",
  ];
  const previous = keys.map((key) => process.env[key]);
  try {
    delete process.env.BUNKERCODE_SQL_RUNNER_MODE;
    assert.throws(sqlDockerMode);
    process.env.BUNKERCODE_SQL_RUNNER_MODE = "development";
    process.env.NODE_ENV = "production";
    assert.throws(sqlDockerMode);
    process.env.NODE_ENV = "test";
    process.env.BUNKERCODE_AUTH_ORIGINS = "https://example.test";
    assert.throws(sqlDockerMode);
    process.env.BUNKERCODE_AUTH_ORIGINS = "http://127.0.0.1:5173";
    assert.equal(sqlDockerMode().socket, "/var/run/docker.sock");
    process.env.BUNKERCODE_SQL_RUNNER_MODE = "rootless";
    delete process.env.BUNKERCODE_SQL_DOCKER_SOCKET;
    assert.throws(sqlDockerMode);
    process.env.BUNKERCODE_SQL_DOCKER_SOCKET = "tcp://127.0.0.1:2375";
    assert.throws(sqlDockerMode);
  } finally {
    keys.forEach((key, i) => {
      const value = previous[i];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  }
});

test("SQL CLI pins its socket and strips inherited application secrets and Docker contexts", async () => {
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join, delimiter } = await import("node:path");
  const { sqlDocker } = await import("../src/sql/docker");
  const root = mkdtempSync(join(tmpdir(), "bunkercode-sql-env-test-"));
  writeFileSync(
    join(root, "docker"),
    `#!/usr/bin/env node
console.log(JSON.stringify({ keys:Object.keys(process.env), host:process.env.DOCKER_HOST }));
`,
    { mode: 0o700 },
  );
  const values = {
    PATH: root + delimiter + process.env.PATH,
    BUNKERCODE_SQL_RUNNER_MODE: "development",
    NODE_ENV: "test",
    BUNKERCODE_AUTH_ORIGINS: "http://127.0.0.1:5173",
    DOCKER_HOST: "tcp://untrusted.invalid:2375",
    DOCKER_CONTEXT: "inherited",
    HTTPS_PROXY: "http://untrusted.invalid",
    BUNKERCODE_JWT_SECRET: "do-not-forward",
    DATABASE_URL: "do-not-forward",
  };
  const previous = Object.keys(values).map((key) => process.env[key]);
  try {
    Object.assign(process.env, values);
    const result = JSON.parse((await sqlDocker(["info"])).stdout) as {
      keys: string[];
      host: string;
    };
    assert.equal(result.host, "unix:///var/run/docker.sock");
    for (const key of [
      "DATABASE_URL",
      "BUNKERCODE_JWT_SECRET",
      "DOCKER_CONTEXT",
      "HTTPS_PROXY",
    ])
      assert.ok(!result.keys.includes(key));
  } finally {
    Object.keys(values).forEach((key, i) => {
      const old = previous[i];
      if (old === undefined) delete process.env[key];
      else process.env[key] = old;
    });
  }
});
