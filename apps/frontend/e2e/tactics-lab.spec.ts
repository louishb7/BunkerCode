import { expect, test, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createRound,
  choices,
  executeRound,
  readSessionSeed,
  readSessionVersion,
  sessionReducer,
  startSession,
  type Round,
} from "../src/tactics/session";

const seed = 4812;
const kinds = [
  "complete-operator",
  "complete-step",
  "complete-condition",
  "repair-operator",
  "repair-step",
  "repair-condition",
];
const operation = (page: Page) =>
  page.getByRole("combobox", { name: /Operação no programa/ });
const runButton = (page: Page) =>
  page.getByRole("button", { name: "Executar", exact: true });
const stat = (page: Page, name: string) =>
  page.locator(`[data-stat="${name}"]`);
function answers(round: Round) {
  const results = choices(round).map((_choice, index) =>
    executeRound(round, index),
  );
  const correct = results.findIndex((result) => result.value.achieved);
  const wrong = results.findIndex((result) => !result.value.achieved);
  expect(correct).toBeGreaterThanOrEqual(0);
  expect(wrong).toBeGreaterThanOrEqual(0);
  return { correct, wrong, results };
}
async function openRound(page: Page, index: number) {
  await page.goto(`/lab/tactics?seed=${seed}`);
  for (let previous = 0; previous < index; previous++) {
    await page.getByRole("button", { name: "Pular", exact: true }).click();
    await expect(page.locator(".tactic-round")).toHaveAttribute(
      "data-index",
      String(previous + 1),
    );
  }
  await expect(page.locator(".tactic-round")).toHaveAttribute(
    "data-kind",
    kinds[index]!,
  );
}
async function displayedLines(page: Page) {
  return page.locator(".tactic-code-line code").evaluateAll((elements) =>
    elements.map((element) => {
      const clone = element.cloneNode(true) as HTMLElement;
      const select = clone.querySelector("select");
      if (select)
        select.replaceWith(
          element.querySelector("select")?.selectedOptions[0]?.textContent ??
            "",
        );
      return (clone.textContent ?? "").trimEnd();
    }),
  );
}
async function capture(page: Page, path: string) {
  // Full-page Chromium captures can include translated fixed elements when
  // scrolled. Return to the actual page top before capturing the whole page.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path, fullPage: true });
}

test("session controller pins identities, covers six modes and rejects stale or repeated actions", () => {
  const rounds = Array.from({ length: 18 }, (_, index) =>
    createRound(seed, index),
  );
  expect(rounds.slice(0, 6).map((round) => round.view.identity.kind)).toEqual(
    kinds,
  );
  expect(rounds.slice(0, 3).map((round) => round.view.identity.seed)).toEqual([
    4812, 2654440581, 1013909054,
  ]);
  expect(new Set(rounds.map((round) => round.view.identity.seed)).size).toBe(
    18,
  );
  rounds.forEach((round, index) => {
    expect(round.view.identity.generatorVersion).toBe(1);
    expect(round).toEqual(createRound(seed, index));
    if (index > 0) expect(round.family).not.toBe(rounds[index - 1]!.family);
  });
  for (const value of [
    "-1",
    "1.5",
    "4294967296",
    "01",
    "",
    "1e3",
    " 1",
    "+1",
    "NaN",
  ])
    expect(readSessionSeed(new URLSearchParams({ seed: value }))).toEqual({
      valid: false,
    });
  expect(readSessionSeed(new URLSearchParams("seed=1&seed=2"))).toEqual({
    valid: false,
  });
  expect(readSessionSeed(new URLSearchParams("seed=0"))).toEqual({
    valid: true,
    seed: 0,
  });
  expect(readSessionSeed(new URLSearchParams("seed=4294967295"))).toEqual({
    valid: true,
    seed: 4294967295,
  });
  for (const [sessionSeed, index] of [
    [-1, 0],
    [0, -1],
    [0, 0.5],
    [0x100000000, 0],
  ])
    expect(() => createRound(sessionSeed!, index!)).toThrow();
  let state = startSession(seed);
  const correct = answers(state.round).correct;
  state = sessionReducer(state, {
    type: "select",
    selection: correct,
    index: 0,
    seed,
  });
  state = sessionReducer(state, { type: "run", index: 0, seed });
  const solved = state;
  expect(state.solved).toBe(1);
  expect(sessionReducer(state, { type: "run", index: 0, seed })).toBe(solved);
  expect(sessionReducer(state, { type: "skip", index: 0, seed })).toBe(solved);
  state = sessionReducer(state, { type: "next", index: 0, seed });
  expect(state.index).toBe(1);
  expect(sessionReducer(state, { type: "next", index: 0, seed })).toBe(state);
  expect(
    sessionReducer(state, { type: "skip", index: 1, seed: seed + 1 }),
  ).toBe(state);
});

