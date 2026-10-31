import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
const fixture = "/courses/readiness/lessons/first";
test.beforeAll(async () => {
  const root = join(
    process.env.BUNKERCODE_BROWSER_CONTENT_DIR!,
    "courses/readiness",
  );
  const definition = await readFile(
    resolve(
      "../../content/courses/typescript/lessons/values-and-types/exercise.json",
    ),
  );
  for (const slug of ["first", "second"]) {
    const dir = join(root, "lessons", slug);
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "lesson.md"),
      `# ${slug}\n\nFixture isolada de concorrência de Run e Submit.`,
    );
    await writeFile(join(dir, "exercise.json"), definition);
  }
  await writeFile(
    join(root, "course.json"),
    JSON.stringify({
      id: "readiness",
      title: "Readiness fixture",
      description: "Fixture de consultas e execução.",
      lessons: [
        { slug: "first", title: "First" },
        { slug: "second", title: "Second" },
      ],
    }),
  );
});

const lesson = "/courses/typescript/lessons/values-and-types";
const source =
  "function isAvailable(stock: number): boolean { return stock > 0; }";
const editor = (page: Page) =>
  page.getByRole("textbox", { name: "Código da solução", exact: true });
async function open(page: Page, path = lesson) {
  await page.goto(path);
  await expect(page.locator(".cm-editor")).toHaveCount(1);
  const switcher = page.getByRole("button", { name: "Código", exact: true });
  if (await switcher.isVisible()) await switcher.click();
  await expect(editor(page)).toBeVisible();
  await editor(page).fill(source);
}
async function submissions(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ code: string; state: string; lesson: string }[]>(
        (resolve, reject) => {
          const request = indexedDB.open("bunkercode-practice", 2);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction("submissions");
            const get = tx.objectStore("submissions").getAll();
            tx.oncomplete = () => {
              db.close();
              resolve(get.result);
            };
            tx.onabort = () => {
              db.close();
              reject(tx.error);
            };
          };
        },
      ),
  );
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
type CompilationWindow = Window & {
  releaseCompilation?: () => void;
  compilationWaiting?: boolean;
};
async function holdCompilation(page: Page) {
  await page.addInitScript(() => {
    const gate = new Promise<void>((resolve) => {
      (window as CompilationWindow).releaseCompilation = resolve;
    });
    const descriptor = Object.getOwnPropertyDescriptor(
      Worker.prototype,
      "onmessage",
    )!;
    Object.defineProperty(Worker.prototype, "onmessage", {
      ...descriptor,
      set(handler: (this: Worker, event: MessageEvent) => void) {
        descriptor.set!.call(this, async (event: MessageEvent) => {
          if (typeof event.data?.result?.version === "string") {
            (window as CompilationWindow).compilationWaiting = true;
            await gate;
          }
          handler.call(this, event);
        });
      },
    });
  });
}

test("Submit uses real readiness delivered while its real compilation is pending exactly once", async ({
  page,
}, info) => {
  test.setTimeout(60000);
  const ready = deferred();
  const release = deferred();
  let actual: { available: boolean; reason: string } | undefined;
  const runs: { source: string }[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/practice/runs"))
      runs.push(request.postDataJSON());
  });
  await page.route("**/api/practice/runtime", async (route) => {
    const response = await route.fetch();
    actual = await response.json();
    ready.resolve();
    await release.promise;
    await route.fulfill({ response });
  });
  await holdCompilation(page);
  try {
    await open(page);
    await ready.promise;
    expect(actual?.available, actual?.reason).toBe(true);
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect
      .poll(
        () =>
          page.evaluate(() => (window as CompilationWindow).compilationWaiting),
        { timeout: 30000 },
      )
      .toBe(true);
    const delivered = page.waitForResponse((response) =>
      response.url().endsWith("/practice/runtime"),
    );
    await editor(page).fill("// edited after the submitted snapshot");
    release.resolve();
    await (await delivered).finished();
    await page.evaluate(() =>
      (window as CompilationWindow).releaseCompilation!(),
    );
    await expect(page.getByText(/Solução registrada em/)).toBeVisible({
      timeout: 30000,
    });
    expect(await submissions(page)).toEqual([
      expect.objectContaining({ code: source, state: "passed" }),
    ]);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ source });
    await expect(editor(page)).toHaveText(
      "// edited after the submitted snapshot",
    );
    await page.screenshot({
      path: info.outputPath("readiness-real-submit.png"),
    });
  } finally {
    release.resolve();
  }
});

const results = (page: Page) =>
  page.getByRole("region", { name: "Compilação e resultados", exact: true });
const waiting = "Compilação concluída. Verificando disponibilidade do runner…";
const submit = (page: Page) =>
  page.getByRole("button", { name: "Submit", exact: true });
