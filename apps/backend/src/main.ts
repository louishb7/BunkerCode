import { createApplication } from "./application";
async function bootstrap() {
  const app = await createApplication();
  await app.listen(Number(process.env.PORT ?? 3001), "127.0.0.1");
}
void bootstrap().catch(() => {
  process.stderr.write(
    "Error: Backend startup failed. Check database, authentication and content configuration.\n",
  );
  process.exitCode = 1;
});
