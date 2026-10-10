import { parseExerciseTests, type ExerciseTests } from "@bunkercode/content";
import {
  incompatibleContent,
  isContentSlug,
  isContentTitle,
} from "../courses/api";
export interface Exercise {
  id: string;
  title: string;
  objective: string;
  instructions: string;
  language: "typescript" | "javascript";
  starterCode: string;
  expected: string;
  revision: string;
  tests?: ExerciseTests;
}
export function parseExercise(value: unknown): { exercise: Exercise | null } {
  if (!value || typeof value !== "object" || !("exercise" in value))
    throw new Error(incompatibleContent);
  value = value.exercise;
  if (value === null) return { exercise: null };
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(incompatibleContent);
  const item = value as Record<string, unknown>;
  const bounded = (key: string, limit: number, empty = false) =>
    typeof item[key] === "string" &&
    (empty || !!item[key].trim()) &&
    new TextEncoder().encode(item[key]).length <= limit;
  if (
    !isContentSlug(item.id) ||
    !isContentTitle(item.title) ||
    !bounded("objective", 2000) ||
    !bounded("instructions", 12000) ||
    !bounded("expected", 4000) ||
    !bounded("starterCode", 32768, true) ||
    (item.language !== "typescript" && item.language !== "javascript") ||
    typeof item.revision !== "string" ||
    !/^[a-f0-9]{64}$/.test(item.revision)
  )
    throw new Error(incompatibleContent);
  if (item.tests !== undefined) item.tests = parseExerciseTests(item.tests);
  return { exercise: item as unknown as Exercise };
}
