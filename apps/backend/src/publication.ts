import {
  accessSync,
  constants,
  lstatSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { readManifestSource } from "@bunkercode/content/manifest";
import { type Course, validSlug } from "@bunkercode/content";
import { loadCourse, loadLesson } from "./content/courses";
import { loadExercise } from "./content/exercise";

export type PublicationCourse = string | { id: string; lessons: string[] };

export function publicationSelection(value: unknown): PublicationCourse[] {
  const invalid = (): never => {
    throw new Error(
      "Publication selection requires unique courses and explicit nonempty lesson lists for partial courses",
    );
  };
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== 1 ||
    !("courses" in value) ||
    !Array.isArray(value.courses)
  )
    return invalid();
  const courses: PublicationCourse[] = [];
  for (const entry of value.courses as unknown[]) {
    if (typeof entry === "string" && validSlug(entry)) courses.push(entry);
    else {
      if (
        !entry ||
        typeof entry !== "object" ||
        Array.isArray(entry) ||
        Object.keys(entry).length !== 2 ||
        !("id" in entry) ||
        typeof entry.id !== "string" ||
        !validSlug(entry.id) ||
        !("lessons" in entry) ||
        !Array.isArray(entry.lessons) ||
        entry.lessons.length === 0 ||
        !entry.lessons.every(
          (slug: unknown) => typeof slug === "string" && validSlug(slug),
        ) ||
        new Set(entry.lessons).size !== entry.lessons.length
      )
        return invalid();
      courses.push({ id: entry.id, lessons: [...entry.lessons] as string[] });
    }
  }
  if (new Set(courses.map(publicationCourseId)).size !== courses.length)
    return invalid();
  return courses;
}
export function publicationCourseId(course: PublicationCourse): string {
  return typeof course === "string" ? course : course.id;
}
export function readPublicationSelection(file: string): PublicationCourse[] {
  return publicationSelection(JSON.parse(readManifestSource(file).text));
}

// Projection is derived from the canonical manifest; never maintain a second editorial source.
export function publicationCourse(
  source: string,
  selection: PublicationCourse,
): Course {
  const course = loadCourse(
    publicationCourseId(selection),
    join(source, "courses"),
  );
  if (typeof selection === "string") return course;
  for (const slug of selection.lessons)
    if (!course.lessons.some((lesson) => lesson.slug === slug))
      throw new Error(`Unknown publication lesson: ${selection.id}/${slug}`);
  const lessons = course.lessons.filter((lesson) =>
    selection.lessons.includes(lesson.slug),
  );
  const projected = { ...course, lessons };
  if (course.modules)
    projected.modules = course.modules.filter((module) =>
      lessons.some((lesson) => lesson.moduleId === module.id),
    );
  return projected;
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
  courses: readonly PublicationCourse[],
): string[] {
  const root = join(source, "courses");
  const files: string[] = [];
  for (const selection of courses) {
    const id = publicationCourseId(selection);
    const course = publicationCourse(source, selection);
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
  for (const selection of courses) {
    const id = publicationCourseId(selection);
    if (
      JSON.stringify(loadCourse(id, join(directory, "courses"))) !==
      JSON.stringify(publicationCourse(directory, selection))
    )
      throw new Error(
        "Publication manifest contains unselected lessons or modules",
      );
  }
  return courses.map(publicationCourseId);
}
