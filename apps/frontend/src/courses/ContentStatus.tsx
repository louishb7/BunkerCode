import { Link } from "react-router";
import { Page } from "./Page";

export function ContentStatus({ error }: { error: string }) {
  return (
    <Page
      title={error ? "Conteúdo indisponível" : "Carregando conteúdo"}
      ready={!!error}
      className="page-width content-status"
    >
      {error ? (
        <>
          <p className="eyebrow">Conteúdo indisponível</p>
          <h1>Não foi possível abrir esta página</h1>
          <p role="alert">{error}</p>
          <Link to="/courses">Voltar aos cursos</Link>
          <button onClick={() => window.location.reload()}>
            Tentar novamente
          </button>
        </>
      ) : (
        <p role="status">Carregando conteúdo…</p>
      )}
    </Page>
  );
}
