import { isIP } from "node:net";
import { StartupError } from "../startup-error";

export interface AuthConfig {
  databaseUrl: string;
  secret: Uint8Array;
  issuer: string;
  audience: string;
  origins: readonly string[];
  secure: boolean;
  trustedProxies: string[];
  loginIpLimit: number;
  registerIpLimit: number;
}
export function authConfig(): AuthConfig {
  const databaseUrl = process.env.DATABASE_URL;
  const secret = process.env.BUNKERCODE_JWT_SECRET;
  const origins = process.env.BUNKERCODE_AUTH_ORIGINS?.split(",");
  const issuer = process.env.BUNKERCODE_JWT_ISSUER;
  const audience = process.env.BUNKERCODE_JWT_AUDIENCE;
  const secure =
    process.env.NODE_ENV === "production" ||
    !!origins?.some((origin) => origin.startsWith("https://"));
  const missing = [
    "DATABASE_URL",
    "BUNKERCODE_JWT_SECRET",
    "BUNKERCODE_JWT_ISSUER",
    "BUNKERCODE_JWT_AUDIENCE",
    "BUNKERCODE_AUTH_ORIGINS",
  ].filter((key) => !process.env[key]);
  if (missing.length)
    throw new StartupError(
      "auth configuration",
      `Missing required variables: ${missing.join(", ")}. For pnpm dev, fill .env or .env.local at the repository root using .env.example; see docs/authentication.md. Production/tests require explicit environment configuration.`,
    );
  // Explicit guards keep the validated values narrowed without asserting unknown input.
  if (!databaseUrl || !secret || !origins || !issuer || !audience)
    throw new StartupError(
      "auth configuration",
      "Required authentication configuration is empty.",
    );
  try {
    const url = new URL(databaseUrl);
    if (
      !/^postgres(ql)?:$/.test(url.protocol) ||
      !url.hostname ||
      url.pathname.length < 2
    )
      throw new Error("Invalid database URL");
  } catch {
    throw new StartupError(
      "auth configuration",
      "DATABASE_URL must be a valid PostgreSQL URL with a host and database name. Check .env.example; credentials are never logged.",
    );
  }
  if (Buffer.byteLength(secret) < 32)
    throw new StartupError(
      "auth configuration",
      "BUNKERCODE_JWT_SECRET must contain at least 32 bytes. Generate and save a secret once during initial setup; do not regenerate it on startup.",
    );
  for (const value of origins) {
    let origin: URL;
    try {
      origin = new URL(value);
    } catch {
      throw new StartupError(
        "auth configuration",
        "BUNKERCODE_AUTH_ORIGINS must contain exact origins separated by commas.",
      );
    }
    if (
      origin.origin !== value ||
      origin.username ||
      origin.password ||
      (origin.protocol !== "https:" &&
        (secure ||
          origin.protocol !== "http:" ||
          !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)))
    )
      throw new StartupError(
        "auth configuration",
        "BUNKERCODE_AUTH_ORIGINS must contain exact HTTPS origins (HTTP loopback only in development).",
      );
  }
  const trustedProxies =
    process.env.BUNKERCODE_TRUSTED_PROXIES?.split(",") ?? [];
  for (const entry of trustedProxies) {
    const [address, prefix, extra] = entry.split("/");
    const version = isIP(address ?? "");
    if (
      !version ||
      extra !== undefined ||
      (prefix !== undefined &&
        (!/^\d+$/.test(prefix) ||
          Number(prefix) < 1 ||
          Number(prefix) > (version === 4 ? 32 : 128)))
    )
      throw new StartupError(
        "auth configuration",
        "BUNKERCODE_TRUSTED_PROXIES accepts only explicit IP addresses or CIDRs separated by commas; never hop counts or wildcards.",
      );
  }
  const positive = (key: string, fallback: number) => {
    const value = process.env[key];
    if (value === undefined) return fallback;
    if (!/^[1-9][0-9]*$/.test(value) || Number(value) > 10000)
      throw new StartupError(
        "auth configuration",
        `${key} must be an integer from 1 to 10000.`,
      );
    return Number(value);
  };
  return Object.freeze({
    databaseUrl,
    secret: new TextEncoder().encode(secret),
    issuer,
    audience,
    origins,
    secure,
    trustedProxies,
    loginIpLimit: positive("BUNKERCODE_AUTH_LOGIN_IP_LIMIT", 120),
    registerIpLimit: positive("BUNKERCODE_AUTH_REGISTER_IP_LIMIT", 60),
  });
}