function countRuns(page: Page) {
  const requests: { source: string; lesson: string }[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/practice/runs"))
      requests.push(request.postDataJSON());
  });
  return requests;
}
async function rapidClicks(page: Page, name: "Run" | "Submit") {
  await page
    .getByRole("button", { name, exact: true })
    .evaluate((button: HTMLButtonElement) => {
      for (let index = 0; index < 3; index++) button.click();
    });
}
async function holdFirstRuntime(
  page: Page,
  oldStatus?: { available: boolean; reason: string },
) {
  const arrived = deferred(),
    release = deferred(),
    delivered = deferred();
  let first = true;
  await page.route("**/api/practice/runtime", async (route) => {
    if (!first) {
      await route.continue();
      return;
    }
    first = false;
    const response = oldStatus ? undefined : await route.fetch();
    arrived.resolve();
    await release.promise;
    if (response) await route.fulfill({ response });
    else await route.fulfill({ json: oldStatus });
    delivered.resolve();
  });
  return { arrived, release, delivered };
}

test("confirmed unavailability falls back once without executing and Run does not submit", async ({
  page,
}) => {
  const runs = countRuns(page);
  await page.route("**/api/practice/runtime", (route) =>
    route.fulfill({
      json: { available: false, reason: "Runner deliberately unavailable" },
    }),
  );
  await open(page);
  await rapidClicks(page, "Submit");
  await expect(page.getByText(/Solução registrada em/)).toBeVisible({
    timeout: 30000,
  });
  expect(await submissions(page)).toEqual([
    expect.objectContaining({ code: source, state: "unassessed" }),
  ]);
  expect(runs).toHaveLength(0);
  await expect(results(page)).toContainText(
    "Runner indisponível: Runner deliberately unavailable",
  );
  await rapidClicks(page, "Run");
  await expect(results(page)).toContainText("Resultado não avaliado.");
  await expect(
    page.getByRole("button", { name: "Run", exact: true }),
  ).toBeVisible();
  expect(await submissions(page)).toHaveLength(1);
  expect(runs).toHaveLength(0);
});

test("network error remains unassessed and a deliberate retry uses the real runner once", async ({
  page,
}) => {
  test.setTimeout(60000);
  const runs = countRuns(page);
  await page.route("**/api/practice/runtime", (route) => route.abort("failed"));
  await open(page);
  await submit(page).click();
  await expect(page.getByText(/Solução registrada em/)).toBeVisible({
    timeout: 30000,
  });
  await expect(results(page)).toContainText("Falha de rede ao consultar");
  expect(await submissions(page)).toEqual([
    expect.objectContaining({ state: "unassessed" }),
  ]);
  expect(runs).toHaveLength(0);
  await page.unroute("**/api/practice/runtime");
  await submit(page).click();
  await expect(results(page)).toContainText(
    "Concluída pelos testes configurados",
    { timeout: 30000 },
  );
  expect((await submissions(page)).map((value) => value.state).sort()).toEqual([
    "passed",
    "unassessed",
  ]);
  expect(runs).toHaveLength(1);
});

test("readiness timeout is distinct from unavailability and ignores its late response", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-22T12:00:00Z") });
  const runs = countRuns(page);
  const held = await holdFirstRuntime(page, {
    available: true,
    reason: "Late test response",
  });
  try {
    await open(page);
    await held.arrived.promise;
    await submit(page).click();
    await expect(results(page)).toContainText(waiting, { timeout: 30000 });
    await page.clock.runFor(10000);
    await expect(page.getByText(/Solução registrada em/)).toBeVisible();
    await expect(results(page)).toContainText(
      "Tempo limite da consulta de disponibilidade excedido",
    );
    expect(await submissions(page)).toEqual([
      expect.objectContaining({ state: "unassessed" }),
    ]);
    expect(runs).toHaveLength(0);
    await expect(submit(page)).toBeEnabled();
    held.release.resolve();
    await held.delivered.promise;
    expect(runs).toHaveLength(0);
    expect(await submissions(page)).toHaveLength(1);
  } finally {
    held.release.resolve();
  }
});

