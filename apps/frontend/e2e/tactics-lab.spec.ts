import { createHash } from "node:crypto";
import legacySessions from "./session-legacy.json" with { type: "json" };
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
    const initialLines = await displayedLines(page);
    const editableLine =
      round.family === "assignment"
        ? 2 + round.view.stepIndex
        : round.family === "comparison"
          ? 3
          : 5;
    expect(initialLines.filter((_, index) => index !== editableLine)).toEqual(
      original.filter((_, index) => index !== editableLine),
    );
    expect(initialLines[editableLine]).toContain("Selecione…");
    await expect(page.locator(".tactic-instruction")).toBeVisible();
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
  await expect(page).toHaveURL(/\/tactics\?seed=\d+&version=3$/);
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
  ).toHaveAttribute("href", "/tactics");
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
  expect(readSessionVersion(new URLSearchParams())).toBe(3);
  expect(readSessionVersion(new URLSearchParams("seed=4812"))).toBe(1);
  expect(readSessionVersion(new URLSearchParams("seed=4812&version=1"))).toBe(
    1,
  );
  for (const query of [
    "version=0",
    "version=4",
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

test("the explicit v2 route opens ordering, its replay link reproduces the shuffled program and invalid versions are refused", async ({
  page,
}) => {
  await page.goto("/lab/tactics?version=2");
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
    "version=4",
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

test("pinned pre-sprint hashes preserve every legacy v1/v2 program, public payload and answer", () => {
  for (const fixture of legacySessions)
    fixture.hashes.forEach((hash, index) => {
      const round = createRound(fixture.seed, index, fixture.version as 1 | 2);
      expect(
        createHash("sha256").update(JSON.stringify(round)).digest("hex"),
      ).toBe(hash);
    });
});

test("v3 deterministically balances three mechanics and rotates all iteration and ordering patterns", async ({
  browserName,
}, info) => {
  const audit: Array<{
    sessionSeed: number;
    length: number;
    index: number;
    identity: Round["view"]["identity"];
    interaction: string;
    signature: string;
    evaluation: string;
    achieved: boolean;
    recentRepeat: boolean;
  }> = [];
  for (const sessionSeed of [0, 1, 4812, 4294967295])
    for (const length of [12, 24, 60]) {
      const rounds = Array.from({ length }, (_, i) =>
        createRound(sessionSeed, i, 3),
      );
      const mechanic = (r: Round) =>
        r.family === "iteration"
          ? "investigation"
          : r.family === "collection"
            ? "ordering"
            : "intervention";
      expect(new Set(rounds.slice(0, 3).map(mechanic)).size).toBe(3);
      for (const kind of ["investigation", "ordering", "intervention"])
        expect(rounds.filter((r) => mechanic(r) === kind)).toHaveLength(
          length / 3,
        );
      expect(
        new Set(
          rounds
            .slice(0, 12)
            .filter((r) => r.family === "iteration")
            .map((r) => r.view.identity.pattern),
        ).size,
      ).toBe(4);
      expect(
        new Set(
          rounds
            .slice(0, 12)
            .filter((r) => r.family === "collection")
            .map((r) => r.view.identity.structure),
        ).size,
      ).toBe(4);
      const orders: string[] = [],
        patterns: string[] = [];
      const triples = new Set<string>();
      rounds.forEach((round, index) => {
        expect(round).toEqual(createRound(sessionSeed, index, 3));
        if (index)
          expect(mechanic(round)).not.toBe(mechanic(rounds[index - 1]!));
        if (index % 3 === 0)
          triples.add(
            rounds
              .slice(index, index + 3)
              .map(mechanic)
              .join("/"),
          );
        if (round.family === "collection") {
          expect(orders.slice(-3)).not.toContain(round.view.identity.structure);
          orders.push(round.view.identity.structure);
        }
        if (round.family === "iteration") {
          expect(patterns.slice(-3)).not.toContain(round.view.identity.pattern);
          patterns.push(round.view.identity.pattern);
        }
        const answer =
          round.family === "iteration"
            ? round.model.faultId
            : round.family === "collection"
              ? round.model.reference.blocks.map((b) => b.id)
              : answers(round).correct;
        const result = executeRound(round, answer);
        expect(result.value.achieved).toBe(true);
        audit.push({
          sessionSeed,
          length,
          index,
          identity: round.view.identity,
          interaction: mechanic(round),
          signature:
            round.family === "iteration"
              ? round.view.identity.pattern
              : round.family === "collection"
                ? round.view.identity.structure
                : round.view.identity.kind,
          evaluation: result.value.status,
          achieved: result.value.achieved,
          recentRepeat: false,
        });
      });
      expect(triples.size).toBeGreaterThan(1);
    }
  await writeFile(
    info.outputPath("session-distributions.json"),
    JSON.stringify({ browserName, rounds: audit }, null, 2),
  );
});

async function skipCurrent(page: Page) {
  await page.getByRole("button", { name: "Pular", exact: true }).click();
  if (await page.locator(".investigation-reveal").count())
    await page
      .getByRole("button", { name: /^(Próxima|Continuar praticando)$/ })
      .click();
}
async function openInvestigation(page: Page, sessionSeed = seed) {
  await page.goto(`/tactics?seed=${sessionSeed}&version=3`);
  let index = 0;
  while (createRound(sessionSeed, index, 3).family !== "iteration") {
    await skipCurrent(page);
    index++;
  }
  const round = createRound(sessionSeed, index, 3);
  if (round.family !== "iteration") throw new Error("Expected investigation");
  await expect(page.locator(".tactic-investigation")).toBeVisible();
  return round;
}
const diagnose = (page: Page) =>
  page.getByRole("button", { name: "Confirmar diagnóstico", exact: true });

test("global navigation, active state, history, refresh, replay, legacy queries and default v3 work with API offline", async ({
  page,
}, info) => {
  await page.route("**/api/**", (r) => r.abort());
  await page.goto("/");
  const tactics = page
    .getByRole("navigation")
    .getByRole("link", { name: "Táticas", exact: true });
  await expect(tactics).toBeVisible();
  await expect(tactics).not.toHaveAttribute("aria-current", "page");
  await capture(page, info.outputPath("home-tactics-offline.png"));
  await tactics.click();
  await expect(page).toHaveURL(/\/tactics$/);
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "Táticas" }),
  ).toHaveAttribute("aria-current", "page");
  const firstIdentity = await page
    .locator(".tactic-round")
    .getAttribute("data-seed");
  await page.getByText("Opções da sessão", { exact: true }).click();
  const replay = await page
    .getByRole("link", { name: "Reproduzir sessão" })
    .getAttribute("href");
  expect(replay).toMatch(/^\?seed=\d+&version=3$/);
  const sessionSeed = new URLSearchParams(replay!).get("seed")!;
  await capture(page, info.outputPath("official-tactics-navigation.png"));
  await page.goBack();
  await expect(page).toHaveURL("/");
  await expect(tactics).not.toHaveAttribute("aria-current", "page");
  await page.goForward();
  await expect(tactics).toHaveAttribute("aria-current", "page");
  await page.goBack();
  await expect(page).toHaveURL("/");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Táticas" })
    .click();
  await expect(page.locator(".tactic-round")).toBeVisible();
  await page.goto(`/tactics${replay}`);
  await expect(page.locator(".tactic-round")).toHaveAttribute(
    "data-index",
    "0",
  );
  await expect(page.locator(".tactic-round")).toHaveAttribute(
    "data-seed",
    firstIdentity!,
  );
  await expect(page.locator(".tactics-session-info")).toContainText(
    `Seed da sessão ${sessionSeed} · Versão 3`,
  );
  const before = await page.locator(".tactic-round").textContent();
  await skipCurrent(page);
  await page.reload();
  await expect(page.locator(".tactic-round")).toHaveText(before!);
  await expect(page.locator(".tactic-round")).toHaveAttribute(
    "data-seed",
    firstIdentity!,
  );
  await expect(page.locator(".tactic-round")).toHaveAttribute(
    "data-index",
    "0",
  );
  await page.goto("/lab/tactics?seed=4812&version=2&extra=a%2Fb#programa");
  await expect(page).toHaveURL(
    "/tactics?seed=4812&version=2&extra=a%2Fb#programa",
  );
  await expect(page.locator(".tactic-round")).toHaveAttribute(
    "data-kind",
    "order-program",
  );
  await expect(page.locator(".tactics-session-info")).toContainText(
    "Seed da sessão 4812 · Versão 2",
  );
});

test("investigation traces, wrong diagnosis, correction, explicit evaluation, disclosure and skip are playable", async ({
  page,
}, info) => {
  const round = await openInvestigation(page);
  await expect(diagnose(page)).toBeDisabled();
  await expect(page.locator(".is-suspect,.is-current")).toHaveCount(0);
  await capture(page, info.outputPath("investigation-before.png"));
  await page.getByRole("button", { name: "Iniciar execução" }).click();
  await expect(page.locator(".is-current")).toHaveAttribute(
    "data-instruction-id",
    "initialize",
  );
  await page
    .getByRole("button", { name: "Próximo passo", exact: true })
    .click();
  await expect(page.locator(".investigation-state")).toContainText(
    "Iteração 1",
  );
  await page
    .getByRole("button", { name: "Passo anterior", exact: true })
    .click();
  await expect(page.locator(".investigation-state")).toContainText(
    "Estado inicial",
  );
  await page.getByRole("button", { name: "Ver resultado final" }).click();
  await expect(page.locator(".investigation-state")).toContainText(
    "Resultado final",
  );
  await capture(page, info.outputPath("investigation-trace.png"));
  await page.locator('[data-instruction-id="initialize"]').click();
  await expect(page.locator(".tactic-verdict")).toHaveCount(0);
  await diagnose(page).click();
  await expect(page.locator(".tactic-verdict")).toContainText(
    "não corresponde",
  );
  await expect(
    page.getByText("Ver instrução correta", { exact: true }),
  ).toHaveCount(0);
  const target = page.locator(`[data-instruction-id="${round.model.faultId}"]`);
  await target.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".tactic-verdict")).toHaveCount(0);
  await diagnose(page).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".tactic-verdict")).toHaveText(
    "Diagnóstico correto.",
  );
  await expect(page.locator(".investigation-correction code")).toHaveText(
    round.model.reference.lines
      .find((l) => l.instructionId === round.model.faultId)!
      .text.trim(),
  );
  await capture(page, info.outputPath("investigation-diagnosed.png"));
  await page.getByRole("button", { name: "Próxima", exact: true }).click();
  await expect(page.locator(".tactic-objective")).toBeFocused();
  await openInvestigation(page);
  await page.getByRole("button", { name: "Pular", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Origem do defeito" }),
  ).toContainText("Pulada");
  await page.getByText("Opções da sessão", { exact: true }).click();
  await expect(stat(page, "solved")).toHaveText("0");
  await expect(stat(page, "skipped")).toHaveText(
    String(
      Number(await page.locator(".tactic-round").getAttribute("data-index")) +
        1,
    ),
  );
  await page.getByRole("button", { name: "Próxima", exact: true }).click();
  await expect(page.locator(".tactic-objective")).toBeFocused();
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
  { width: 360, height: 640 },
]) {
  test(`investigation and official header fit ${viewport.width}x${viewport.height}`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport,
      hasTouch: viewport.width < 600,
      isMobile: viewport.width < 600,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    try {
      const round = await openInvestigation(page);
      await expect(
        page.getByRole("navigation").getByRole("link", { name: "Táticas" }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await capture(
        page,
        info.outputPath(`initial-${viewport.width}x${viewport.height}.png`),
      );
      await page.getByRole("button", { name: "Iniciar execução" }).click();
      await page
        .getByRole("button", { name: "Próximo passo", exact: true })
        .click();
      await capture(
        page,
        info.outputPath(`running-${viewport.width}x${viewport.height}.png`),
      );
      const source = page.locator(".investigation-source");
      expect(
        await source.evaluate(
          (element) => element.scrollHeight <= element.clientHeight,
        ),
      ).toBe(true);
      await page.locator('[data-instruction-id="initialize"]').click();
      await diagnose(page).click();
      await expect(page.locator(".tactic-verdict.retry")).toHaveCount(1);
      await capture(
        page,
        info.outputPath(`wrong-${viewport.width}x${viewport.height}.png`),
      );
      await page.getByRole("button", { name: "Pular", exact: true }).click();
      await expect(
        page.locator(".tactic-verdict.retry,.is-suspect,.is-current"),
      ).toHaveCount(0);
      await expect(page.locator(".is-revealed")).toHaveAttribute(
        "data-instruction-id",
        round.model.faultId,
      );
      await capture(
        page,
        info.outputPath(`skipped-${viewport.width}x${viewport.height}.png`),
      );
      await openInvestigation(page);
      await page.getByRole("button", { name: "Ver resultado final" }).click();
      const control = page.locator(
        `[data-instruction-id="${round.model.faultId}"]`,
      );
      if (viewport.width < 600) {
        await control.tap();
        await diagnose(page).tap();
      } else {
        await control.click();
        await diagnose(page).click();
      }
      await expect(page.locator(".tactic-verdict")).toHaveText(
        "Diagnóstico correto.",
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        await page.locator(".investigation-correction").evaluate((element) => {
          const next = document.querySelector(".tactic-actions button");
          return (
            next !== null &&
            Boolean(
              element.compareDocumentPosition(next) &
              Node.DOCUMENT_POSITION_FOLLOWING,
            )
          );
        }),
      ).toBe(true);
      await capture(
        page,
        info.outputPath(
          `investigation-${viewport.width}x${viewport.height}.png`,
        ),
      );
    } finally {
      await context.close();
    }
  });
}

test("a real 24-round v3 browser session solves every mechanic offline and records all four iteration patterns", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await page.route("**/api/**", (route) => route.abort());
  await page.addInitScript(() => {
    const forbidden = () => {
      throw new Error("Dynamic execution forbidden");
    };
    Object.defineProperty(globalThis, "eval", { value: forbidden });
    Object.defineProperty(globalThis, "Function", { value: forbidden });
    Object.defineProperty(globalThis, "Worker", { value: forbidden });
    indexedDB.open = forbidden;
    Storage.prototype.setItem = forbidden;
  });
  await page.goto(`/tactics?seed=${seed}&version=3`);
  const audit = [];
  for (let index = 0; index < 24; index++) {
    const round = createRound(seed, index, 3);
    await expect(page.locator(".tactic-round")).toHaveAttribute(
      "data-index",
      String(index),
    );
    await expect(page.locator(".tactic-round")).toHaveAttribute(
      "data-kind",
      round.view.identity.kind,
    );
    await expect(page.locator(".tactic-round")).toHaveAttribute(
      "data-seed",
      String(round.view.identity.seed),
    );
    await expect(page.locator(".tactic-round")).toHaveAttribute(
      "data-family",
      round.view.identity.family,
    );
    if (round.family === "iteration")
      await expect(page.locator(".tactic-objective")).toHaveText(
        round.view.objective,
      );
    let answer: number | string | readonly string[];
    if (round.family === "iteration") {
      answer = round.model.faultId;
      await page.getByRole("button", { name: "Ver resultado final" }).click();
      await expect(page.locator(".investigation-state")).toContainText(
        "Resultado final",
      );
      await page.locator(`[data-instruction-id="${answer}"]`).click();
      await diagnose(page).click();
    } else if (round.family === "collection") {
      answer = round.model.reference.blocks.map((b) => b.id);
      await arrange(page, answer);
      await runButton(page).click();
    } else {
      answer = answers(round).correct;
      await operation(page).selectOption(String(answer));
      await runButton(page).click();
    }
    await expect(page.locator(".tactic-verdict")).toHaveText(
      round.family === "iteration"
        ? "Diagnóstico correto."
        : "Objetivo atingido.",
    );
    if (index < 3)
      await page.screenshot({
        path: info.outputPath(
          `v3-alternation-${index + 1}-${round.family}.png`,
        ),
        fullPage: true,
      });
    const evaluation = executeRound(round, answer);
    audit.push({
      round: index + 1,
      identity: round.view.identity,
      interaction:
        round.family === "iteration"
          ? "investigation"
          : round.family === "collection"
            ? "ordering"
            : "intervention",
      pattern:
        round.family === "iteration"
          ? round.view.identity.pattern
          : round.family === "collection"
            ? round.view.identity.structure
            : round.view.identity.kind,
      seed: round.view.identity.seed,
      achieved: evaluation.value.achieved,
      produced: evaluation.value.produced,
      code:
        round.family === "iteration"
          ? round.view.code
          : round.family === "collection"
            ? round.model.reference.code
            : round.view.code,
    });
    if (index < 23)
      await page
        .getByRole("button", {
          name: index === 11 ? "Continuar praticando" : "Próxima",
          exact: true,
        })
        .click();
  }
  expect(audit.filter((r) => r.interaction === "investigation")).toHaveLength(
    8,
  );
  expect(audit.filter((r) => r.interaction === "ordering")).toHaveLength(8);
  expect(
    new Set(
      audit
        .filter((r) => r.interaction === "investigation")
        .map((r) => r.pattern),
    ).size,
  ).toBe(4);
  await page.getByText("Opções da sessão", { exact: true }).click();
  await expect(stat(page, "solved")).toHaveText("24");
  await expect(stat(page, "skipped")).toHaveText("0");
  await writeFile(
    info.outputPath("v3-browser-session-24.json"),
    JSON.stringify({ seed, version: 3, rounds: audit }, null, 2),
  );
});

