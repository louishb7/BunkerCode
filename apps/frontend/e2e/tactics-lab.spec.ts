import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createRound,
  choices,
  executeRound,
  readSessionSeed,
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
  await expect(page).toHaveURL(/\/lab\/tactics\?seed=\d+$/);
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
