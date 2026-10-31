import { expect, type Page } from "@playwright/test";

export async function expectHomeWithoutActivity(page: Page) {
  await expect(
    page.getByRole("heading", { name: "Cursos disponíveis", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(
      ".activity-dashboard, .activity-calendar, .heatmap-day, .activity-date-control",
    ),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Consultar dia de atividade", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", {
      name: "Calendário dos últimos seis meses",
      exact: true,
    }),
  ).toHaveCount(0);
}

// Inspect persisted events directly; Home no longer reads or opens the database.
export async function expectStoredActivity(page: Page, count: number) {
  await expect
    .poll(() =>
      page.evaluate(async () => {
        if (
          !(await indexedDB.databases()).some(
            (db) => db.name === "bunkercode-practice",
          )
        )
          return 0;
        return new Promise<number>((resolve, reject) => {
          const open = indexedDB.open("bunkercode-practice", 2);
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result;
            const tx = db.transaction("activity");
            const read = tx.objectStore("activity").count();
            tx.oncomplete = () => {
              db.close();
              resolve(read.result);
            };
            tx.onabort = () => {
              db.close();
              reject(tx.error);
            };
          };
        });
      }),
    )
    .toBe(count);
}
