import { expect, test, type Locator } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const file = join(
  process.env.BUNKERCODE_BROWSER_CONTENT_DIR!,
  "courses/typescript/lessons/values-and-types/lesson.md",
);
const lesson = "/courses/typescript/lessons/values-and-types";
const studio = lesson + "/edit";
const source = `# Valores e tipos

~~~typescript
// Types, enums and generic classes stay inert during rendering.
enum Status { Pending = "PENDING", Active = "ACTIVE" }
type ID = string | number;
interface User<T = unknown> {
  readonly id: ID;
  name: string;
  active: boolean;
  meta: T;
}

function log(target: unknown, key: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value;
  descriptor.value = function (...args: unknown[]) {
    console.log("log", key);
    return original.apply(this, args);
  };
}
class Repository<T extends User> {
  private items = new Map<ID, T>();
  @log
  add(item: T): this {
    this.items.set(item.id, item);
    return this;
  }
  async find(id: ID): Promise<T> {
    const user = this.items.get(id);
    let count: number = 2;
    await fetchUser(id);
    repo.find(); repo.add(); items.set("key", user);
    return user;
  }
}
async function fetchUser(id: ID): Promise<User> {
  await new Promise(r => setTimeout(r, 100));
  return { id, name: "Ada Lovelace", meta: { score: 42 } };
}
const label = \`User: \${fetchUser("id")}\`;
window.__darculaExecuted = true;
~~~

~~~javascript
const total = (price, count) => price * count;
console.log(total(2, 3));
~~~

~~~python
class Account:
    def debit(self, amount: int) -> str:
        return str(amount)
~~~

~~~json
{"total": 3, "active": true}
~~~

~~~sql
SELECT count(*) AS total FROM account WHERE active = TRUE;
~~~

~~~ts
const size: number = 2; console.log(size);
~~~

<script>window.__darculaExecuted = true</script>
[Unsafe](javascript:alert(1))

~~~plaintext
Unrecognized syntax stays readable and this deliberately long line remains inside its own scrollable code block: ${"x".repeat(100)}
~~~
`;
let original: string;
test.beforeEach(async () => {
  original = await readFile(file, "utf8");
  await writeFile(file, source);
});
test.afterEach(async () => {
  await writeFile(file, original);
});

