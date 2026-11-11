import { copyFileSync } from "node:fs";
copyFileSync(
  new URL("../apps/backend/src/sql/runner-main.cjs", import.meta.url),
  new URL("../apps/backend/dist/sql/runner-main.cjs", import.meta.url),
);
