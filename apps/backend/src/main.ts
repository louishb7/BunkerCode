import { createApplication } from "./application";
import { StartupError, startupDiagnostic } from "./startup-error";
async function bootstrap() {
  const port = Number(process.env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new StartupError(
      "http configuration",
      "PORT must be an integer between 0 and 65535 (default 3001).",
    );
  const app = await createApplication();
  try {
    await app.listen(port, "127.0.0.1");
  } catch (error) {
    await app.close();
    throw error;
  }
}
void bootstrap().catch((error: unknown) => {
  process.stderr.write(startupDiagnostic(error));
  process.exitCode = 1;
});
