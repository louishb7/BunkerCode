import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLesson as createContentLesson } from "../packages/content/dist/authoring.js";

export function createLesson({
  course,
  slug,
  title,
  contentRoot = process.env.BUNKERCODE_CONTENT_DIR ??
    fileURLToPath(new URL("../content", import.meta.url)),
}) {
  return createContentLesson(
    course,
    { slug, title },
    resolve(contentRoot, "courses"),
  );
}
function argumentsOf(values) {
  const options = {};
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index]?.replace(/^--/, "");
    if (
      !["course", "slug", "title"].includes(key) ||
      key in options ||
      values[index + 1] === undefined
    )
      throw new Error(
        'Uso: pnpm lesson:new --course typescript --slug topic --title "Título"',
      );
    options[key] = values[index + 1];
  }
  return options;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    console.log(
      "Lição criada: " + createLesson(argumentsOf(process.argv.slice(2))),
    );
    console.log(
      "Edite o Markdown, recarregue o site e revise seu diff antes do commit.",
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
