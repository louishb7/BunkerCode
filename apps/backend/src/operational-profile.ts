import { resolve } from "node:path";
import { coursesRoot } from "./content/courses";
import { validatePublication } from "./publication";

export type OperationalConfig = Readonly<
  | { profile: "authoring"; root: string }
  | { profile: "public"; root: string; published: readonly string[] }
>;

// Captured once at bootstrap. Request data never participates in this decision.
export function operationalConfig(): OperationalConfig {
  if (process.env.BUNKERCODE_PROFILE === "authoring")
    return Object.freeze({ profile: "authoring", root: coursesRoot() });
  if (process.env.BUNKERCODE_PROFILE !== "public")
    throw new Error(
      "BUNKERCODE_PROFILE must explicitly be authoring or public",
    );
  if (!process.env.BUNKERCODE_CONTENT_DIR)
    throw new Error(
      "Public profile requires BUNKERCODE_CONTENT_DIR (read-only publication snapshot)",
    );
  const directory = resolve(process.env.BUNKERCODE_CONTENT_DIR);
  const published = Object.freeze(validatePublication(directory));
  return Object.freeze({
    profile: "public",
    root: resolve(directory, "courses"),
    published,
  });
}
