import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { parentPort, workerData } from "node:worker_threads";
const libraryDirectory = dirname(require.resolve("typescript"));
const libraries: Record<string, string> = Object.fromEntries(
  readdirSync(libraryDirectory)
    .filter((name) =>
      /^lib\.(?:es.*|decorators(?:\.legacy)?)\.d\.ts$/.test(name),
    )
    .map((name) => [
      "/" + name,
      readFileSync(join(libraryDirectory, name), "utf8"),
    ]),
);
export interface CodeDiagnostic {
  category: "syntax" | "semantic" | "options";
  code: number;
  message: string;
  line?: number;
  column?: number;
}
export interface Compilation {
  diagnostics: CodeDiagnostic[];
  javascript: string;
  version: string;
}
export function compileCode(
  code: string,
  language: "typescript" | "javascript",
): Compilation {
  if (new TextEncoder().encode(code).length > 65536)
    throw new Error("Código excede 64 KiB.");
  const filename = language === "typescript" ? "/solution.ts" : "/solution.js";
  const files: Record<string, string> = {
    ...libraries,
    [filename]: code,
    "/console.d.ts":
      "declare const console: { log(...values: unknown[]): void; info(...values: unknown[]): void; warn(...values: unknown[]): void; error(...values: unknown[]): void; };",
  };
  const options: ts.CompilerOptions = {
    strict: true,
    outDir: "/generated",
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
    noEmitOnError: true,
    allowJs: language === "javascript",
    checkJs: language === "javascript",
    skipLibCheck: false,
    types: [],
  };
  let output = "";
  const host: ts.CompilerHost = {
    getSourceFile: (path, target) =>
      files[path] === undefined
        ? undefined
        : ts.createSourceFile(path, files[path], target, true),
    getDefaultLibFileName: () => "/lib.es2022.d.ts",
    writeFile: (path, text) => {
      if (path.endsWith(".js")) output = text;
    },
    getCurrentDirectory: () => "/",
    getDirectories: () => [],
    fileExists: (path) => files[path] !== undefined,
    readFile: (path) => files[path],
    getCanonicalFileName: (path) => path,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
  };
  const program = ts.createProgram([filename, "/console.d.ts"], options, host);
  const diagnostics: CodeDiagnostic[] = [];
  const add = (
    category: CodeDiagnostic["category"],
    values: readonly ts.Diagnostic[],
  ) => {
    for (const item of values) {
      if (diagnostics.length >= 100) break;
      const position =
        item.file && item.start !== undefined
          ? item.file.getLineAndCharacterOfPosition(item.start)
          : undefined;
      diagnostics.push({
        category,
        code: item.code,
        message: ts.flattenDiagnosticMessageText(item.messageText, "\n"),
        line: position ? position.line + 1 : undefined,
        column: position ? position.character + 1 : undefined,
      });
    }
  };
  add("options", program.getOptionsDiagnostics());
  add("syntax", program.getSyntacticDiagnostics());
  add("semantic", program.getSemanticDiagnostics());
  if (!diagnostics.length) program.emit();
  return { diagnostics, javascript: output, version: ts.version };
}

const request = workerData as {
  source: string;
  language: "typescript" | "javascript";
};
parentPort?.postMessage(compileCode(request.source, request.language));
