import { Page } from "../courses/Page";
import { SqlInteraction } from "./SqlInteraction";
import { useState } from "react";
import { sqlExercises } from "./exercise-catalog";
import "./sql-lab.css";

export default function SqlLab() {
  const [selected, setSelected] = useState(sqlExercises[0]!.id);
  const exercise = sqlExercises.find((item) => item.id === selected)!;
  return (
    <Page title="Laboratório SQL" className="sql-lab">
      <header>
        <h1>Laboratório SQL</h1>
        <p>
          Ambiente temporário para experimentar a interação SQL que será usada
          nas lições. Explore os dados fictícios e compare atividades
          configuráveis.
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
      <SqlInteraction exercise={exercise} />
    </Page>
  );
}
