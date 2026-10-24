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
  const [details, setDetails] = useState<{
    day: string;
    left: number;
    top: number;
  } | null>(null);
  const [now, setNow] = useState(() => new Date());
  const grid = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLElement>(null);
  const anchor = useRef<HTMLButtonElement>(null);
  function hideDetails() {
    anchor.current = null;
    setDetails(null);
  }
  useEffect(() => {
    if (!details) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        hideDetails();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") hideDetails();
    };
    const reposition = () => {
      const button = anchor.current;
      const day = button?.dataset.day;
      const viewport = grid.current?.parentElement?.getBoundingClientRect();
      if (!button || !day || !viewport || !button.isConnected) return;
      const rect = button.getBoundingClientRect();
      if (
        rect.right <= viewport.left ||
        rect.left >= viewport.right ||
        rect.bottom <= 0 ||
        rect.top >= innerHeight
      )
        hideDetails();
      else showDetails(day, button);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    document.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", hideDetails);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      document.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", hideDetails);
    };
  }, [details]);
  function showDetails(day: string, button: HTMLButtonElement) {
    anchor.current = button;
    const rect = button.getBoundingClientRect();
    const width = Math.min(240, innerWidth - 16);
    setDetails({
      day,
      left: Math.max(
        width / 2 + 8,
        Math.min(innerWidth - width / 2 - 8, rect.left + rect.width / 2),
      ),
      top: Math.max(
        8,
        rect.bottom + 64 < innerHeight ? rect.bottom + 8 : rect.top - 64,
      ),
    });
  }
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
    <section
      ref={root}
      aria-labelledby="activity-title"
      className="activity-dashboard"
      onPointerLeave={() => {
        if (!grid.current?.contains(document.activeElement)) hideDetails();
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) hideDetails();
      }}
    >
      <h2 id="activity-title" className="sr-only">
        Atividade
      </h2>
      {error ? (
        <p role="alert" className="text-sm">
          {error} O calendário não confirma dados indisponíveis.
        </p>
      ) : loading ? (
        <p role="status">Carregando atividade local…</p>
      ) : (
        <div className="activity-calendar">
          <p id="activity-description" className="sr-only">
            {period.length} {period.length === 1 ? "atividade" : "atividades"}{" "}
            nos últimos seis meses. De {dateLabel(calendar.start)} a{" "}
            {dateLabel(calendar.end)}. Registros locais neste navegador.
            Intensidade de zero a quatro ou mais atividades por dia.
          </p>
          <div
            className="heatmap-scroll"
            role="region"
            aria-label="Calendário dos últimos seis meses"
            aria-describedby="activity-description"
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
                    aria-describedby={
                      details?.day === day ? "activity-day-details" : undefined
                    }
                    data-day={day}
                    tabIndex={day === focusDay ? 0 : -1}
                    onFocus={(event) => {
                      setSelected(day);
                      showDetails(day, event.currentTarget);
                    }}
                    onPointerEnter={(event) => {
                      if (event.pointerType === "mouse")
                        showDetails(day, event.currentTarget);
                    }}
                    onClick={(event) => {
                      setSelected(day);
                      showDetails(day, event.currentTarget);
                    }}
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
          {details && (
            <div
              id="activity-day-details"
              role="tooltip"
              className="heatmap-details"
              style={{ left: details.left, top: details.top }}
            >
              {description(details.day)}
              {!groups.get(details.day)?.length && (
                <span>Sem atividade registrada.</span>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
