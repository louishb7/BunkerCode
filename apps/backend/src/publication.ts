import {
  accessSync,
  constants,
  lstatSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { readManifestSource } from "@bunkercode/content/manifest";
import { validSlug } from "@bunkercode/content";
import { loadCourse, loadLesson } from "./content/courses";
import { loadExercise } from "./content/exercise";

export function publicationSelection(value: unknown): string[] {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== 1 ||
    !("courses" in value) ||
    !Array.isArray(value.courses) ||
    !value.courses.every(
      (id: unknown) => typeof id === "string" && validSlug(id),
    ) ||
    new Set(value.courses).size !== value.courses.length
  )
    throw new Error(
      'Publication selection must be exactly { "courses": [unique valid course IDs] }',
    );
  return [...value.courses] as string[];
}
export function readPublicationSelection(file: string): string[] {
  return publicationSelection(JSON.parse(readManifestSource(file).text));
}

export function publicationInventory(
  root: string,
  readOnly: boolean,
): string[] {
  if (realpathSync(root) !== resolve(root))
    throw new Error("Publication symlinks are forbidden");
  const entries: string[] = [];
  function walk(path: string) {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile()))
      throw new Error(
        "Publication requires regular files and directories without symlinks",
      );
    if (readOnly) {
      let writable = true;
      try {
        accessSync(path, constants.W_OK);
      } catch (error) {
        if (
          (error as NodeJS.ErrnoException).code !== "EACCES" &&
          (error as NodeJS.ErrnoException).code !== "EROFS"
        )
          throw error;
        writable = false;
      }
      if (writable)
        throw new Error(
          "Public content must be read-only for the service user",
        );
    }
    if (path !== root) entries.push(relative(root, path).split(sep).join("/"));
    if (stat.isDirectory())
      for (const name of readdirSync(path)) walk(join(path, name));
  }
  walk(root);
  return entries.sort();
}

export function selectedPublicationFiles(
  source: string,
  courses: readonly string[],
): string[] {
  const root = join(source, "courses");
  const files: string[] = [];
  for (const id of courses) {
    const course = loadCourse(id, root);
    files.push(`courses/${id}/course.json`);
    for (const lesson of course.lessons) {
      loadLesson(id, lesson.slug, root);
      files.push(`courses/${id}/lessons/${lesson.slug}/lesson.md`);
      if (loadExercise(id, lesson.slug, root))
        files.push(`courses/${id}/lessons/${lesson.slug}/exercise.json`);
    }
  }
  return files;
}
function expectedEntries(files: readonly string[]): string[] {
  const entries = new Set(["publication.json", "courses"]);
  for (const file of files) {
    entries.add(file);
    let parent = dirname(file);
    while (parent !== ".") {
      entries.add(parent);
      parent = dirname(parent);
    }
  }
  return [...entries].sort();
}

// Startup refuses the canonical authoring tree and incomplete/writable snapshots.
export function validatePublication(directory: string): string[] {
  const entries = publicationInventory(directory, true);
  const courses = readPublicationSelection(join(directory, "publication.json"));
  const expected = expectedEntries(
    selectedPublicationFiles(directory, courses),
  );
  if (JSON.stringify(entries) !== JSON.stringify(expected))
    throw new Error("Publication contains missing or unselected files");
  return courses;
}
