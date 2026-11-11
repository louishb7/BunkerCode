import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  cpSync,
  readFileSync,
  writeFileSync,
  realpathSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
const root = new URL("../", import.meta.url);
const require = createRequire(
  new URL("../packages/content/package.json", import.meta.url),
);
const context = mkdtempSync(join(tmpdir(), "bunkercode-sql-image-"));
mkdirSync(join(context, "content"));
const hash = createHash("sha256");
for (const file of ["sql.js", "sql-engine.js", "sql-grading.js"]) {
  const from = new URL("packages/content/dist/" + file, root);
  hash.update(readFileSync(from));
  copyFileSync(from, join(context, "content", file));
}
const main = new URL("apps/backend/src/sql/runner-main.cjs", root);
hash.update(readFileSync(main));
copyFileSync(main, join(context, "main.cjs"));
const dependency = realpathSync(
  join(require.resolve("@electric-sql/pglite"), "../.."),
);
cpSync(dependency, join(context, "node_modules/@electric-sql/pglite"), {
  recursive: true,
});
hash.update(readFileSync(join(dependency, "package.json")));
const revision = hash.digest("hex");
writeFileSync(
  join(context, "Dockerfile"),
  `FROM node@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1\nLABEL bunkercode.sql.revision="${revision}"\nCOPY --chown=65534:65534 . /app\nUSER 65534:65534\nWORKDIR /tmp\nENTRYPOINT ["node","--max-old-space-size=192","--expose-gc","/app/main.cjs"]\n`,
);
const result = spawnSync(
  "docker",
  [
    "build",
    "--network=none",
    "--pull=false",
    "--tag",
    "bunkercode-sql:local",
    context,
  ],
  { stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("SQL image revision:", revision);
console.log("Build context preserved:", context);
