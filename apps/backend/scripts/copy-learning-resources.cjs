const { copyFileSync, mkdirSync } = require("node:fs");
mkdirSync("dist/execution", { recursive: true });
copyFileSync("src/execution/supervisor.cjs", "dist/execution/supervisor.cjs");
