import { createApplication } from "../../src/application";
async function main() {
  const app = await createApplication(true);
  await app.listen(0, "127.0.0.1");
  process.send?.({ url: await app.getUrl() });
  process.once("message", async () => {
    await app.close();
    process.exitCode = 0;
    process.disconnect?.();
  });
}
void main().catch(() => {
  process.exitCode = 1;
  process.disconnect?.();
});
