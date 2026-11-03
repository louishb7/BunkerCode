export interface AuthConfig {
  databaseUrl: string;
  secret: Uint8Array;
  issuer: string;
  audience: string;
  origins: readonly string[];
  secure: boolean;
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
  if (
    !databaseUrl ||
    !/^postgres(ql)?:\/\//.test(databaseUrl) ||
    !secret ||
    Buffer.byteLength(secret) < 32 ||
    !origins?.length ||
    !issuer ||
    !audience
  )
    throw new Error(
      "Configure DATABASE_URL, BUNKERCODE_JWT_SECRET (32+ bytes), BUNKERCODE_JWT_ISSUER, BUNKERCODE_JWT_AUDIENCE and BUNKERCODE_AUTH_ORIGINS.",
    );
  for (const value of origins) {
    const origin = new URL(value);
    if (
      origin.origin !== value ||
      origin.username ||
      origin.password ||
      (origin.protocol !== "https:" &&
        (secure ||
          origin.protocol !== "http:" ||
          !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)))
    )
      throw new Error(
        "Auth origins must be exact HTTPS origins (HTTP loopback only in development).",
      );
  }
  return Object.freeze({
    databaseUrl,
    secret: new TextEncoder().encode(secret),
    issuer,
    audience,
    origins,
    secure,
  });
}
