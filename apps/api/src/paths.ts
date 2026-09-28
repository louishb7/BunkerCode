import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
export function projectRoot(): string {
  let path = resolve(__dirname);
  while (!existsSync(join(path, "pnpm-workspace.yaml"))) {
    const parent = dirname(path);
    if (parent === path) throw new Error("BunkerLab root not found");
    path = parent;
  }
  return path;
}
export const dataRoot = () =>
  resolve(process.env.BUNKERLAB_DATA_DIR ?? join(projectRoot(), ".bunkerlab"));
