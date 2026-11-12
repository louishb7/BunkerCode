import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
const source = readFileSync("src/sql/runner-main.cjs", "utf8");
async function entry(overrides: Record<string, string> = {}, uid = 65534) {
  const files: Record<string, string> = {
    "/proc/self/status":
      "NoNewPrivs:\t1\nSeccomp:\t2\nCapEff:\t0000000000000000",
    "/sys/fs/cgroup/memory.max": "1073741824",
    "/sys/fs/cgroup/memory.swap.max": "0",
    "/sys/fs/cgroup/pids.max": "32",
    "/sys/fs/cgroup/cpu.max": "75000 100000",
    "/proc/net/dev": "header\nheader\n lo: 0",
    ...overrides,
  };
  const handlers: Record<string, (value?: Buffer) => Promise<void> | void> = {};
  let evaluated = false,
    exit = 0;
  runInNewContext(source, {
    Buffer,
    require: (path: string) =>
      path === "node:fs"
        ? { readFileSync: (path: string) => files[path] }
        : path.endsWith("sql-grading.js")
          ? {
              gradeSql: async () => {
                evaluated = true;
                return true;
              },
            }
          : {
              sqlObject: (value: unknown) => value,
              parseSqlDefinition: (v: unknown) => v,
              parseSqlDataset: (v: unknown) => v,
              parseSqlSteps: (v: unknown) => v,
            },
    process: {
      getuid: () => uid,
      stdin: {
        on: (event: string, callback: (typeof handlers)[string]) => {
          handlers[event] = callback;
        },
      },
      stdout: { write: () => undefined },
      resourceUsage: () => ({ maxRSS: 1 }),
      exit: (code: number) => {
        exit = code;
      },
      set exitCode(value: number) {
        exit = value;
      },
    },
  });
  handlers.data!(Buffer.from('{"definition":{},"dataset":{},"steps":[]}'));
  await handlers.end!();
  return { evaluated, exit };
}
test("SQL entrypoint rejects missing or ineffective kernel controls before invoking grading", async () => {
  assert.deepEqual(await entry(), { evaluated: true, exit: 0 });
  const invalid: Record<string, string>[] = [
    {
      "/proc/self/status":
        "NoNewPrivs:\t1\nSeccomp:\t2\nCapEff:\t0000000000000001",
    },
    { "/sys/fs/cgroup/memory.max": "max" },
    { "/sys/fs/cgroup/memory.swap.max": "1073741824" },
    { "/sys/fs/cgroup/pids.max": "max" },
    { "/sys/fs/cgroup/cpu.max": "max 100000" },
    { "/proc/net/dev": "header\nheader\n lo: 0\n eth0: 1" },
    {
      "/proc/self/status":
        "NoNewPrivs:\t0\nSeccomp:\t0\nCapEff:\t0000000000000000",
    },
  ];
  for (const files of invalid)
    assert.deepEqual(await entry(files), { evaluated: false, exit: 2 });
  assert.deepEqual(await entry({}, 0), { evaluated: false, exit: 2 });
});
