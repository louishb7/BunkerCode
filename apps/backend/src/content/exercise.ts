import {
  constants,
  openSync,
  fstatSync,
  readSync,
  closeSync,
  lstatSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { isUtf8 } from "node:buffer";
import { createHash } from "node:crypto";
import { UnprocessableEntityException } from "@nestjs/common";
import { lessonLocation, validSlug, coursesRoot } from "./courses";

export interface Exercise {
  id: string;
  title: string;
  objective: string;
  instructions: string;
  language: "typescript" | "javascript";
  starterCode: string;
  expected: string;
  revision: string;
}
const limit = 64 * 1024;
function invalid(): never {
  throw new UnprocessableEntityException(
    "Exercício inválido: use exercise.json UTF-8 regular de até 64 KiB, com os campos editoriais documentados.",
  );
}
export function parseExercise(value: unknown): Omit<Exercise, "revision"> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  const item = value as Record<string, unknown>;
  const fields = [
    "id",
    "title",
    "objective",
    "instructions",
    "language",
    "starterCode",
    "expected",
  ];
  if (
    Object.keys(item).some((key) => !fields.includes(key)) ||
    !validSlug(item.id) ||
    (item.language !== "typescript" && item.language !== "javascript")
  )
    invalid();
  function text(key: string, max: number, empty = false): string {
    const value = item[key];
    if (
      typeof value !== "string" ||
      (!empty && !value.trim()) ||
      Buffer.byteLength(value, "utf8") > max
    )
      invalid();
    return value;
  }
  if (text("title", 640).length > 160) invalid();
  return {
    id: item.id,
    language: item.language,
    title: text("title", 640),
    objective: text("objective", 2000),
    instructions: text("instructions", 12000),
    starterCode: text("starterCode", 32768, true),
    expected: text("expected", 4000),
  };
}
export function loadExercise(
  id: string,
  slug: string,
  root = coursesRoot(),
): Exercise | null {
  const { path } = lessonLocation(id, slug, root);
  const file = join(dirname(path), "exercise.json");
  try {
    lstatSync(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    invalid();
  }
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      file,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const stat = fstatSync(descriptor);
    if (!stat.isFile() || stat.size > limit) invalid();
    const buffer = Buffer.alloc(limit + 1);
    let count = 0;
    while (count < buffer.length) {
      const size = readSync(
        descriptor,
        buffer,
        count,
        buffer.length - count,
        count,
      );
      if (!size) break;
      count += size;
    }
    const bytes = buffer.subarray(0, count);
    if (count > limit || !isUtf8(bytes)) invalid();
    return {
      ...parseExercise(JSON.parse(bytes.toString("utf8"))),
      revision: createHash("sha256").update(bytes).digest("hex"),
    };
  } catch {
    return invalid();
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}
