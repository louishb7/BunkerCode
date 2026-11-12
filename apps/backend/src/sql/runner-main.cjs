// Fixed container entry point. SQL is JSON data, never JavaScript or shell input.
const {
  parseSqlDefinition,
  parseSqlDataset,
  parseSqlSteps,
  sqlObject,
} = require("/app/content/sql.js");
const {
  gradeSql,
  generateFormativeOracle,
} = require("/app/content/sql-grading.js");
const { readFileSync } = require("node:fs");
function kernelBoundary() {
  const read = (path) => readFileSync(path, "utf8").trim();
  const status = read("/proc/self/status");
  const bounded = (path, max) => {
    const n = Number(read("/sys/fs/cgroup/" + path));
    return Number.isFinite(n) && n > 0 && n <= max;
  };
  const cpu = read("/sys/fs/cgroup/cpu.max").split(/\s+/).map(Number);
  const interfaces = read("/proc/net/dev")
    .split("\n")
    .slice(2)
    .map((line) => line.split(":")[0].trim());
  if (
    process.getuid() !== 65534 ||
    !/^NoNewPrivs:\s+1$/m.test(status) ||
    !/^Seccomp:\s+2$/m.test(status) ||
    !/^CapEff:\s+0+$/m.test(status) ||
    !bounded("memory.max", 1073741824) ||
    read("/sys/fs/cgroup/memory.swap.max") !== "0" ||
    !bounded("pids.max", 32) ||
    !(cpu[0] > 0 && cpu[1] > 0 && cpu[0] / cpu[1] <= 0.75) ||
    interfaces.some((name) => name !== "lo")
  )
    throw new Error("Kernel boundary unavailable");
}
let bytes = 0;
const chunks = [];
process.stdin.on("data", (chunk) => {
  bytes += chunk.length;
  if (bytes > 300000) process.exit(2);
  chunks.push(chunk);
});
process.stdin.on("end", async () => {
  try {
    kernelBoundary();
    const raw = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const input = sqlObject(
      raw,
      raw.operation === undefined
        ? ["definition", "dataset", "steps"]
        : ["definition", "dataset", "steps", "operation"],
    );
    if (input.operation !== undefined && input.operation !== "formative")
      throw new Error("Invalid operation");
    const definition = parseSqlDefinition(input.definition),
      dataset = parseSqlDataset(input.dataset),
      steps = parseSqlSteps(input.steps);
    if (input.operation === "formative") {
      const formative = await generateFormativeOracle(definition, dataset);
      process.stdout.write(JSON.stringify({ passed: true, formative }));
      return;
    }
    const metrics = {};
    const passed = await gradeSql(definition, dataset, steps, (phase, ms) => {
      metrics[phase] = ms;
    });
    metrics.maxRssKiB = process.resourceUsage().maxRSS;
    process.stdout.write(JSON.stringify({ passed, metrics }));
  } catch {
    process.stdout.write(
      JSON.stringify({
        error:
          "Não foi possível avaliar o SQL. Confira os comandos e os limites.",
      }),
    );
    process.exitCode = 2;
  }
});
