import { parseSqlPlacement } from "@bunkercode/content";
import { resolveSqlExercise } from "./exercise-catalog";
import { SqlInteraction } from "./SqlInteraction";

// Shared Markdown preview path used by Studio; no routing or completion callbacks.
export default function SqlLessonActivity({ source }: { source: string }) {
  try {
    const reference = parseSqlPlacement(JSON.parse(source));
    return <SqlInteraction exercise={resolveSqlExercise(reference)} />;
  } catch (error) {
    return (
      <p role="alert">
        {error instanceof Error ? error.message : "Atividade SQL inválida."}
      </p>
    );
  }
}
