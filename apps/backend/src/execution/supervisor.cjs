// One detached group per operation. The supervisor stays responsive if solution blocks.
const { spawn } = require("node:child_process");
let finished = false;
const worker = spawn(process.execPath, [process.argv[2]], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ["ignore", "pipe", "pipe", "ipc"],
});
worker.stdout.pipe(process.stdout);
worker.stderr.pipe(process.stderr);
worker.on("message", (message) => {
  if (process.connected) process.send(message);
});
worker.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
worker.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
worker.on("close", () => {
  finished = true;
  if (process.connected) process.disconnect();
  process.exit(process.exitCode ?? 0);
});
process.on("disconnect", () => {
  if (finished) return;
  if (process.platform !== "win32") process.kill(-process.pid, "SIGKILL");
  else {
    worker.kill("SIGKILL");
    process.exit(process.exitCode ?? 1);
  }
});
process.on("SIGTERM", () => {
  worker.kill("SIGTERM");
  setTimeout(() => {
    if (process.platform !== "win32") process.kill(-process.pid, "SIGKILL");
    else {
      worker.kill("SIGKILL");
      process.exit(1);
    }
  }, 200).unref();
});
