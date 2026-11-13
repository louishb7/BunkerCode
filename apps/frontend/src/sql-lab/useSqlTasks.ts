import { useRef, useState } from "react";
import type { SqlExercise, SqlLessonTask } from "./exercise";

// Ephemeral UI state only. A task's identity never depends on its array position.
export function useSqlTasks(
  initial: SqlExercise,
  tasks?: readonly SqlLessonTask[],
) {
  const [activeId, setActiveId] = useState(tasks?.[0]?.taskId ?? "single");
  const active = useRef(activeId);
  const drafts = useRef(new Map<string, string>());
  const completedRef = useRef(new Set<string>());
  const [completed, setCompleted] = useState<ReadonlySet<string>>(new Set());
  const [notice, setNotice] = useState("");
  const index = tasks?.findIndex((task) => task.taskId === activeId) ?? 0;
  const exercise = tasks?.[index]?.exercise ?? initial;

  function select(taskId: string, currentSql: string) {
    const target = tasks?.find((task) => task.taskId === taskId);
    if (!target) throw new Error("Tarefa SQL não encontrada.");
    drafts.current.set(active.current, currentSql);
    active.current = taskId;
    setActiveId(taskId);
    return drafts.current.get(taskId) ?? target.exercise.starterSql;
  }
  function complete(taskId: string) {
    if (!tasks || active.current !== taskId) return;
    const position = tasks.findIndex((task) => task.taskId === taskId);
    if (position < 0) return;
    const done = new Set(completedRef.current).add(taskId);
    completedRef.current = done;
    setCompleted(done);
    const next = [
      ...tasks.slice(position + 1),
      ...tasks.slice(0, position),
    ].find((task) => !done.has(task.taskId));
    setNotice(`Tarefa ${position + 1} concluída nesta sessão.`);
    return next;
  }
  function restart() {
    drafts.current.clear();
    completedRef.current = new Set();
    setCompleted(new Set());
    active.current = tasks?.[0]?.taskId ?? "single";
    setActiveId(active.current);
    setNotice("");
    return initial.starterSql;
  }
  return {
    tasks,
    active,
    index,
    exercise,
    completed,
    notice,
    select,
    complete,
    restart,
    remember(sql: string) {
      drafts.current.set(active.current, sql);
    },
  };
}
