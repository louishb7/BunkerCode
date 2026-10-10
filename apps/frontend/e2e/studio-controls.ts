import type { Page } from "@playwright/test";
export async function studioView(
  page: Page,
  name: "Editor visual" | "Editar fonte Markdown" | "Prévia",
) {
  const options = page.locator(".studio-options");
  if (!(await options.evaluate((node) => (node as HTMLDetailsElement).open)))
    await options.locator("summary").click();
  await options.getByRole("button", { name, exact: true }).click();
}
export async function studioTools(page: Page) {
  const button = page.getByRole("button", {
    name: "Formatação do documento",
    exact: true,
  });
  if ((await button.getAttribute("aria-pressed")) !== "true")
    await button.click();
}
