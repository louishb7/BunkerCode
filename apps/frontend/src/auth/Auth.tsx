import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { Eye, EyeOff, ArrowLeft, Code2 } from "lucide-react";
import { Insignia } from "../product/Brand";
import { AppearanceControl } from "../appearance/Appearance";
import { Page } from "../courses/Page";
import {
  AuthError,
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
  const location = useLocation();
  if (!user)
    return (
      <Link
        className="account-control"
        to={
          "/login?next=" +
          encodeURIComponent(location.pathname + location.search)
        }
      >
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
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const feedback = useRef<HTMLParagraphElement>(null);
  const requested =
    new URLSearchParams(location.search).get("next") ?? "/courses";
  const next =
    /^\/courses(?:\/[a-z0-9-]+(?:\/lessons\/[a-z0-9-]+(?:\/edit)?)?)?\/?(?:\?[^#]*)?(?:#.*)?$/.test(
      requested,
    ) && !requested.includes("\\")
      ? requested
      : "/courses";
  if (user) return <Navigate to={next} replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const email = String(fields.get("email")).trim();
    const password = String(fields.get("password"));
    const errors: typeof fieldErrors = {};
    const emailInput = form.elements.namedItem("email") as HTMLInputElement;
    if (!email || emailInput.validity.typeMismatch || email.length > 254)
      errors.email = "Informe um e-mail válido.";
    if (!password) errors.password = "Informe sua senha.";
    else if (register && (password.length < 12 || password.length > 128))
      errors.password = "Use de 12 a 128 caracteres na senha.";
    setFieldErrors(errors);
    setError("");
    if (errors.email || errors.password) {
      (
        form.elements.namedItem(
          errors.email ? "email" : "password",
        ) as HTMLInputElement
      ).focus();
      return;
    }
    setBusy(true);
    try {
      await signIn(register ? "register" : "login", email, password);
      navigate(next, { replace: true });
    } catch (failure) {
      if (
        failure instanceof AuthError &&
        (failure.status === 409 || (register && failure.status === 400))
      ) {
        setFieldErrors({
          email:
            failure.status === 409
              ? failure.message
              : "Confira o formato do e-mail informado.",
        });
        emailInput.focus();
      } else {
        setError(
          failure instanceof AuthError
            ? failure.message
            : "Não foi possível conectar. Tente novamente.",
        );
        requestAnimationFrame(() => feedback.current?.focus());
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page title={register ? "Criar conta" : "Entrar"} className="auth-page">
      <header className="auth-topbar">
        <Link className="auth-brand" to="/" aria-label="BunkerCode — Início">
          <Insignia />
          <span>
            Bunker<span className="text-gold">Code</span>
          </span>
        </Link>
        <AppearanceControl reading={false} />
      </header>
      <div className="auth-composition">
        <aside
          className="auth-introduction"
          aria-label="Aprender no BunkerCode"
        >
          <div className="auth-emblem">
            <Insignia large />
          </div>
          <h2>
            Entenda o código.
            <br />
            Construa seu conhecimento.
          </h2>
          <p>
            Cursos e lições de programação para estudar no seu ritmo, com espaço
            para ler, experimentar e pensar.
          </p>
          <figure className="auth-code-example">
            <figcaption>
              <Code2 size={18} aria-hidden="true" /> Uma ideia, escrita em
              código
            </figcaption>
            <pre>
              <code>
                <span>const</span> aprender = () =&gt; {"{"}
                <br />
                {"  "}ler();
                <br />
                {"  "}experimentar();
                <br />
                {"  "}escreverComSuasPalavras();
                <br />
                {"}"};
              </code>
            </pre>
            <p>Exemplo ilustrativo de JavaScript.</p>
          </figure>
          <p className="auth-public-note">
            As lições publicadas são abertas. Sua conta é um convite para uma
            experiência individual.
          </p>
        </aside>
        <section className="auth-form-area" aria-labelledby="auth-title">
          <h1 id="auth-title">{register ? "Criar conta" : "Entrar"}</h1>
          <p className="auth-description">
            {register
              ? "Seu espaço de estudo começa com uma conta."
              : "Bom ter você de volta ao BunkerCode."}
          </p>
          <form onSubmit={submit} aria-busy={busy} noValidate>
            <div className="auth-field">
              <label htmlFor="auth-email">E-mail</label>
              <input
                id="auth-email"
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? "email-error" : undefined}
              />
              {fieldErrors.email && (
                <p id="email-error" className="auth-error" role="alert">
                  {fieldErrors.email}
                </p>
              )}
            </div>
            <div className="auth-field">
              <label htmlFor="auth-password">Senha</label>
              <div className="auth-password">
                <input
                  id="auth-password"
                  name="password"
                  type={visible ? "text" : "password"}
                  required
                  minLength={register ? 12 : undefined}
                  maxLength={128}
                  autoComplete={register ? "new-password" : "current-password"}
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={
                    [
                      register ? "password-help" : "",
                      fieldErrors.password ? "password-error" : "",
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                />
                <button
                  type="button"
                  className="auth-reveal"
                  aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={visible}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? (
                    <EyeOff size={19} aria-hidden="true" />
                  ) : (
                    <Eye size={19} aria-hidden="true" />
                  )}
                </button>
              </div>
              {register && (
                <p id="password-help" className="auth-hint">
                  Use de 12 a 128 caracteres. Você pode colar a senha do seu
                  gerenciador.
                </p>
              )}
              {fieldErrors.password && (
                <p id="password-error" className="auth-error" role="alert">
                  {fieldErrors.password}
                </p>
              )}
            </div>
            {error && (
              <p
                ref={feedback}
                tabIndex={-1}
                className="auth-error"
                role="alert"
              >
                {error}
              </p>
            )}
            <button
              className="entry-primary auth-submit"
              disabled={busy}
              type="submit"
            >
              {busy
                ? register
                  ? "Criando conta…"
                  : "Entrando…"
                : register
                  ? "Criar conta"
                  : "Entrar"}
            </button>
          </form>
          <p className="auth-switch">
            {register ? "Já tem uma conta?" : "Ainda não tem conta?"}{" "}
            <Link
              to={
                (register ? "/login" : "/register") +
                "?next=" +
                encodeURIComponent(next)
              }
            >
              {register ? "Entrar" : "Criar uma conta"}
            </Link>
          </p>
          <Link className="auth-explore" to="/courses">
            <ArrowLeft size={16} aria-hidden="true" />
            Explorar cursos sem conta
          </Link>
          <p className="auth-storage-note">
            Sua conta identifica a sessão. Rascunhos e atividade continuam
            salvos apenas neste navegador.
          </p>
        </section>
      </div>
    </Page>
  );
}
