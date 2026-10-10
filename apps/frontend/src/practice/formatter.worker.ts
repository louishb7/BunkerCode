import { format } from "prettier/standalone";
import { diff } from "@codemirror/merge";

export interface FormattedCode {
  code: string;
  changes: { from: number; to: number; insert: string }[];
}
import typescript from "prettier/plugins/typescript";
import babel from "prettier/plugins/babel";
import estree from "prettier/plugins/estree";
self.onmessage = async (
  event: MessageEvent<{ code: string; language: "typescript" | "javascript" }>,
) => {
  try {
    if (new TextEncoder().encode(event.data.code).length > 65536)
      throw new Error("Código excede 64 KiB.");
    const result = await format(event.data.code, {
      parser: event.data.language === "typescript" ? "typescript" : "babel",
      plugins: [typescript, babel, estree],
      tabWidth: 2,
    });
    const formatted: FormattedCode = {
      code: result,
      changes: diff(event.data.code, result).map(
        ({ fromA, toA, fromB, toB }) => ({
          from: fromA,
          to: toA,
          insert: result.slice(fromB, toB),
        }),
      ),
    };
    self.postMessage({ result: formatted });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "Falha de formatação.",
    });
  }
};
