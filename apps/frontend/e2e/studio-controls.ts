import { expect, type Locator, type Page } from "@playwright/test";

// Select logical text, independent of line wrapping or a click's visual line.
// The browser selection still flows through ProseMirror's normal DOM observer.
export async function selectStudioText(
  paragraph: Locator,
  text: string,
  collapsed = false,
) {
  await paragraph.evaluate(
    (node, { text, collapsed }) => {
      const editor = node.closest<HTMLElement>('[contenteditable="true"]');
      if (!editor) throw new Error("Editable Studio document not found");
      const start = node.textContent?.indexOf(text) ?? -1;
      if (start < 0) throw new Error("Requested text not found");
      editor.focus();
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      const points: { node: Text; offset: number }[] = [];
      for (const target of [start, collapsed ? start : start + text.length]) {
        walker.currentNode = node;
        let offset = 0;
        while (walker.nextNode()) {
          const current = walker.currentNode as Text;
          if (target <= offset + current.length) {
            points.push({ node: current, offset: target - offset });
            break;
          }
          offset += current.length;
        }
      }
      if (points.length !== 2)
        throw new Error("Selection boundaries not found");
      const range = document.createRange();
      range.setStart(points[0]!.node, points[0]!.offset);
      range.setEnd(points[1]!.node, points[1]!.offset);
      const selection = getSelection();
      if (!selection) throw new Error("Browser selection unavailable");
      selection.removeAllRanges();
      selection.addRange(range);
    },
    { text, collapsed },
  );
  await expect
    .poll(() => paragraph.evaluate(() => getSelection()?.toString()))
    .toBe(collapsed ? "" : text);
}
export async function studioView(
  page: Page,
  name: "Editor visual" | "Editar fonte Markdown" | "Prévia",
) {
  await page.getByRole("button", { name, exact: true }).click();
}
export async function studioTools(page: Page) {
  const button = page.getByRole("button", {
    name: "Formatação do documento",
    exact: true,
  });
  if ((await button.getAttribute("aria-pressed")) !== "true")
    await button.click();
}