test("investigation reducer rejects stale answers and repeated skips without double counting", () => {
  let state = startSession(seed, 3);
  while (state.round.family !== "iteration")
    state = sessionReducer(state, {
      type: "skip",
      seed,
      version: 3,
      index: state.index,
    });
  const base = { seed, version: 3 as const, index: state.index };
  expect(
    sessionReducer(state, {
      ...base,
      type: "suspect",
      instructionId: "unknown",
    }),
  ).toBe(state);
  expect(
    sessionReducer(state, {
      ...base,
      index: state.index + 1,
      type: "suspect",
      instructionId: "initialize",
    }),
  ).toBe(state);
  expect(sessionReducer(state, { ...base, type: "run" })).toBe(state);
  const before = state.skipped;
  state = sessionReducer(state, { ...base, type: "skip" });
  expect(state.revealed).toBe(true);
  expect(state.skipped).toBe(before + 1);
  expect(sessionReducer(state, { ...base, type: "skip" })).toBe(state);
  expect(
    sessionReducer(state, {
      ...base,
      type: "suspect",
      instructionId: "initialize",
    }),
  ).toBe(state);
  state = sessionReducer(state, { ...base, type: "next" });
  expect(state.index).toBe(base.index + 1);
  expect(state.skipped).toBe(before + 1);
  expect(state.solved).toBe(0);
});

