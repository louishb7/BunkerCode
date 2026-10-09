import { expect, test } from "@playwright/test";

const scenarios = [
  {
    name: "unavailable API",
    network: true,
    status: 0,
    body: "",
    message: "Não foi possível conectar ao servidor",
  },
  {
    name: "empty response",
    status: 200,
    body: "",
    message: "resposta de conteúdo incompatível",
  },
  {
    name: "unexpected HTML",
    status: 200,
    body: "<html>Proxy failure</html>",
    message: "resposta de conteúdo incompatível",
  },
  {
    name: "malformed JSON",
    status: 200,
    body: '{"broken":',
    message: "resposta de conteúdo incompatível",
  },
  {
    name: "incompatible JSON",
    status: 200,
    body: '{"courses":[]}',
    message: "resposta de conteúdo incompatível",
  },
  {
    name: "HTTP failure without JSON",
    status: 502,
    body: "<html>Bad gateway</html>",
    message: "HTTP 502",
  },
  {
    name: "backend diagnostic",
    status: 422,
    body: JSON.stringify({ message: "Conteúdo inválido: manifesto de teste." }),
    message: "Conteúdo inválido: manifesto de teste.",
  },
];
for (const scenario of scenarios)
  test(`${scenario.name} is readable and retry recovers`, async ({ page }) => {
    let fail = true;
    await page.route("**/api/content/courses", async (route) => {
      if (!fail) return route.continue();
      if (scenario.network) return route.abort("connectionrefused");
      await route.fulfill({
        status: scenario.status,
        body: scenario.body,
        contentType: "application/json",
      });
    });
    await page.goto("/courses");
    await expect(page.getByRole("alert")).toContainText(scenario.message);
    await expect(page).toHaveTitle("Conteúdo indisponível · BunkerCode");
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    fail = false;
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(page.getByRole("link", { name: /^TypeScript/ })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
