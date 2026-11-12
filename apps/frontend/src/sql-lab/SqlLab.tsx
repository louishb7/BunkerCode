import { Page } from "../courses/Page";
import { SqlInteraction } from "./SqlInteraction";
import { useEffect, useState } from "react";
import { sqlRequest } from "./api";
import {
  parsePublicSqlExercise,
  type PublicSqlExercise,
} from "@bunkercode/content/sql";
import "./sql-lab.css";

export default function SqlLab() {
  const [sqlExercises, setExercises] = useState<PublicSqlExercise[]>([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    void sqlRequest("/exercises", "GET", undefined, abort.signal)
      .then((value) => {
        if (!Array.isArray(value)) throw new Error("Catálogo SQL inválido.");
        const data = value.map(parsePublicSqlExercise);
        setExercises(data);
        setLoaded(true);
        setSelected(data[0]?.id ?? "");
      })
      .catch((error: unknown) => {
        if (!abort.signal.aborted)
          setError(
            error instanceof Error ? error.message : "Catálogo indisponível.",
          );
      });
    return () => abort.abort();
  }, []);
  const exercise = sqlExercises.find((item) => item.id === selected);
  return (
    <Page title="Laboratório SQL" className="sql-lab">
      <header>
        <h1>Laboratório SQL</h1>
        <p>
          Vitrine temporária de atividades SQL selecionadas. Explore os dados
          fictícios para experimentar consultas e alterações.
        </p>
      </header>
      <label className="sql-exercise-selector">
        Atividade demonstrativa
        <select
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          {sqlExercises.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
      {exercise ? (
        <SqlInteraction exercise={exercise} />
      ) : (
        <p role="status">
          {error
            ? "Recarregue para tentar novamente."
            : loaded
              ? "Nenhuma atividade SQL selecionada para o laboratório."
              : "Carregando catálogo SQL…"}
        </p>
      )}
    </Page>
  );
}