test("wrong diagnosis then skip clears transient feedback and advances once", async ({
  page,
}, info) => {
  const round = await openInvestigation(page);
  const wrong = round.view.instructionIds.find(
    (id) => id !== round.model.faultId,
  )!;
  await page.locator(`[data-instruction-id="${wrong}"]`).click();
  await diagnose(page).click();
  await expect(page.locator(".tactic-verdict")).toContainText(
    "não corresponde",
  );
  await capture(page, info.outputPath("wrong-before-skip.png"));
  await page.getByRole("button", { name: "Pular", exact: true }).click();
  await capture(page, info.outputPath("skipped-after-wrong.png"));
  await expect(page.locator(".tactic-verdict.retry")).toHaveCount(0);
  await expect(page.locator(".is-suspect")).toHaveCount(0);
  await expect(page.locator(".investigation-reveal")).toContainText("Pulada");
  await page.getByText("Opções da sessão", { exact: true }).click();
  await expect(stat(page, "solved")).toHaveText("0");
  await expect(stat(page, "skipped")).toHaveText("1");
  await page.getByRole("button", { name: "Próxima", exact: true }).dblclick();
  await expect(page.locator(".tactic-round")).toHaveAttribute(
    "data-index",
    "1",
  );
  await expect(page.locator(".tactic-execution")).toHaveCount(0);
});

