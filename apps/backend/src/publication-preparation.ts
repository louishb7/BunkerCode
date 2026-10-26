import {
  chmodSync,
  constants,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import {
  publicationSelection,
  publicationInventory,
  selectedPublicationFiles,
  publicationCourse,
  publicationCourseId,
} from "./publication";

// Copies only declared public payloads, never entire course folders or static assets.
// The destination is exclusive: existing directories are never adopted or removed.
export function preparePublication(
  source: string,
  selection: unknown,
  destination: string,
) {
  const courses = publicationSelection(selection);
  source = realpathSync(source);
  destination = join(
    realpathSync(dirname(resolve(destination))),
    basename(resolve(destination)),
  );
  if (
    destination === source ||
    destination.startsWith(source + sep) ||
    source.startsWith(destination + sep)
  )
    throw new Error(
      "Publication destination must not overlap authoring content",
    );
  if (existsSync(destination))
    throw new Error("Publication destination must be new");
  const files = selectedPublicationFiles(source, courses);
  mkdirSync(destination, { mode: 0o700 });
  mkdirSync(join(destination, "courses"));
  for (const file of files) {
    mkdirSync(dirname(join(destination, file)), { recursive: true });
    copyFileSync(
      join(source, file),
      join(destination, file),
      constants.COPYFILE_EXCL,
    );
  }
  // Only the generated snapshot manifest is projected; authoring stays untouched.
  for (const selection of courses) {
    if (typeof selection === "string") continue;
    writeFileSync(
      join(
        destination,
        "courses",
        publicationCourseId(selection),
        "course.json",
      ),
      JSON.stringify(publicationCourse(source, selection), null, 2) + "\n",
    );
  }
  writeFileSync(
    join(destination, "publication.json"),
    JSON.stringify({ courses }, null, 2) + "\n",
    { flag: "wx" },
  );
  for (const entry of publicationInventory(destination, false).reverse()) {
    const path = join(destination, entry);
    chmodSync(path, lstatSync(path).isDirectory() ? 0o555 : 0o444);
  }
  chmodSync(destination, 0o555);
}