for (let index = 0; index < 6; index++) {
  test(`${kinds[index]} manipulates one slot, rejects a wrong choice and completes with the real evaluator`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await openRound(page, index);
    const round = createRound(seed, index);
    const { correct, wrong, results } = answers(round);
    const original = round.view.code.trimEnd().split("\n");
    expect(await displayedLines(page)).toEqual(original);
    await expect(runButton(page)).toBeDisabled();
    await expect(page.locator(".cm-editor")).toHaveCount(0);
    await expect(operation(page)).toHaveCount(1);
    await expect(operation(page)).toHaveValue("");
    await expect(
      page.locator(".tactic-options, .tactics-workspace, .tactic-goal"),
    ).toHaveCount(0);
    await expect(page.locator(".tactic-execution")).toHaveCount(0);
    await expect(page.locator(".tactic-objective")).toHaveCount(1);
    await expect(page.locator(".tactic-cases")).toHaveCount(
      round.family === "conditional" ? 1 : 0,
    );
    if (round.family === "conditional") {
      await expect(page.locator(".tactic-cases tbody tr")).toHaveText(
        round.view.inputs.map(
          (input, i) => `${input}→${round.view.expectedResults[i]}`,
        ),
      );
    }
    if (index === 0)
      await capture(page, info.outputPath("desktop-comparison-before.png"));
    await operation(page).selectOption(String(wrong));
    const edited = await displayedLines(page);
    const changed = edited.flatMap((line, lineIndex) =>
      line === original[lineIndex] ? [] : [lineIndex],
    );
    // A repair may deliberately select its already-present incorrect operator.
    const selectedLine =
      round.family === "assignment"
        ? 2 + round.view.stepIndex
        : round.family === "comparison"
          ? 3
          : 5;
    expect(changed.every((line) => line === selectedLine)).toBe(true);
    expect(edited[selectedLine]).toContain(choices(round)[wrong]);
    await expect(page.locator(".tactic-verdict")).toHaveCount(0);
    await runButton(page).click();
    await expect(page.locator(".tactic-verdict")).toContainText("Ainda não");
    await expect(stat(page, "solved")).toHaveText("0");
    await expect(stat(page, "performed")).toHaveText(String(index));
    await expect(
      page.getByRole("button", { name: "Próxima", exact: true }),
    ).toHaveCount(0);
    const wrongResult = results[wrong]!;
    const execution = page.getByRole("region", {
      name: "Resultado da execução",
    });
    if (
      wrongResult.family === "comparison" ||
      wrongResult.family === "assignment"
    ) {
      const produced =
        wrongResult.family === "comparison"
          ? `[${wrongResult.value.produced.join(", ")}]`
          : String(wrongResult.value.produced);
      const expected =
        wrongResult.family === "comparison"
          ? `[${wrongResult.value.expected.join(", ")}]`
          : String(wrongResult.value.expected);
      await expect(execution.locator(".tactic-result-pair")).toHaveText(
        `Produzido: ${produced} · Esperado: ${expected}`,
      );
    }
    if (wrongResult.family === "conditional") {
      await expect(execution.locator("summary")).toHaveText(
        wrongResult.value.traces.map(
          (trace, i) =>
            `${trace.input} → ${trace.result} · ${wrongResult.value.expected[i]}${trace.result === wrongResult.value.expected[i] ? "Confere" : "Diverge"}`,
        ),
      );
      await expect(execution.locator("details[open]")).toHaveCount(0);
      expect(
        await execution.locator("summary").allTextContents(),
      ).toContainEqual(expect.stringContaining("Diverge"));
    }
    // Re-running the same wrong choice remains a retry and never counts success.
    await runButton(page).click();
    await expect(stat(page, "solved")).toHaveText("0");
    await page
      .getByRole("combobox", { name: /Operação no programa/ })
      .selectOption(String(correct));
    await expect(page.locator(".tactic-execution")).toHaveCount(0);
    await expect(runButton(page)).toBeEnabled();
    await expect(page.getByRole("status")).toContainText(
      "Escolha aplicada ao código",
    );
    await runButton(page).click();
    await expect(page.locator(".tactic-verdict")).toHaveText(
      "Objetivo atingido.",
    );
    await expect(stat(page, "solved")).toHaveText("1");
    await expect(stat(page, "performed")).toHaveText(String(index + 1));
    await expect(runButton(page)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Pular", exact: true }),
    ).toHaveCount(0);
    await expect(operation(page)).toBeDisabled();
    const result = results[correct]!;
    if (result.family === "comparison" || result.family === "assignment") {
      const produced =
        result.family === "comparison"
          ? `[${result.value.produced.join(", ")}]`
          : String(result.value.produced);
      const expected =
        result.family === "comparison"
          ? `[${result.value.expected.join(", ")}]`
          : String(result.value.expected);
      await expect(execution.locator(".tactic-result-pair")).toHaveText(
        `Produzido: ${produced} · Esperado: ${expected}`,
      );
    }
    if (result.family === "assignment") {
      await expect(execution.locator("details[open]")).toHaveCount(0);
      if (index === 1)
        await capture(page, info.outputPath("desktop-assignment-result.png"));
      await execution.locator("summary").click();
      await expect(execution.locator(".tactic-trace")).toBeVisible();
      await expect(
        execution.locator(".tactic-trace li > code:last-child"),
      ).toHaveText([
        String(result.value.trace.initial),
        ...result.value.trace.transitions.map((transition) =>
          String(transition.after),
        ),
      ]);
      if (index === 1)
        await expect(execution.locator(".tactic-trace")).toHaveText(
          "Inicial-4value -= 3-7value -= 2-9",
        );
    }
    if (result.family === "conditional") {
      await expect(execution.locator("details[open]")).toHaveCount(0);
      await expect(execution.locator("summary")).toHaveText(
        result.value.traces.map(
          (trace, i) =>
            `${trace.input} → ${trace.result} · ${result.value.expected[i]}Confere`,
        ),
      );
      if (index === 2)
        await capture(page, info.outputPath("desktop-conditional-compact.png"));
      for (const [traceIndex, trace] of result.value.traces.entries()) {
        const detail = execution.locator("details").nth(traceIndex);
        if (!((await detail.getAttribute("open")) !== null))
          await detail.locator("summary").click();
        await expect(detail.locator("dd")).toHaveText([
          String(trace.afterPreparation),
          trace.comparison ? "Verdadeira" : "Falsa",
          trace.branch,
          String(trace.afterBranch),
          String(result.value.expected[traceIndex]),
        ]);
      }
      if (index === 2) {
        await expect(execution.locator("summary")).toHaveText([
          "0 → -9 · -9Confere",
          "2 → 2 · 2Confere",
          "1 → 1 · 1Confere",
        ]);
      }
    }
    await page.getByRole("button", { name: "Próxima", exact: true }).dblclick();
    await expect(page.locator(".tactic-round")).toHaveAttribute(
      "data-index",
      String(index + 1),
    );
    await expect(page.locator(".tactic-round h2")).toBeFocused();
    await expect(stat(page, "solved")).toHaveText("1");
    await expect(stat(page, "skipped")).toHaveText(String(index));
    await expect(page.locator(".tactic-verdict")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test("same URL seed reproduces the first round and reload resets session progress", async ({
  page,
}) => {
  await openRound(page, 0);
  const before = await displayedLines(page);
  const identity = await page
    .locator(".tactic-round")
    .getAttribute("data-seed");
  expect(before.join("\n")).toContain("const values = [3, 1, 5];");
  await page.getByRole("button", { name: "Pular", exact: true }).dblclick();
  await expect(stat(page, "skipped")).toHaveText("1");
  await expect(stat(page, "solved")).toHaveText("0");
  await expect(page.locator(".tactic-round")).toHaveAttribute(
    "data-index",
    "1",
  );
  await page.reload();
  await expect(page.locator(".tactic-round")).toHaveAttribute(
    "data-seed",
    identity!,
  );
  expect(await displayedLines(page)).toEqual(before);
  await expect(stat(page, "performed")).toHaveText("0");
});

test("twelve rounds form a milestone, continuation stays procedural and new session resets the URL seed", async ({
  page,
}) => {
  await openRound(page, 0);
  for (let index = 0; index < 12; index++) {
    const round = createRound(seed, index);
    const correct = answers(round).correct;
    await operation(page).selectOption(String(correct));
    await runButton(page).click();
    await expect(stat(page, "performed")).toHaveText(String(index + 1));
    if (index < 11)
      await page.getByRole("button", { name: "Próxima", exact: true }).click();
  }
  await expect(page.getByText(/Marco de 12 rodadas alcançado/)).toBeVisible();
  await expect(stat(page, "solved")).toHaveText("12");
  await page
    .getByRole("button", { name: "Continuar praticando", exact: true })
    .click();
  await expect(page.locator(".tactic-round")).toHaveAttribute(
    "data-index",
    "12",
  );
  await expect(page.locator(".tactic-round")).toHaveAttribute(
    "data-seed",
    String(createRound(seed, 12).view.identity.seed),
  );
  await expect(stat(page, "performed")).toHaveText("12");
  await expect(
    page.getByText(`Seed da sessão ${seed}`, { exact: false }),
  ).not.toBeVisible();
  await page.getByText("Opções da sessão", { exact: true }).click();
  await expect(page.locator(".tactics-session-info")).toContainText(
    String(seed),
  );
  await page.getByRole("button", { name: "Nova sessão", exact: true }).click();
  await expect(page).toHaveURL(/\/lab\/tactics\?seed=\d+&version=2$/);
  expect(new URL(page.url()).searchParams.get("seed")).not.toBe(String(seed));
  await expect(stat(page, "performed")).toHaveText("0");
  await expect(page.locator(".tactic-round")).toHaveAttribute(
    "data-index",
    "0",
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "Táticas" }),
  ).toBeFocused();
});

test("strict URL validation refuses incompatible seeds and offers a working new session", async ({
  page,
}) => {
  for (const query of [
    "seed=-1",
    "seed=1.5",
    "seed=4294967296",
    "seed=01",
    "seed=",
    "seed=1&seed=2",
  ]) {
    await page.goto(`/lab/tactics?${query}`);
    await expect(page.getByRole("alert")).toContainText("Seed inválida");
    await expect(page.locator(".tactic-round")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Nova sessão", exact: true }).click();
  await expect(page.locator(".tactic-round")).toBeVisible();
  for (const valid of ["0", "4294967295"]) {
    await page.goto(`/lab/tactics?seed=${valid}`);
    await expect(page.locator(".tactic-round")).toHaveAttribute(
      "data-seed",
      valid,
    );
  }
});

test("cold lazy route runs every mode without API, storage, workers or dynamic source execution", async ({
  page,
}) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      apiRequests.push(request.url());
  });
  await page.route("**/api/**", (route) => route.abort());
  await page.addInitScript(() => {
    const forbidden = () => {
      throw new Error("Forbidden in Tactics Lab");
    };
    Object.defineProperty(globalThis, "eval", { value: forbidden });
    Object.defineProperty(globalThis, "Function", { value: forbidden });
    Object.defineProperty(globalThis, "Worker", { value: forbidden });
    indexedDB.open = forbidden;
    Storage.prototype.setItem = forbidden;
  });
  await openRound(page, 0);
  for (let index = 0; index < 6; index++) {
    const round = createRound(seed, index);
    await page
      .getByRole("combobox", { name: /Operação no programa/ })
      .selectOption(String(answers(round).correct));
    await runButton(page).click();
    await expect(page.locator(".tactic-verdict")).toHaveText(
      "Objetivo atingido.",
    );
    await page.getByRole("button", { name: "Próxima", exact: true }).click();
  }
  expect(apiRequests).toEqual([]);
});

