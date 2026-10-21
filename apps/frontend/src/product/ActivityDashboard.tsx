import { useEffect, useRef, useState } from "react";
import { calendarDays, readActivity, type Activity } from "./activity-store";
const dateLabel = (day: string) =>
  new Date(day + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const monthLabel = (day: string) =>
  new Date(day + "T12:00:00")
    .toLocaleDateString("pt-BR", { month: "short" })
    .replace(/\.$/, "")
    .replace(/^./, (letter) => letter.toLocaleUpperCase("pt-BR"));
export function ActivityDashboard() {
  const [records, setRecords] = useState<Activity[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState("");
  const [now, setNow] = useState(() => new Date());
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true,
      sequence = 0;
    const reload = () => {
      const id = ++sequence;
      setNow(new Date());
      void readActivity()
        .then((data) => {
          if (alive && id === sequence) {
            setRecords(data);
            setError("");
            setLoading(false);
          }
        })
        .catch((failure: unknown) => {
          if (alive && id === sequence) {
            setError(
              failure instanceof Error
                ? failure.message
                : "Falha ao ler atividade.",
            );
            setLoading(false);
          }
        });
    };
    reload();
    const channel =
      typeof BroadcastChannel === "undefined"
        ? undefined
        : new BroadcastChannel("bunkercode-activity");
    if (channel) channel.onmessage = reload;
    window.addEventListener("focus", reload);
    window.addEventListener("bunkercode:activity", reload);
    const timer = window.setInterval(reload, 60_000);
    return () => {
      alive = false;
      channel?.close();
      clearInterval(timer);
      window.removeEventListener("focus", reload);
      window.removeEventListener("bunkercode:activity", reload);
    };
  }, []);
  const calendar = calendarDays(now);
  const period = records.filter(
    (r) => r.day >= calendar.start && r.day <= calendar.end,
  );
  const groups = new Map<string, Activity[]>();
  for (const record of period)
    groups.set(record.day, [...(groups.get(record.day) ?? []), record]);
  const months: { day: string; week: number }[] = [];
  let previousMonth = "";
  calendar.days.forEach((day, index) => {
    if (!day || day.slice(0, 7) === previousMonth) return;
    previousMonth = day.slice(0, 7);
    // Separate labels even when the first partial month ends in the same week.
    months.push({
      day,
      week: Math.max(Math.floor(index / 7), (months.at(-1)?.week ?? -2) + 2),
    });
  });
  const focusDay = calendar.days.includes(selected) ? selected : calendar.end;
  const description = (day: string) => {
    const values = groups.get(day) ?? [];
    return `${values.length} ${values.length === 1 ? "atividade" : "atividades"} em ${dateLabel(day)}.`;
  };
  return (
    <section aria-labelledby="activity-title" className="activity-dashboard">
      <div className="activity-summary">
        <p className="eyebrow">Atividade local</p>
        <h2 id="activity-title" className="activity-title">
          {error || loading
            ? "Atividade"
            : `${period.length} ${period.length === 1 ? "atividade" : "atividades"} nos últimos seis meses`}
        </h2>
        {!error && !loading && (
          <p className="activity-context">
            {period.length
              ? "Seus registros neste navegador."
              : "Ainda não há registros neste período."}
          </p>
        )}
        {!error && !loading && (
          <p className="activity-period">
            {dateLabel(calendar.start)} — {dateLabel(calendar.end)}
          </p>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-sm">
          {error} O calendário não confirma dados indisponíveis.
        </p>
      ) : loading ? (
        <p role="status">Carregando atividade local…</p>
      ) : (
        <div className="activity-calendar">
          <div
            className="heatmap-scroll"
            role="region"
            aria-label="Calendário dos últimos seis meses"
            tabIndex={0}
          >
            <div
              className="heatmap-months"
              style={{
                gridTemplateColumns: `repeat(${calendar.days.length / 7}, var(--heatmap-cell))`,
              }}
              aria-hidden="true"
            >
              {months.map(({ day, week }) => (
                <span key={day} style={{ gridColumn: week + 1 }}>
                  {monthLabel(day)}
                </span>
              ))}
            </div>
            <div
              ref={grid}
              className="heatmap-grid"
              style={{
                gridTemplateColumns: `repeat(${calendar.days.length / 7}, var(--heatmap-cell))`,
              }}
            >
              {calendar.days.map((day, index) =>
                day ? (
                  <button
                    key={day}
                    className={`heatmap-day heat-${Math.min(4, groups.get(day)?.length ?? 0)}`}
                    title={description(day)}
                    aria-label={description(day)}
                    data-day={day}
                    tabIndex={day === focusDay ? 0 : -1}
                    onFocus={() => setSelected(day)}
                    onClick={() => setSelected(day)}
                    onKeyDown={(event) => {
                      const delta = {
                        ArrowLeft: -7,
                        ArrowRight: 7,
                        ArrowUp: -1,
                        ArrowDown: 1,
                      }[event.key];
                      if (delta === undefined) return;
                      event.preventDefault();
                      const next = calendar.days[index + delta];
                      if (next)
                        grid.current
                          ?.querySelector<HTMLButtonElement>(
                            `[data-day="${next}"]`,
                          )
                          ?.focus();
                    }}
                  />
                ) : (
                  <span key={`pad-${index}`} />
                ),
              )}
            </div>
          </div>
          <p className="sr-only" aria-live="polite">
            {selected ? description(focusDay) : ""}
          </p>
          <div className="heatmap-scale text-xs text-subtle">
            <span
              role="img"
              aria-label="Intensidade de zero a quatro ou mais atividades"
            >
              Menos{" "}
              {[0, 1, 2, 3, 4].map((n) => (
                <i key={n} className={`heatmap-legend heat-${n}`} />
              ))}{" "}
              Mais
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