test("Darcula token colors cover supported languages in both the lesson reader and Studio preview", async ({
  page,
}) => {
  await page.goto(lesson);
  await expect(page.locator(".lesson-reader .code-block")).toHaveCount(7);

  const colors = {
    background: await page
      .locator(".lesson-reader .code-block")
      .first()
      .evaluate((node) => getComputedStyle(node).backgroundColor),
    keyword: await page
      .locator(".lesson-reader code.language-typescript .hljs-keyword")
      .first()
      .evaluate((node) => getComputedStyle(node).color),
    string: await page
      .locator(".lesson-reader code.language-typescript .hljs-string")
      .first()
      .evaluate((node) => getComputedStyle(node).color),
    class: await page
      .locator(".lesson-reader code.language-typescript .hljs-title.class_")
      .first()
      .evaluate((node) => getComputedStyle(node).color),
    function: await page
      .locator(".lesson-reader code.language-typescript .hljs-title.function_")
      .first()
      .evaluate((node) => getComputedStyle(node).color),
    number: await page
      .locator(".lesson-reader code.language-javascript .hljs-number")
      .first()
      .evaluate((node) => getComputedStyle(node).color),
    primitiveType: await page
      .locator(".lesson-reader code.language-typescript .hljs-built_in")
      .first()
      .evaluate((node) => getComputedStyle(node).color),
    comment: await page
      .locator(".lesson-reader code.language-typescript .hljs-comment")
      .first()
      .evaluate((node) => getComputedStyle(node).color),
    property: await page
      .locator(".lesson-reader code.language-json .hljs-attr")
      .first()
      .evaluate((node) => getComputedStyle(node).color),
    parameter: await page
      .locator(".lesson-reader code.language-python .hljs-params")
      .first()
      .evaluate((node) => getComputedStyle(node).color),
    sqlOperator: await page
      .locator(".lesson-reader code.language-sql .hljs-operator")
      .first()
      .evaluate((node) => getComputedStyle(node).color),
    fallback: await page
      .locator(".lesson-reader code.language-plaintext")
      .first()
      .evaluate((node) => getComputedStyle(node).color),
  };

  expect(colors).toEqual({
    background: "rgb(35, 39, 44)",
    keyword: "rgb(219, 126, 50)",
    string: "rgb(124, 185, 97)",
    class: "rgb(235, 182, 98)",
    function: "rgb(247, 208, 100)",
    number: "rgb(104, 151, 187)",
    primitiveType: "rgb(219, 126, 50)",
    comment: "rgb(128, 128, 128)",
    property: "rgb(191, 147, 216)",
    parameter: "rgb(189, 201, 214)",
    sqlOperator: "rgb(169, 183, 198)",
    fallback: "rgb(212, 212, 212)",
  });

  await page.goto(studio);
  await page.getByRole("button", { name: "Prévia", exact: true }).click();
  await expect(page.locator(".studio-preview .code-block")).toHaveCount(7);
  const previewColors = {
    keyword: await page
      .locator(".studio-preview code.language-typescript .hljs-keyword")
      .first()
      .evaluate((node) => getComputedStyle(node).color),
    property: await page
      .locator(".studio-preview code.language-json .hljs-attr")
      .first()
      .evaluate((node) => getComputedStyle(node).color),
    background: await page
      .locator(".studio-preview .code-block")
      .first()
      .evaluate((node) => getComputedStyle(node).backgroundColor),
  };
  expect(previewColors).toEqual({
    keyword: colors.keyword,
    property: colors.property,
    background: colors.background,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator(".studio-preview code.language-plaintext")
      .locator("xpath=..")
      .evaluate((node) => node.scrollWidth > node.clientWidth),
  ).toBe(true);
});

async function presentation(prose: Locator) {
  return prose.locator(".code-block").evaluateAll((blocks) =>
    blocks.map((block) => {
      const pre = block.querySelector("pre")!;
      const code = pre.querySelector("code")!;
      return {
        text: code.textContent,
        background: getComputedStyle(block).backgroundColor,
        fontSize: getComputedStyle(pre).fontSize,
        lineHeight: getComputedStyle(pre).lineHeight,
        codeLineHeight: getComputedStyle(code).lineHeight,
        tokens: Array.from(code.querySelectorAll("span")).map((token) => ({
          text: token.textContent,
          classes: token.className,
          color: getComputedStyle(token).color,
          fontStyle: getComputedStyle(token).fontStyle,
        })),
      };
    }),
  );
}

test("representative TypeScript stays inert, compact and identical across reader and preview at both widths", async ({
  page,
}, testInfo) => {
  const executionRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/learning"))
      executionRequests.push(request.url());
  });
  let readerPresentation: Awaited<ReturnType<typeof presentation>> | undefined;
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 960 });
    for (const [url, selector] of [
      [lesson, ".lesson-reader"],
      [studio, ".studio-preview"],
    ] as const) {
      await page.goto(url);
      if (url === studio)
        await page.getByRole("button", { name: "Prévia", exact: true }).click();
      const prose = page.locator(selector);
      await expect(prose.locator(".code-block")).toHaveCount(7);
      const current = await presentation(prose);
      readerPresentation ??= current;
      expect(current).toEqual(readerPresentation);
      expect(current[0]!.lineHeight).toBe("21px");
      expect(current[0]!.codeLineHeight).toBe("21px");
      expect(current[0]!.fontSize).toBe("14px");
      expect(current[0]!.text).toContain("\n\nfunction log");
      expect(
        current[0]!.tokens
          .filter((token) => token.classes === "hljs-variable language_")
          .every(
            (token) =>
              token.color === "rgb(169, 183, 198)" &&
              token.fontStyle === "normal",
          ),
      ).toBe(true);
      const alias = prose.locator("code.language-ts .hljs-built_in");
      await expect(alias).toHaveText("number");
      expect(await alias.evaluate((node) => getComputedStyle(node).color)).toBe(
        "rgb(219, 126, 50)",
      );
      await expect(prose.locator("script, iframe")).toHaveCount(0);
      await expect(
        prose.getByText("Unsafe", { exact: true }),
      ).not.toHaveAttribute("href", /^javascript:/i);
      expect(await page.evaluate(() => "__darculaExecuted" in window)).toBe(
        false,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      const pre = prose.locator("code.language-plaintext").locator("xpath=..");
      expect(
        await pre.evaluate((node) => node.scrollWidth > node.clientWidth),
      ).toBe(true);
      await pre.evaluate((node) => {
        node.scrollLeft = 100;
      });
      expect(await pre.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
      await page.screenshot({
        path: testInfo.outputPath(
          `${url === studio ? "preview" : "reader"}-${width}.png`,
        ),
        fullPage: true,
      });
    }
  }
  expect(executionRequests).toEqual([]);
});
