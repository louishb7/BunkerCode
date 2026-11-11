import { Page } from "../courses/Page";
import { SqlInteraction } from "./SqlInteraction";
import { storeExercise } from "./store-exercise";
import "./sql-lab.css";

export default function SqlLab() {
  return (
    <Page title="Laboratório SQL" className="sql-lab">
      <header>
        <h1>Laboratório SQL</h1>
        <p>
          Ambiente temporário para experimentar a interação SQL que será usada
          nas lições. Explore os dados fictícios com consultas SELECT.
        </p>
      </header>
      <SqlInteraction key={storeExercise.id} exercise={storeExercise} />
    </Page>
  );
}
