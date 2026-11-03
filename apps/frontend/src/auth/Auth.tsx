import {
  useEffect,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { Page } from "../courses/Page";
import {
  recoverSession,
  signIn,
  signOut,
  snapshot,
  subscribe,
} from "./session";
import "./auth.css";
export const useAuth = () => useSyncExternalStore(subscribe, snapshot);
export function SessionBoundary({ children }: { children: ReactNode }) {
  const session = useAuth();
  useEffect(() => {
    void recoverSession();
  }, []);
  if (session.loading)
    return (
      <p role="status" className="page-width">
        Recuperando sessão…
      </p>
    );
  return (
    <div key={session.user?.id ?? "anonymous"} className="session-root">
      {children}
    </div>
  );
}
export function RequireSession({
  children,
  admin = false,
}: {
  children: ReactNode;
  admin?: boolean;
}) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user)
    return (
      <Navigate
        to={
          "/login?next=" +
          encodeURIComponent(location.pathname + location.search)
        }
        replace
      />
    );
  if (admin && user.role !== "ADMIN")
    return (
      <Page title="Acesso restrito" className="page-width">
        <h1>Acesso restrito</h1>
        <p>O Studio está disponível somente para administradores.</p>
        <Link to="/courses">Voltar aos cursos</Link>
      </Page>
    );
  return children;
}
export function AccountControl() {
  const { user } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  if (!user)
    return (
      <Link className="account-control" to="/login">
        Entrar
      </Link>
    );
  return (
    <div className="account-control">
      <span title={user.email}>{user.email}</span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await signOut();
            navigate("/login", { replace: true });
          } catch (failure) {
            setError(
              failure instanceof Error ? failure.message : "Falha ao sair.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Saindo…" : "Sair"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
export function AuthPage({ register = false }: { register?: boolean }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const requested =
    new URLSearchParams(location.search).get("next") ?? "/courses";
  const next =
    /^\/courses(?:\/|$)/.test(requested) && !requested.includes("\\")
      ? requested
      : "/courses";
  if (user) return <Navigate to={next} replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await signIn(
        register ? "register" : "login",
        String(fields.get("email")),
        String(fields.get("password")),
      );
      navigate(next, { replace: true });
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Falha de conexão. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      title={register ? "Criar conta" : "Entrar"}
      className="page-width auth-page"
    >
      <h1>{register ? "Criar conta" : "Entrar"}</h1>
      <p>
        {register
          ? "Crie sua conta de estudante para acessar as lições."
          : "Entre para continuar seus estudos."}
      </p>
      <form onSubmit={submit} aria-busy={busy}>
        <label htmlFor="auth-email">E-mail</label>
        <input
          id="auth-email"
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
        />
        <label htmlFor="auth-password">Senha</label>
        <input
          id="auth-password"
          name="password"
          type="password"
          required
          minLength={12}
          maxLength={128}
          autoComplete={register ? "new-password" : "current-password"}
          aria-describedby="password-help"
        />
        <p id="password-help">
          Use de 12 a 128 caracteres. Você pode colar a senha do seu
          gerenciador.
        </p>
        {error && <p role="alert">{error}</p>}
        <button disabled={busy} type="submit">
          {busy ? "Aguarde…" : register ? "Criar conta" : "Entrar"}
        </button>
      </form>
      <Link
        to={
          (register ? "/login" : "/register") +
          "?next=" +
          encodeURIComponent(next)
        }
      >
        {register ? "Já tenho uma conta" : "Criar uma conta"}
      </Link>
    </Page>
  );
}
