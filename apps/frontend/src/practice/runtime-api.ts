export interface RuntimeStatus {
  available: boolean;
  reason: string;
}
export interface RunResult {
  id: string;
  sourceHash: string;
  state: "success" | "error" | "timeout" | "cancelled" | "output-limit";
  stdout: string;
  stderr: string;
  exitCode: number | null;
}
const headers = {
  "content-type": "application/json",
  "x-bunkercode-client": "local",
};
export async function runtimeStatus(
  signal: AbortSignal,
): Promise<RuntimeStatus> {
  const response = await fetch("/api/practice/runtime", { signal });
  const value: unknown = await response.json();
  if (
    !response.ok ||
    !value ||
    typeof value !== "object" ||
    typeof (value as RuntimeStatus).available !== "boolean" ||
    typeof (value as RuntimeStatus).reason !== "string"
  )
    throw new Error("Não foi possível verificar Run.");
  return value as RuntimeStatus;
}
export async function runSolution(
  value: {
    id: string;
    course: string;
    lesson: string;
    exercise: string;
    revision: string;
    source: string;
    javascript: string;
  },
  signal: AbortSignal,
): Promise<RunResult> {
  const response = await fetch("/api/practice/runs", {
    method: "POST",
    headers,
    body: JSON.stringify(value),
    signal,
  });
  const result: unknown = await response.json();
  if (!response.ok)
    throw new Error(
      result &&
        typeof result === "object" &&
        typeof (result as { message?: unknown }).message === "string"
        ? (result as { message: string }).message
        : "Falha de execução.",
    );
  if (!result || typeof result !== "object")
    throw new Error("Resposta de execução incompatível.");
  const r = result as Partial<RunResult>;
  if (
    r.id !== value.id ||
    typeof r.sourceHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(r.sourceHash) ||
    typeof r.stdout !== "string" ||
    typeof r.stderr !== "string" ||
    !["success", "error", "timeout", "cancelled", "output-limit"].includes(
      r.state ?? "",
    ) ||
    (r.exitCode !== null && !Number.isSafeInteger(r.exitCode))
  )
    throw new Error("Resposta de execução incompatível.");
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(value.source),
      ),
    ),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  if (hash !== r.sourceHash)
    throw new Error("O resultado não corresponde ao código solicitado.");
  return r as RunResult;
}
export async function cancelSolution(id: string) {
  const response = await fetch("/api/practice/runs/" + encodeURIComponent(id), {
    method: "DELETE",
    headers,
    body: "{}",
    keepalive: true,
  });
  if (!response.ok)
    throw new Error(
      "Não foi possível confirmar o cancelamento. O timeout do runner continua ativo.",
    );
}
