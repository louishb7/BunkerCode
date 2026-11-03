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
export async function signIn(
  action: "login" | "register",
  email: string,
  password: string,
) {
  // Finish an initial recovery before changing the account/cookie.
  if (refreshing) await refreshing;
  return sessionLock(async () => {
    generation++;
    const response = await post(action, { email, password });
    if (!response.ok)
      throw new Error(
        response.status === 409
          ? "Este e-mail já está cadastrado."
          : response.status === 429
            ? "Muitas tentativas. Aguarde antes de tentar novamente."
            : response.status === 400
              ? "Use e-mail válido e senha de 12 a 128 caracteres."
              : "Não foi possível entrar. Confira e-mail e senha.",
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
  const request = () => {
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", "Bearer " + token);
    return fetch(input, { ...init, headers, credentials: "same-origin" });
  };
  const response = await request();
  if (response.status !== 401 || epoch !== generation) return response;
  if (await recoverSession()) return request();
  return response;
}
