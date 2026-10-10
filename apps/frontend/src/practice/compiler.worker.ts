import { compileCode } from "./compiler";
self.onmessage = (
  event: MessageEvent<{ code: string; language: "typescript" | "javascript" }>,
) => {
  try {
    self.postMessage({
      result: compileCode(event.data.code, event.data.language),
    });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "Falha de compilação.",
    });
  }
};
