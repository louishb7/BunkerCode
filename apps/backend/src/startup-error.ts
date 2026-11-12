// Only messages authored here or at configuration boundaries may reach startup logs.
// Never print driver errors, URLs, stacks, SQL or arbitrary Error.message values.
export class StartupError extends Error {
  constructor(
    readonly subsystem: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export function databaseStartupError(error: unknown): StartupError {
  const codes = new Set<string>();
  const seen = new Set<object>();
  function visit(value: unknown) {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    const fields = value as Record<string, unknown>;
    for (const key of ["code", "originalCode"] as const)
      if (typeof fields[key] === "string") codes.add(fields[key]);
    for (const key of [
      "cause",
      "meta",
      "driverAdapterError",
      "originalError",
    ] as const)
      visit(fields[key]);
    if (Array.isArray(fields.errors))
      for (const nested of fields.errors) visit(nested);
  }
  visit(error);
  let message: string;
  if (["28P01", "28000", "P1000"].some((code) => codes.has(code)))
    message =
      "PostgreSQL rejected authentication. Check the DATABASE_URL user/password and PostgreSQL authentication rules.";
  else if (["3D000", "P1003"].some((code) => codes.has(code)))
    message =
      "The configured PostgreSQL database does not exist. Select the existing development database or follow docs/authentication.md for initial setup.";
  else if (["42P01", "42703", "P2021", "P2022"].some((code) => codes.has(code)))
    message =
      "Required database tables/columns are missing. Restart pnpm dev to apply versioned migrations, or check db:status:local and apply reviewed migrations with db:deploy:local (backend workspace). Never reset the database.";
  else if (["42501", "P1010"].some((code) => codes.has(code)))
    message =
      "PostgreSQL denied access. Check the configured role's permissions on the identity database and schema.";
  else if (
    [
      "ECONNREFUSED",
      "ETIMEDOUT",
      "ENOTFOUND",
      "EHOSTUNREACH",
      "P1001",
      "P1002",
    ].some((code) => codes.has(code))
  )
    message =
      "Cannot reach PostgreSQL. Check the service and DATABASE_URL host/port; use pg_isready. Startup does not start system services.";
  else
    message =
      "PostgreSQL readiness failed. Check connectivity, DATABASE_URL credentials, TLS, role permissions and Prisma migration status with db:status:local; see docs/authentication.md.";
  return new StartupError("database", message);
}

export function startupDiagnostic(error: unknown): string {
  if (error instanceof StartupError)
    return `Error: Backend startup failed [${error.subsystem}]. ${error.message}\n`;
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "EADDRINUSE"
  )
    return "Error: Backend startup failed [http]. PORT is already in use. Stop the conflicting process or configure PORT and the frontend BUNKERCODE_API_URL together.\n";
  return "Error: Backend startup failed [initialization]. Check backend configuration and dependency versions; see docs/authentication.md. Raw errors are withheld to protect credentials.\n";
}