test("cancelling a pending check permits a fresh Submit and ignores the old unavailable response", async ({
  page,
}, info) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 320, height: 800 });
  const runs = countRuns(page);
  const held = await holdFirstRuntime(page, {
    available: false,
    reason: "Obsolete cancelled check",
  });
  try {
    await open(page);
    await held.arrived.promise;
    await submit(page).click();
    await expect(results(page)).toContainText(waiting, { timeout: 30000 });
    await expect(
      page.getByRole("button", { name: "Registrando…", exact: true }),
    ).toBeVisible();
    const controls = page.locator(".editor-actions button");
    for (const control of await controls.all()) {
      const box = (await control.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(320);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(320);
    await page.screenshot({
      path: info.outputPath("workspace-pending-320.png"),
    });
    await page
      .getByRole("button", { name: "Cancelar operação", exact: true })
      .click();
    await expect(submit(page)).toBeEnabled();
    expect(await submissions(page)).toEqual([]);
    await submit(page).click();
    await expect(results(page)).toContainText(
      "Concluída pelos testes configurados",
      { timeout: 30000 },
    );
    held.release.resolve();
    await held.delivered.promise;
    expect(runs).toHaveLength(1);
    expect(await submissions(page)).toEqual([
      expect.objectContaining({ code: source, state: "passed" }),
    ]);
    await expect(results(page)).not.toContainText("Obsolete cancelled check");
  } finally {
    held.release.resolve();
  }
});

test("unmount during readiness aborts the old Submit and returning starts a fresh check", async ({
  page,
}) => {
  test.setTimeout(60000);
  const runs = countRuns(page);
  const held = await holdFirstRuntime(page);
  try {
    await open(page);
    await held.arrived.promise;
    await submit(page).click();
    await expect(results(page)).toContainText(waiting, { timeout: 30000 });
    await page.getByRole("link", { name: "Início", exact: true }).click();
    await expect(page).toHaveURL("/");
    held.release.resolve();
    await held.delivered.promise;
    expect(runs).toHaveLength(0);
    expect(await submissions(page)).toEqual([]);
    await page.goBack();
    await expect(editor(page)).toBeVisible();
    await submit(page).click();
    await expect(results(page)).toContainText(
      "Concluída pelos testes configurados",
      { timeout: 30000 },
    );
    expect(runs).toHaveLength(1);
    expect(await submissions(page)).toHaveLength(1);
  } finally {
    held.release.resolve();
  }
});

test("changing exercises during a real run cannot apply or submit the old result to the new lesson", async ({
  page,
}) => {
  test.setTimeout(60000);
  const runs = countRuns(page);
  const completed = deferred(),
    release = deferred(),
    delivered = deferred();
  let first = true;
  await page.route("**/api/practice/runs", async (route) => {
    if (!first) {
      await route.continue();
      return;
    }
    first = false;
    const response = await route.fetch();
    completed.resolve();
    await release.promise;
    await route.fulfill({ response });
    delivered.resolve();
  });
  try {
    await open(page, fixture);
    await submit(page).click();
    await completed.promise;
    await page
      .getByRole("link", { name: "Próxima lição", exact: true })
      .click();
    await expect(page).toHaveURL("/courses/readiness/lessons/second");
    await expect(editor(page)).toBeVisible();
    release.resolve();
    await delivered.promise;
    await expect(results(page)).toContainText("Aguardando execução");
    expect(await submissions(page)).toEqual([]);
    await editor(page).fill(source);
    await submit(page).click();
    await expect(results(page)).toContainText(
      "Concluída pelos testes configurados",
      { timeout: 30000 },
    );
    expect(runs).toHaveLength(2);
    expect(await submissions(page)).toEqual([
      expect.objectContaining({ lesson: "second", state: "passed" }),
    ]);
  } finally {
    release.resolve();
  }
});

test("cancelling compilation prevents execution and late compilation cannot replace the next result", async ({
  page,
}) => {
  const runs = countRuns(page);
  await holdCompilation(page);
  await open(page);
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect
    .poll(
      () =>
        page.evaluate(() => (window as CompilationWindow).compilationWaiting),
      { timeout: 30000 },
    )
    .toBe(true);
  await page
    .getByRole("button", { name: "Cancelar operação", exact: true })
    .click();
  await page.evaluate(() =>
    (window as CompilationWindow).releaseCompilation!(),
  );
  await editor(page).fill('const broken: number = "wrong";');
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(results(page)).toContainText("Erros de compilação", {
    timeout: 30000,
  });
  expect(runs).toHaveLength(0);
  expect(await submissions(page)).toEqual([]);
});

test("rapid Run clicks share readiness and execute once without creating a submission", async ({
  page,
}) => {
  test.setTimeout(60000);
  const runs = countRuns(page);
  const held = await holdFirstRuntime(page);
  try {
    await open(page);
    await held.arrived.promise;
    await rapidClicks(page, "Run");
    await expect(results(page)).toContainText(waiting, { timeout: 30000 });
    held.release.resolve();
    await held.delivered.promise;
    await expect(results(page)).toContainText("Testes aprovados", {
      timeout: 30000,
    });
    expect(runs).toHaveLength(1);
    expect(await submissions(page)).toEqual([]);
  } finally {
    held.release.resolve();
  }
});