test("investigation resets the trace and all feedback when revisited in the same session", async ({
  page,
}) => {
  await openInvestigation(page);
  await page.getByRole("button", { name: "Iniciar execução" }).click();
  await page.locator('[data-instruction-id="initialize"]').click();
  await expect(page.locator(".is-current.is-suspect")).toContainText("▶ Atual");
  await expect(page.locator(".is-current.is-suspect")).toContainText(
    "? Suspeita",
  );
  await diagnose(page).click();
  await page.getByRole("button", { name: "Pular", exact: true }).click();
  await page.getByRole("button", { name: "Próxima", exact: true }).click();
  let index = 1;
  while (createRound(seed, index, 3).family !== "iteration") {
    await skipCurrent(page);
    index++;
  }
  await expect(page.locator(".tactic-objective")).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Iniciar execução" }),
  ).toBeVisible();
  await expect(
    page.locator(".is-current,.is-suspect,.is-revealed,.tactic-verdict"),
  ).toHaveCount(0);
  await expect(page.locator(".investigation-state")).toContainText(
    "Avance pelos passos",
  );
  await expect(diagnose(page)).toBeDisabled();
  await page.getByText("Opções da sessão", { exact: true }).click();
  await expect(stat(page, "skipped")).toHaveText(String(index));
  await expect(stat(page, "solved")).toHaveText("0");
});

