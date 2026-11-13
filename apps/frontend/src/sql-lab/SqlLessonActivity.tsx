import {
  parseSqlPlacement,
  type SqlLessonPlacement,
} from "@bunkercode/content";
import { useSqlActivity } from "./api";
import { SqlInteraction } from "./SqlInteraction";

// Shared Markdown preview path used by Studio; no routing or completion callbacks.
export default function SqlLessonActivity({ source }: { source: string }) {
  try {
    const reference = parseSqlPlacement(JSON.parse(source));
    return <Activity reference={reference} />;
  } catch (error) {
    return (
      <p role="alert">
        {error instanceof Error ? error.message : "Atividade SQL inválida."}
      </p>
    );
  }
}

function Activity({ reference }: { reference: SqlLessonPlacement }) {
  const { data, error } = useSqlActivity(reference);
  return data ? (
    <SqlInteraction exercise={data.exercise} tasks={data.tasks} />
  ) : (
    <p role={error ? "alert" : "status"}>
      {error || "Carregando atividade SQL…"}
    </p>
  );
}