test("production graph defers the lab from the catalog and route errors preserve the shell", async ({
  page,
}) => {
  const manifest = JSON.parse(
    await readFile(resolve("dist/.vite/manifest.json"), "utf8"),
  ) as Record<string, { file: string; isDynamicEntry?: boolean }>;
  const lab = manifest["src/tactics/TacticsLab.tsx"]!;
  expect(lab.isDynamicEntry).toBe(true);
  const requests: string[] = [];
  page.on("request", (request) =>
    requests.push(new URL(request.url()).pathname),
  );
  await page.goto("/courses");
  await expect(
    page.getByRole("heading", { level: 1, name: "Cursos" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Táticas", exact: true }),
  ).toHaveCount(0);
  expect(requests).not.toContain("/" + lab.file);
  await page.route("**/" + lab.file, (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.goto(`/lab/tactics?seed=${seed}`);
  await expect(
    page.getByText("Não foi possível carregar esta página. Tente novamente."),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Navegação principal" }),
  ).toBeVisible();
});

test("keyboard can choose, execute, retry and advance with predictable focus", async ({
  page,
}) => {
  await openRound(page, 0);
  await expect(
    page.getByRole("heading", { level: 1, name: "Táticas" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Código com rolagem horizontal")).toBeFocused();
  await page.keyboard.press("Tab");
  const inline = page.getByRole("combobox", { name: /Operação no programa/ });
  await expect(inline).toBeFocused();
  await page.keyboard.press("End");
  await expect(inline).toHaveValue("5");
  await expect(page.locator(".tactic-verdict")).toHaveCount(0);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Pular", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(runButton(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".tactic-verdict")).toContainText("Ainda não");
  const correct = answers(createRound(seed, 0)).correct;
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(inline).toBeFocused();
  await page.keyboard.press("Home");
  for (let index = 0; index < correct; index++)
    await page.keyboard.press("ArrowDown");
  await expect(inline).toHaveValue(String(correct));
  await expect(page.getByRole("status")).toContainText(
    "Escolha aplicada ao código",
  );
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(runButton(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".tactic-verdict")).toHaveText(
    "Objetivo atingido.",
  );
  await expect(
    page.getByRole("button", { name: "Próxima", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".tactic-round h2")).toBeFocused();
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
  { width: 360, height: 640 },
]) {
  test(`layout and real controls at ${viewport.width}x${viewport.height}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openRound(page, 0);
    for (let index = 0; index < 3; index++) {
      const round = createRound(seed, index);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const inline = page.getByRole("combobox", {
        name: /Operação no programa/,
      });
      const touch = await inline.boundingBox();
      expect(touch!.height).toBeGreaterThanOrEqual(44);
      await expect(operation(page)).toHaveValue("");
      await expect(page.locator(".tactic-execution")).toHaveCount(0);
      await expect(
        page.locator(".tactic-options, .tactics-workspace"),
      ).toHaveCount(0);
      if (viewport.width === 390 && index === 1)
        await capture(page, info.outputPath("mobile-before-execution.png"));
      await operation(page).selectOption(String(answers(round).correct));
      if (viewport.width >= 1000) {
        expect(await page.evaluate(() => window.scrollY)).toBe(0);
        for (const element of [
          page.locator(".tactic-objective"),
          page.locator(".tactic-program"),
          runButton(page),
        ]) {
          const box = await element.boundingBox();
          expect(box!.y).toBeGreaterThanOrEqual(0);
          expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
        }
      }
      await runButton(page).click();
      await expect(page.locator(".tactic-verdict")).toHaveText(
        "Objetivo atingido.",
      );
      await expect(page.locator(".tactic-execution details[open]")).toHaveCount(
        0,
      );
      if (viewport.width === 390 && index === 1) {
        await capture(page, info.outputPath("mobile-result-collapsed.png"));
        await page
          .getByText("Ver execução passo a passo", { exact: true })
          .click();
        await expect(page.locator(".tactic-trace")).toBeVisible();
        await capture(page, info.outputPath("mobile-result-expanded.png"));
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.getByRole("button", { name: "Próxima", exact: true }).click();
      await expect(page.locator(".tactic-round h2")).toBeFocused();
    }
  });
}

async function openOrdering(page: Page, index = 0) {
  await page.goto(`/lab/tactics?seed=${seed}&version=2`);
  for (let previous = 0; previous < index; previous++) {
    await page.getByRole("button", { name: "Pular", exact: true }).click();
    await expect(page.locator(".tactic-round")).toHaveAttribute(
      "data-index",
      String(previous + 1),
    );
  }
  await expect(page.locator(".tactic-round")).toHaveAttribute(
    "data-kind",
    "order-program",
  );
}
async function currentOrder(page: Page) {
  const rows = await page.locator(".tactic-order-blocks > li").all();
  return Promise.all(
    rows.map(async (row) => {
      const id = await row.getAttribute("data-block-id");
      if (!id) throw new Error("Missing block identity");
      return id;
    }),
  );
}
async function arrange(
  page: Page,
  target: readonly string[],
  interaction: "mouse" | "keyboard" | "touch" = "mouse",
) {
  for (let index = 0; index < target.length; index++) {
    const id = target[index]!;
    while ((await currentOrder(page)).indexOf(id) > index) {
      const up = page.locator(
        `[data-block-id="${id}"] button[data-direction="-1"]`,
      );
      if (interaction === "touch") await up.tap();
      else if (interaction === "keyboard") {
        await up.focus();
        await up.press("Enter");
      } else await up.click();
      const position = (await currentOrder(page)).indexOf(id);
      await expect(
        page.locator(
          `[data-block-id="${id}"] button[data-direction="${position === 0 ? 1 : -1}"]`,
        ),
      ).toBeFocused();
    }
  }
  expect(await currentOrder(page)).toEqual(target);
}
function orderingRound(index: number) {
  const round = createRound(seed, index, 2);
  if (round.family !== "collection")
    throw new Error("Expected collection round");
  return round;
}

test("v2 scheduling alternates actual mechanics, rotates four structures and preserves v1 identities and URL compatibility", () => {
  expect(readSessionVersion(new URLSearchParams())).toBe(2);
  expect(readSessionVersion(new URLSearchParams("seed=4812"))).toBe(1);
  expect(readSessionVersion(new URLSearchParams("seed=4812&version=1"))).toBe(
    1,
  );
  for (const query of [
    "version=0",
    "version=3",
    "version=01",
    "version=",
    "version=1&version=2",
  ])
    expect(readSessionVersion(new URLSearchParams(query))).toBeNull();
  for (const sessionSeed of [0, 1, 4812, 4294967295]) {
    const rounds = Array.from({ length: 24 }, (_value, index) =>
      createRound(sessionSeed, index, 2),
    );
    expect(
      rounds.slice(0, 12).filter((round) => round.family === "collection"),
    ).toHaveLength(6);
    expect(rounds[0]!.family).toBe("collection");
    const recent: string[] = [];
    rounds.forEach((round, index) => {
      expect(round).toEqual(createRound(sessionSeed, index, 2));
      if (round.family === "collection") {
        expect(recent.slice(-3)).not.toContain(round.view.identity.structure);
        recent.push(round.view.identity.structure);
      } else expect(rounds[index - 1]?.family).toBe("collection");
    });
    expect(new Set(recent).size).toBe(4);
    for (let index = 0; index < 18; index++)
      expect(createRound(sessionSeed, index, 1)).toEqual(
        createRound(sessionSeed, index),
      );
  }
  const state = startSession(seed, 2);
  expect(
    sessionReducer(state, { type: "skip", index: 0, seed, version: 1 }),
  ).toBe(state);
  expect(
    sessionReducer(state, {
      type: "move",
      index: 0,
      seed,
      version: 2,
      blockId: "unknown",
      direction: 1,
    }),
  ).toBe(state);
  expect(
    sessionReducer(state, {
      type: "select",
      index: 0,
      seed,
      version: 2,
      selection: 0,
    }),
  ).toBe(state);
});

test("ordering reports a dependency error, invalidates stale feedback, solves by mouse and advances once", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openOrdering(page);
  const round = orderingRound(0);
  const target = round.model.reference.blocks.map((block) => block.id);
  expect(await currentOrder(page)).toEqual(
    round.view.blocks.map((block) => block.id),
  );
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await expect(page.locator(".tactic-execution, .tactic-options")).toHaveCount(
    0,
  );
  await capture(page, info.outputPath("desktop-ordering-01-before.png"));
  await runButton(page).click();
  await expect(page.locator(".tactic-dependency")).toContainText("precisa de");
  await expect(stat(page, "solved")).toHaveText("0");
  await capture(page, info.outputPath("desktop-ordering-02-invalid.png"));
  await arrange(page, target);
  await expect(page.locator(".tactic-execution")).toHaveCount(0);
  await capture(page, info.outputPath("desktop-ordering-03-rearranged.png"));
  await runButton(page).click();
  await expect(page.locator(".tactic-verdict")).toHaveText(
    "Objetivo atingido.",
  );
  await expect(page.locator(".tactic-result-pair")).toHaveText(
    `Produzido: ${JSON.stringify(round.view.expectedResult)} · Esperado: ${JSON.stringify(round.view.expectedResult)}`,
  );
  await expect(page.locator(".tactic-execution details[open]")).toHaveCount(0);
  await expect(
    page.locator(".tactic-order-controls button:enabled"),
  ).toHaveCount(0);
  await capture(page, info.outputPath("desktop-ordering-04-correct.png"));
  await page.getByText("Ver execução passo a passo", { exact: true }).click();
  await expect(page.locator(".tactic-collection-trace li")).toHaveCount(
    target.length,
  );
  await expect(
    page.locator(".tactic-collection-trace li:last-child"),
  ).toContainText(JSON.stringify(round.view.expectedResult));
  await page.getByRole("button", { name: "Próxima", exact: true }).dblclick();
  await expect(page.locator(".tactic-round")).toHaveAttribute(
    "data-index",
    "1",
  );
  await expect(page.locator(".tactic-objective")).toBeFocused();
  await expect(stat(page, "solved")).toHaveText("1");
  await expect(stat(page, "skipped")).toHaveText("0");
  await capture(page, info.outputPath("desktop-sequence-02-comparison.png"));
});

test("ordering accepts semantically equivalent orders and shows a valid but incorrect mutation result", async ({
  page,
}) => {
  await openOrdering(page, 4);
  const mutation = orderingRound(4);
  expect(mutation.view.identity.structure).toBe("filter-map-reverse-join");
  const wrong = ["filter", "map", "join", "reverse"];
  await arrange(page, wrong);
  await runButton(page).click();
  const actual = executeRound(mutation, wrong).value;
  await expect(page.locator(".tactic-dependency")).toHaveCount(0);
  await expect(page.locator(".tactic-result-pair")).toHaveText(
    `Produzido: ${JSON.stringify(actual.produced)} · Esperado: ${JSON.stringify(actual.expected)}`,
  );
  await expect(page.locator(".tactic-verdict")).toContainText("Ainda não");
  await expect(stat(page, "solved")).toHaveText("0");
  await arrange(
    page,
    mutation.model.reference.blocks.map((block) => block.id),
  );
  await expect(page.locator(".tactic-execution")).toHaveCount(0);
  await runButton(page).click();
  await expect(page.locator(".tactic-verdict")).toHaveText(
    "Objetivo atingido.",
  );
  await openOrdering(page, 6);
  const equivalent = ["fallback", "target", "find", "resolve", "uppercase"];
  expect(equivalent).not.toEqual(
    orderingRound(6).model.reference.blocks.map((block) => block.id),
  );
  await arrange(page, equivalent);
  await runButton(page).click();
  await expect(page.locator(".tactic-verdict")).toHaveText(
    "Objetivo atingido.",
  );
});

test("ordering keyboard movement retains focus through boundaries and success", async ({
  page,
}) => {
  await openOrdering(page);
  await page.keyboard.press("Tab");
  await expect(
    page.getByLabel("Dados de entrada com rolagem horizontal"),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByLabel("Instrução 1, código com rolagem horizontal"),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Descer instrução 1", exact: true }),
  ).toBeFocused();
  const moved = (await currentOrder(page))[0]!;
  await page.keyboard.press("Alt+ArrowDown");
  expect((await currentOrder(page))[1]).toBe(moved);
  await expect(
    page.locator(`[data-block-id="${moved}"] button[data-direction="1"]`),
  ).toBeFocused();
  await arrange(
    page,
    orderingRound(0).model.reference.blocks.map((block) => block.id),
    "keyboard",
  );
  await runButton(page).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Próxima", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".tactic-objective")).toBeFocused();
});

test("ordering supports real touch events and fits the narrow viewport without page overflow", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  try {
    await openOrdering(page);
    await capture(page, info.outputPath("mobile-ordering-before.png"));
    await arrange(
      page,
      orderingRound(0).model.reference.blocks.map((block) => block.id),
      "touch",
    );
    await runButton(page).tap();
    await expect(page.locator(".tactic-verdict")).toHaveText(
      "Objetivo atingido.",
    );
    await page.getByText("Ver execução passo a passo", { exact: true }).tap();
    await expect(page.locator(".tactic-collection-trace")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await capture(
      page,
      info.outputPath("mobile-ordering-correct-expanded.png"),
    );
    await page.getByRole("button", { name: "Próxima", exact: true }).tap();
    await expect(page.locator(".tactic-round")).toHaveAttribute(
      "data-index",
      "1",
    );
  } finally {
    await context.close();
  }
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
  { width: 360, height: 640 },
]) {
  test(`ordering structures remain contained at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const index of [0, 2, 4, 6]) {
      await openOrdering(page, index);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const button = page
        .locator(".tactic-order-controls button:enabled")
        .first();
      const box = await button.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
      if (viewport.width >= 1280) {
        const actions = await runButton(page).boundingBox();
        expect(actions!.y + actions!.height).toBeLessThanOrEqual(
          viewport.height,
        );
        expect(await page.evaluate(() => window.scrollY)).toBe(0);
      }
      await arrange(
        page,
        orderingRound(index).model.reference.blocks.map((block) => block.id),
      );
      await runButton(page).click();
      await expect(page.locator(".tactic-verdict")).toHaveText(
        "Objetivo atingido.",
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  });
}

test("a real 24-round v2 session alternates mechanics offline and records structural diversity", async ({
  page,
}, info) => {
  await page.route("**/api/**", (route) => route.abort());
  await page.addInitScript(() => {
    const forbidden = () => {
      throw new Error("Forbidden in Tactics Lab");
    };
    Object.defineProperty(globalThis, "eval", { value: forbidden });
    Object.defineProperty(globalThis, "Function", { value: forbidden });
    Object.defineProperty(globalThis, "Worker", { value: forbidden });
    indexedDB.open = forbidden;
    Storage.prototype.setItem = forbidden;
  });
  await page.goto(`/lab/tactics?seed=${seed}&version=2`);
  const audit = [];
  for (let index = 0; index < 24; index++) {
    const round = createRound(seed, index, 2);
    await expect(page.locator(".tactic-round")).toHaveAttribute(
      "data-index",
      String(index),
    );
    await expect(page.locator(".tactic-round")).toHaveAttribute(
      "data-family",
      round.view.identity.family,
    );
    let answer: number | readonly string[];
    if (round.family === "collection") {
      answer = round.model.reference.blocks.map((block) => block.id);
      await arrange(page, answer);
      if (index === 2)
        await page.screenshot({
          path: info.outputPath("desktop-sequence-03-finding.png"),
          fullPage: true,
        });
    } else {
      answer = answers(round).correct;
      await operation(page).selectOption(String(answer));
    }
    const validation = executeRound(round, answer);
    await runButton(page).click();
    await expect(page.locator(".tactic-verdict")).toHaveText(
      "Objetivo atingido.",
    );
    await expect(stat(page, "performed")).toHaveText(String(index + 1));
    audit.push({
      index: index + 1,
      seed: round.view.identity.seed,
      family: round.view.identity.family,
      kind: round.view.identity.kind,
      structure:
        round.family === "collection"
          ? round.view.identity.structure
          : round.family,
      pattern:
        round.family === "collection"
          ? round.view.pattern
          : round.view.identity.family,
      interaction:
        round.family === "collection" ? "code-ordering" : "point-replacement",
      blocks: round.family === "collection" ? round.view.blocks.length : null,
      validation: validation.value.status,
      achieved: validation.value.achieved,
      program:
        round.family === "collection"
          ? round.model.reference.code
          : round.view.code,
      produced: validation.value.produced,
    });
    if (index < 23)
      await page
        .getByRole("button", {
          name: index === 11 ? "Continuar praticando" : "Próxima",
          exact: true,
        })
        .click();
  }
  expect(
    audit.filter((row) => row.interaction === "code-ordering"),
  ).toHaveLength(12);
  expect(
    new Set(
      audit.filter((row) => row.blocks !== null).map((row) => row.structure),
    ).size,
  ).toBe(4);
  await expect(stat(page, "solved")).toHaveText("24");
  await expect(stat(page, "skipped")).toHaveText("0");
  await writeFile(
    info.outputPath("session-24.json"),
    JSON.stringify({ sessionSeed: seed, version: 2, rounds: audit }, null, 2),
  );
});

test("the default route opens v2, its replay link reproduces the shuffled program and invalid versions are refused", async ({
  page,
}) => {
  await page.goto("/lab/tactics");
  await expect(page.locator(".tactic-ordering")).toBeVisible();
  const before = await page.locator(".tactic-ordering").textContent();
  await page.getByText("Opções da sessão", { exact: true }).click();
  const link = await page
    .getByRole("link", { name: "Reproduzir sessão", exact: true })
    .getAttribute("href");
  expect(link).toMatch(/\?seed=\d+&version=2/);
  await page.goto(`/lab/tactics${link}`);
  await expect(page.locator(".tactic-ordering")).toHaveText(before!);
  for (const query of [
    "version=0",
    "version=3",
    "version=01",
    "version=1&version=2",
  ]) {
    await page.goto(`/lab/tactics?seed=${seed}&${query}`);
    await expect(page.getByRole("alert")).toContainText(
      "Versão de sessão inválida",
    );
    await expect(page.locator(".tactic-round")).toHaveCount(0);
  }
});
