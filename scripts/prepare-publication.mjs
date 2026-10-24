import { resolve } from "node:path";
import { preparePublication } from "../apps/backend/dist/publication-preparation.js";
import { readPublicationSelection } from "../apps/backend/dist/publication.js";

const [
  destination,
  selection = "config/publication.json",
  source = "content",
  ...extra
] = process.argv.slice(2);
if (!destination || extra.length)
  throw new Error(
    "Usage: pnpm publication:prepare <new-output-directory> [selection.json] [source-content-directory]",
  );
preparePublication(
  resolve(source),
  { courses: readPublicationSelection(selection) },
  resolve(destination),
);
console.log(
  `Publicação preparada em ${resolve(destination)} (somente leitura).`,
);
