import { format } from "prettier/standalone";
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
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "Falha de formatação.",
    });
  }
};
