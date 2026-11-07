export interface Identity {
  id: string;
  email: string;
  role: "STUDENT" | "ADMIN";
}
interface Session {
  user: Identity | null;
  loading: boolean;
}
let token: string | null = null;
let state: Session = { user: null, loading: true };
let generation = 0;
let refreshing: Promise<boolean> | null = null;
const listeners = new Set<() => void>();
const channel =
  typeof window === "undefined" || typeof BroadcastChannel === "undefined"
    ? null
    : new BroadcastChannel("bunkercode-auth");
function publish(user: Identity | null, access: string | null) {
  const changed = state.user?.id !== user?.id;
  token = access;
  state = { user, loading: false };
  if (changed) window.dispatchEvent(new Event("bunkercode-identity-change"));
  listeners.forEach((listener) => listener());
}
channel?.addEventListener("message", () => {
  generation++;
  publish(null, null);
});
export const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const snapshot = () => state;
export const localIdentityScope = () => state.user?.id ?? "anonymous";
function accept(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    !("accessToken" in value) ||
    typeof value.accessToken !== "string" ||
    !("user" in value) ||
    !value.user ||
    typeof value.user !== "object"
  )
    throw new Error("Resposta de sessão inválida.");
  const user = value.user;
  if (
    !("id" in user) ||
    typeof user.id !== "string" ||
    !("email" in user) ||
    typeof user.email !== "string" ||
    !("role" in user) ||
    (user.role !== "ADMIN" && user.role !== "STUDENT")
  )
    throw new Error("Identidade inválida.");
  publish(
    { id: user.id, email: user.email, role: user.role },
    value.accessToken,
  );
}
async function post(action: string, body: unknown = {}) {
  return fetch("/api/auth/" + action, {
    signal: AbortSignal.timeout(10000),
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
async function sessionLock<T>(run: () => Promise<T>): Promise<T> {
  return await (navigator.locks
    ? navigator.locks.request("bunkercode-refresh", run)
    : run());
}
export function recoverSession(): Promise<boolean> {
  if (refreshing) return refreshing;
  const epoch = generation;
  const run = async () => {
    try {
      const response = await post("refresh");
      if (epoch !== generation) return false;
      if (!response.ok) {
        publish(null, null);
        return false;
      }
      const value: unknown = await response.json();
      if (epoch !== generation) return false;
      accept(value);
      return true;
    } catch {
      if (epoch === generation) publish(null, null);
      return false;
    }
  };
  refreshing = sessionLock(run).finally(() => {
    refreshing = null;
  });
  return refreshing;
}
export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly field?: "email" | "username" | "password",
    readonly retryAfter?: number,
  ) {
    super(message);
  }
}
export async function signIn(
  action: "login" | "register",
  email: string,
  password: string,
  username?: string,
) {
  // Finish an initial recovery before changing the account/cookie.
  if (refreshing) await refreshing;
  return sessionLock(async () => {
    generation++;
    const response = await post(
      action,
      action === "register"
        ? { email, username, password }
        : { identifier: email, password },
    );
    if (
      !response.ok &&
      action === "register" &&
      [400, 409].includes(response.status)
    ) {
      const value: unknown = await response.json().catch(() => null);
      const failures = {
        INVALID_EMAIL: { message: "Informe um e-mail válido.", field: "email" },
        INVALID_USERNAME: {
          message: "Use de 3 a 30 letras, números ou _ no usuário.",
          field: "username",
        },
        INVALID_PASSWORD: {
          message:
            "A senha precisa ter pelo menos 6 caracteres, 1 letra e 1 número.",
          field: "password",
        },
        USERNAME_TAKEN: {
          message: "Este usuário já está em uso.",
          field: "username",
        },
        EMAIL_TAKEN: {
          message: "Este e-mail já está cadastrado.",
          field: "email",
        },
      } as const;
      if (
        value &&
        typeof value === "object" &&
        "code" in value &&
        typeof value.code === "string" &&
        Object.hasOwn(failures, value.code)
      ) {
        const failure = failures[value.code as keyof typeof failures];
        throw new AuthError(failure.message, response.status, failure.field);
      }
    }
    if (response.status === 429) {
      const seconds = Number(response.headers.get("Retry-After"));
      const retryAfter =
        Number.isFinite(seconds) && seconds > 0
          ? Math.min(Math.ceil(seconds), 3600)
          : 60;
      throw new AuthError(
        `Muitas tentativas. Tente novamente em ${retryAfter} segundos.`,
        429,
        undefined,
        retryAfter,
      );
    }
    if (!response.ok)
      throw new AuthError(
        response.status === 409
          ? "Este e-mail já está cadastrado."
          : response.status === 429
            ? "Muitas tentativas. Aguarde antes de tentar novamente."
            : response.status === 400
              ? action === "register"
                ? "Confira os dados do cadastro."
                : "Não foi possível entrar. Confira seus dados."
              : response.status === 401
                ? "Não foi possível entrar. Confira seus dados."
                : "Serviço indisponível. Tente novamente.",
        response.status,
      );
    accept(await response.json());
    channel?.postMessage("changed");
  });
}
export async function signOut() {
  if (refreshing) await refreshing;
  return sessionLock(async () => {
    const response = await post("logout");
    if (!response.ok)
      throw new Error(
        "Não foi possível encerrar a sessão no servidor. Tente novamente.",
      );
    generation++;
    publish(null, null);
    channel?.postMessage("changed");
  });
}
export async function apiFetch(input: string, init: RequestInit = {}) {
  const epoch = generation;
  const owner = state.user?.id;
  const request = () => {
    if (
      epoch !== generation ||
      owner !== state.user?.id ||
      init.signal?.aborted
    )
      throw new DOMException("Session changed", "AbortError");
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", "Bearer " + token);
    return fetch(input, { ...init, headers, credentials: "same-origin" });
  };
  const response = await request();
  if (response.status !== 401 || epoch !== generation) return response;
  if (await recoverSession()) return request();
  return response;
}
