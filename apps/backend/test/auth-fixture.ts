import { randomUUID } from "node:crypto";
import { PrismaService } from "../src/auth/prisma.service";
import { hashPassword } from "../src/auth/credentials";

export const authEnvironment = () =>
  Object.fromEntries(
    [
      "DATABASE_URL",
      "BUNKERCODE_JWT_SECRET",
      "BUNKERCODE_JWT_ISSUER",
      "BUNKERCODE_JWT_AUDIENCE",
      "BUNKERCODE_AUTH_ORIGINS",
    ].map((key) => [key, process.env[key]]),
  );
let account: Promise<{ email: string; password: string }> | undefined;
async function admin() {
  if (!account)
    account = (async () => {
      const db = new PrismaService();
      const email = `test-${randomUUID()}@example.test`,
        password = randomUUID();
      try {
        await db.user.create({
          data: {
            email,
            passwordHash: await hashPassword(password),
            role: "ADMIN",
          },
        });
      } finally {
        await db.$disconnect();
      }
      return { email, password };
    })();
  return account;
}
const tokens = new Map<string, Promise<string>>();
export async function adminToken(origin: string) {
  if (!tokens.has(origin))
    tokens.set(
      origin,
      (async () => {
        const response = await globalThis.fetch(origin + "/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://127.0.0.1:5173",
          },
          body: JSON.stringify(await admin()),
        });
        if (!response.ok)
          throw new Error(`Fixture login failed: ${response.status}`);
        const value = (await response.json()) as { accessToken: string };
        return value.accessToken;
      })(),
    );
  try {
    return await tokens.get(origin)!;
  } catch (error) {
    tokens.delete(origin);
    throw error;
  }
}
// Existing HTTP contracts run with a real, database-backed administrator.
// Authentication denial is separately exercised with native fetch in auth.test.ts.
export async function authenticatedFetch(input: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set(
    "Authorization",
    "Bearer " + (await adminToken(new URL(input).origin)),
  );
  return globalThis.fetch(input, { ...init, headers });
}
