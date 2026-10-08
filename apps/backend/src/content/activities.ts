import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { NotFoundException } from "@nestjs/common";
import type { LearningActivity } from "../learning/models";
// Explicit resource path supports both src and dist; no legacy root discovery.
const defaultRoot = resolve(__dirname, "../../../..", "content");
export const contentRoot = resolve(
  process.env.BUNKERCODE_CONTENT_DIR ?? defaultRoot,
  "activities",
);
const ids = ["order-acceptance", "reserve-stock"] as const;
export function activity(id: string): LearningActivity {
  if (!ids.some((known) => known === id))
    throw new NotFoundException("Atividade não encontrada.");
  const definition: Omit<LearningActivity, "starter"> = JSON.parse(
    readFileSync(resolve(contentRoot, id, "activity.json"), "utf8"),
  );
  return {
    ...definition,
    starter: readFileSync(resolve(contentRoot, id, "starter.ts"), "utf8"),
  };
}
export function activities() {
  return ids.map(activity);
}
export function harnessPath(id: string) {
  activity(id);
  return resolve(
    contentRoot,
    id,
    id === "order-acceptance" ? "harness.cjs" : "tests.cjs",
  );
}
export const digest = (source: string) =>
  createHash("sha256").update(source, "utf8").digest("hex");

export function harnessDigest(id: string) {
  return digest(readFileSync(harnessPath(id), "utf8"));
}
