import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { calendarDays, readActivity, type Activity } from "./activity-store";
const dateLabel = (day: string) =>
  new Date(day + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
  const stats = [
    [groups.size, "Dias com atividade"],
    [
      new Set(period.filter((r) => r.kind === "visit").map((r) => r.scope))
        .size,
      "Lições acessadas",
    ],
    [
      new Set(period.filter((r) => r.kind === "edit").map((r) => r.scope)).size,
      "Exercícios editados",
    ],
    [period.filter((r) => r.kind === "submit").length, "Soluções enviadas"],
  ];
  const focusDay = calendar.days.includes(selected) ? selected : calendar.end;
  const description = (day: string) => {
    const values = groups.get(day) ?? [];
    const count = (kind: Activity["kind"]) =>
      values.filter((r) => r.kind === kind).length;
    return `${dateLabel(day)}: ${count("visit")} acessos, ${count("edit")} edições, ${count("submit")} envios.`;
  };
  return (
    <section aria-labelledby="activity-title" className="activity-dashboard">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow mt-0 mb-2">Seu ritmo de estudo</p>
          <h2
            id="activity-title"
            className="m-0 flex items-center gap-2 text-xl"
          >
            <CalendarDays
              className="product-icon text-gold"
              aria-hidden="true"
            />
            Atividade
          </h2>
        </div>
        <p className="m-0 text-xs text-subtle">
          {dateLabel(calendar.start)} — {dateLabel(calendar.end)} · horário
          local
        </p>
      </header>
      {error ? (
        <p role="alert" className="text-sm">
          {error} O calendário não confirma dados indisponíveis.
        </p>
      ) : loading ? (
        <p role="status">Carregando atividade local…</p>
      ) : (
        <>
          <dl className="activity-stats">
            {stats.map(([value, label]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div
            className="heatmap-scroll"
            aria-label="Calendário dos últimos 365 dias"
            tabIndex={0}
          >
            <div
              className="heatmap-months"
              style={{
                gridTemplateColumns: `repeat(${calendar.days.length / 7}, minmax(11px, 1fr))`,
              }}
              aria-hidden="true"
            >
              {Array.from({ length: calendar.days.length / 7 }, (_, week) => {
                const dates = calendar.days
                  .slice(week * 7, week * 7 + 7)
                  .filter((d): d is string => !!d);
                const first =
                  dates.find((d) => d.endsWith("-01")) ??
                  (week === 0 ? dates[0] : undefined);
                return (
                  <span key={week}>
                    {first
                      ? new Date(first + "T12:00:00").toLocaleDateString(
                          "pt-BR",
                          { month: "short" },
                        )
                      : ""}
                  </span>
                );
              })}
            </div>
            <div
              ref={grid}
              className="heatmap-grid"
              style={{
                gridTemplateColumns: `repeat(${calendar.days.length / 7}, minmax(11px, 1fr))`,
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
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-subtle">
            <span>
              {selected
                ? description(selected)
                : period.length
                  ? `${period.length} atividades registradas no período.`
                  : "Ainda sem atividade. Abra uma lição para começar."}
            </span>
            <span
              className="flex items-center gap-1"
              aria-label="Intensidade de zero a quatro ou mais atividades"
            >
              Menos{" "}
              {[0, 1, 2, 3, 4].map((n) => (
                <i key={n} className={`heatmap-legend heat-${n}`} />
              ))}{" "}
              Mais
            </span>
          </div>
        </>
      )}
      <p className="mb-0 mt-4 text-xs leading-relaxed text-subtle">
        Um acesso e uma edição por lição/exercício a cada dia; cada envio
        registra uma atividade. Dados deste navegador, sem indicação de
        conclusão.
      </p>
    </section>
  );
}