test("skipping a wrong diagnosis clears reducer feedback, selection and late actions", () => {
  let state = startSession(seed, 3);
  if (state.round.family !== "iteration")
    throw new Error("Expected investigation");
  const action = { seed, version: 3 as const, index: 0 };
  state = sessionReducer(state, {
    ...action,
    type: "suspect",
    instructionId: "initialize",
  });
  state = sessionReducer(state, { ...action, type: "run" });
  expect(state.result?.value.achieved).toBe(false);
  state = sessionReducer(state, { ...action, type: "skip" });
  expect(state.result).toBeNull();
  expect(state.suspect).toBeNull();
  expect(state.error).toBeNull();
  expect(state.completed).toBe(false);
  expect(state.revealed).toBe(true);
  expect(state.skipped).toBe(1);
  expect(state.solved).toBe(0);
  for (const type of ["run", "skip"] as const)
    expect(sessionReducer(state, { ...action, type })).toBe(state);
  state = sessionReducer(state, { ...action, type: "next" });
  for (const type of ["run", "skip", "next"] as const)
    expect(sessionReducer(state, { ...action, type })).toBe(state);
});

test("investigation presents core trace values with labels for all four patterns", async ({
  page,
}) => {
  const labels = {
    "collect-matching": "Elementos selecionados",
    "count-matching": "Quantidade encontrada",
    "first-match": "Primeiro valor localizado",
    "partition-by-flag": "Distribuição entre grupos",
  };
  const format = (value: unknown): string => {
    if (value === null) return "null (nenhum registro)";
    if (typeof value === "number") return String(value);
    if (typeof value === "string") return `“${value}”`;
    if (Array.isArray(value))
      return value.length
        ? value.map((v) => `“${String(v)}”`).join(", ")
        : "[ ]";
    const groups = value as { matching: string[]; other: string[] };
    return `matching: ${format(groups.matching)} · other: ${format(groups.other)}`;
  };
  await page.goto(`/tactics?seed=${seed}&version=3`);
  const seen = new Set<string>();
  for (let index = 0; index < 12; index++) {
    const round = createRound(seed, index, 3);
    if (round.family === "iteration") {
      seen.add(round.view.identity.pattern);
      await page.getByRole("button", { name: "Iniciar execução" }).click();
      for (const [position, event] of round.view.trace.events.entries()) {
        const state = page.locator(".investigation-state");
        await expect(state).toContainText(
          `${labels[round.view.identity.pattern]}: ${format(event.after)}`,
        );
        if (event.record) await expect(state).toContainText(event.record.name);
        if (event.condition !== null)
          await expect(state).toContainText(
            `Condição: ${event.condition ? "verdadeira" : "falsa"}`,
          );
        await expect(page.locator(".is-current")).toHaveAttribute(
          "data-instruction-id",
          event.instructionId,
        );
        await expect(page.locator(".is-revealed")).toHaveCount(0);
        if (position < round.view.trace.events.length - 1)
          await page
            .getByRole("button", { name: "Próximo passo", exact: true })
            .click();
      }
    }
    if (index < 11) await skipCurrent(page);
  }
  expect(seen.size).toBe(4);
});
