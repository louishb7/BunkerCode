import { useEffect, useState } from "react";
import { sqlRequest } from "./api";
import { sqlId, sqlObject, sqlVersion } from "@bunkercode/content/sql";
import type { SqlPlacement } from "@bunkercode/content";
export function SqlExercisePicker({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (reference: SqlPlacement) => void;
}) {
  const [references, setReferences] = useState<
    { id: string; version: number; title: string }[]
  >([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    void sqlRequest("/references", "GET", undefined, abort.signal)
      .then((value) => {
        if (!Array.isArray(value)) throw new Error("Lista SQL inválida.");
        setReferences(
          value.map((value) => {
            const item = sqlObject(value, ["id", "version", "title"]);
            if (typeof item.title !== "string" || item.title.length > 160)
              throw new Error("Título SQL inválido.");
            return {
              id: sqlId(item.id),
              version: sqlVersion(item.version),
              title: item.title,
            };
          }),
        );
      })
      .catch(() => {
        if (!abort.signal.aborted)
          setError(
            "Não foi possível consultar atividades publicadas. Recarregue para tentar novamente.",
          );
      });
    return () => abort.abort();
  }, []);
  return (
    <section className="studio-sql-picker" aria-label="Vincular atividade SQL">
      <label>
        Atividade SQL publicada
        <select
          aria-label="Atividade SQL publicada"
          value=""
          disabled={disabled || !references.length}
          onChange={(e) => {
            const ref = references.find(
              (ref) => ref.id + "/" + ref.version === e.target.value,
            );
            if (ref)
              onSelect({
                kind: "sql",
                exerciseId: ref.id,
                version: ref.version,
              });
          }}
        >
          <option value="">Selecionar para inserir ou substituir…</option>
          {references.map((ref) => (
            <option
              key={ref.id + "/" + ref.version}
              value={ref.id + "/" + ref.version}
            >
              {ref.title} · {ref.id} · v{ref.version}
            </option>
          ))}
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
