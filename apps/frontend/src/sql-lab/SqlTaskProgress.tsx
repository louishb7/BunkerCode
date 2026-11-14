import { Check, ArrowRight } from "lucide-react";
import { Link } from "react-router";
import type { SqlLessonTask } from "./exercise";
type TaskPresentation = {
  taskId: string;
  exercise: Pick<SqlLessonTask["exercise"], "title">;
};

export function SqlTaskInstruction({
  title,
  instructions,
}: {
  title: string;
  instructions: string;
}) {
  return (
    <div className="sql-current-task">
      <h3>{title}</h3>
      <p>{instructions}</p>
    </div>
  );
}
export interface SqlContinuation {
  to: string;
  label: string;
}
export function SqlTaskProgress({
  tasks,
  activeId,
  completed,
  notice,
  onSelect,
  continuation,
  compact = false,
}: {
  tasks: readonly TaskPresentation[];
  activeId: string;
  completed: ReadonlySet<string>;
  notice: string;
  onSelect: (taskId: string) => void;
  continuation?: SqlContinuation;
  compact?: boolean;
}) {
  const allCompleted = completed.size === tasks.length;
  return (
    <section className="sql-task-progress" aria-label="Tarefas da lição">
      <div className="sql-task-summary">
        <h2>Tarefas da lição</h2>
        <span>
          {completed.size} de {tasks.length} concluídas
        </span>
      </div>
      <ol className="sql-task-list" role="list">
        {tasks.map((task, index) => (
          <li key={task.taskId}>
            <button
              type="button"
              data-completed={completed.has(task.taskId) || undefined}
              aria-current={task.taskId === activeId ? "step" : undefined}
              onClick={() => onSelect(task.taskId)}
            >
              <span className="sql-task-number">
                {completed.has(task.taskId) ? (
                  <Check size={17} aria-hidden="true" />
                ) : (
                  index + 1
                )}
              </span>
              <span>{task.exercise.title}</span>
              <span className="sql-task-state">
                {completed.has(task.taskId)
                  ? task.taskId === activeId
                    ? "Concluída · ativa"
                    : "Concluída"
                  : task.taskId === activeId
                    ? "Ativa"
                    : "Pendente"}
              </span>
            </button>
          </li>
        ))}
      </ol>
      {notice && !compact && <p className="sql-task-notice">{notice}</p>}
      <div className="sql-actions">
        {allCompleted && continuation && (
          <Link className="sql-task-continue" to={continuation.to}>
            {continuation.label}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        )}
      </div>
      {allCompleted && !compact && (
        <p className="sql-task-finished">
          Todas as tarefas foram concluídas nesta prática local. A conclusão
          verificada desta lição ainda não está disponível.
        </p>
      )}
    </section>
  );
}
