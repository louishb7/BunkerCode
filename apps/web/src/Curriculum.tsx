import { ArrowDown, ArrowRight, Radio, ShieldCheck } from "lucide-react";
import type { LabSummary } from "@backendlab/protocol";
import { areas } from "./areas";

export function Curriculum({
  labs,
  openLab,
}: {
  labs: LabSummary[];
  openLab: () => void;
}) {
  return (
    <div className="curriculum-page">
      <div className="eyebrow">
        <span className="eyebrow-line" /> THE LEARNING MAP / 01
      </div>
      <div className="curriculum-heading">
        <div>
          <h1>
            Backend Engineering
            <br />
            <em>Core.</em>
          </h1>
          <p>
            Uma coleção de experimentos para observar o comportamento real de
            sistemas backend. Comece pela execução. Siga a evidência.
          </p>
        </div>
        <div className="core-count">
          <strong>
            01<span> / 20</span>
          </strong>
          <small>LAB DISPONÍVEL</small>
        </div>
      </div>
      <div className="section-heading">
        <span>COMECE AQUI</span>
        <span className="line" />
        <span>001 / EXECUTION</span>
      </div>
      <button className="featured-lab" onClick={openLab}>
        <div className="featured-main">
          <span className="featured-kicker">
            <span className="status-dot" /> LAB DISPONÍVEL{" "}
            <span className="kicker-divider">/</span> OBSERVE
          </span>
          <h2>
            Request
            <br />
            Lifecycle<span className="title-period">.</span>
          </h2>
          <p>
            O que realmente acontece entre um cliente enviar uma request HTTP e
            receber a resposta?
          </p>
          <span className="featured-action">
            ABRIR EXPERIMENTO <ArrowRight size={17} />
          </span>
        </div>
        <div className="featured-visual">
          <div className="visual-label">
            EXECUTION PATH <span>LIVE TELEMETRY</span>
          </div>
          <div className="visual-flow">
            {["CLIENT", "HTTP", "CONTROLLER", "SERVICE", "RESPONSE"].map(
              (step, index) => (
                <div key={step} className="visual-flow-item">
                  <span className="visual-index">0{index + 1}</span>
                  <span
                    className={`visual-node ${index === 2 ? "visual-node-primary" : ""}`}
                  >
                    {step}
                  </span>
                  {index < 4 && <ArrowDown size={16} />}
                </div>
              ),
            )}
          </div>
          <span className="visual-foot">
            OBSERVE A REAL REQUEST MOVE THROUGH THE STACK ↗
          </span>
        </div>
      </button>
      <div className="section-heading areas-heading">
        <span>THE CORE / SEVEN AREAS</span>
        <span className="line" />
        <span>20 LABS PLANNED</span>
      </div>
      <div className="area-grid">
        {areas.map((area, index) => {
          const Icon = area.icon;
          const items = labs.filter((lab) => lab.area === area.name);
          return (
            <section className="area-card" key={area.name}>
              <div className="area-card-top">
                <span className="area-card-number">0{index}</span>
                <Icon size={21} strokeWidth={1.7} />
              </div>
              <h3>{area.name}</h3>
              <p>{area.description}</p>
              <div className="area-card-labs">
                {items.map((item) => (
                  <div
                    className={`area-card-lab ${item.status === "available" ? "is-available" : ""}`}
                    key={item.id}
                  >
                    <span>{item.number}</span>
                    <span>{item.title}</span>
                    {item.status === "available" ? (
                      <span className="lab-open-indicator" />
                    ) : (
                      <span className="planned-indicator">PLANNED</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <div className="cross-cutting">
        <span>CROSS-CUTTING PRACTICES</span>
        <div>
          <Radio size={16} /> Observability <span>FROM DAY ONE</span>
        </div>
        <div>
          <ShieldCheck size={16} /> Security <span>PROGRESSIVE</span>
        </div>
      </div>
    </div>
  );
}
