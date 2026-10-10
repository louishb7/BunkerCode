import { Node, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CodeBlock from "@tiptap/extension-code-block";
import { MarkdownManager } from "@tiptap/markdown";
import { parseEditorial, validateEditorial } from "@bunkercode/content";

export const EditorialBlock = Node.create({
  name: "editorialBlock",
  group: "block",
  atom: true,
  draggable: false,
  addAttributes() {
    return { language: { default: "bunker-note" }, data: { default: null } };
  },
  parseHTML() {
    return [];
  },
  renderHTML() {
    return ["div", { "data-editorial-block": "true" }];
  },
  renderMarkdown(node) {
    const language = String(node.attrs?.language);
    const text = JSON.stringify(node.attrs?.data, null, 2);
    return `\`\`\`${language}\n${text}\n\`\`\``;
  },
});
export const VisualCode = CodeBlock.extend({
  parseMarkdown(token) {
    const language = String(token.lang ?? "");
    const text = String(token.text ?? "");
    if (
      language === "bunker-quiz" ||
      language === "bunker-note" ||
      language === "bunker-exercise"
    )
      return {
        type: "editorialBlock",
        attrs: { language, data: parseEditorial(language, text) },
      };
    return {
      type: "codeBlock",
      attrs: { language: language || null },
      content: text ? [{ type: "text", text }] : [],
    };
  },
  renderMarkdown(node) {
    const text = node.content?.map((n) => n.text ?? "").join("") ?? "";
    const longest = Math.max(
      2,
      ...[...text.matchAll(/`+/g)].map((m) => m[0].length),
    );
    const fence = "`".repeat(longest + 1);
    return `${fence}${node.attrs?.language ?? ""}\n${text}\n${fence}`;
  },
}).configure({ enableTabIndentation: false });
export const baseExtensions = [
  StarterKit.configure({
    codeBlock: false,
    link: { openOnClick: false },
    underline: false,
    trailingNode: false,
  }),
  VisualCode,
  EditorialBlock,
];
export const markdownManager = new MarkdownManager({
  extensions: baseExtensions,
});

// Compare the independent Markdown token structure before/after conversion. Unknown
// constructs are source-only rather than being silently discarded by a rich editor.
function semantics(tokens: unknown[]): unknown[] {
  const allowed = new Set([
    "space",
    "heading",
    "paragraph",
    "text",
    "strong",
    "em",
    "codespan",
    "code",
    "blockquote",
    "list",
    "list_item",
    "link",
    "escape",
    "br",
    "hr",
  ]);
  return tokens.flatMap((value) => {
    const t = value as Record<string, unknown>;
    if (t.type === "space") return [];
    if (!allowed.has(String(t.type)) || t.task)
      throw new Error(
        "Este Markdown usa elementos não suportados pela edição visual.",
      );
    if (
      t.type === "link" &&
      !/^(https?:\/\/|mailto:|\/[^/]|#)/i.test(String(t.href))
    )
      throw new Error(
        "Revise o link na fonte Markdown antes de editar visualmente.",
      );
    const result: Record<string, unknown> = { type: t.type };
    for (const key of ["depth", "ordered", "start", "href", "title", "lang"])
      if (t[key] !== undefined && t[key] !== "") result[key] = t[key];
    if (Array.isArray(t.tokens)) result.tokens = semantics(t.tokens);
    else if (typeof t.text === "string") result.text = t.text;
    if (Array.isArray(t.items)) result.items = semantics(t.items);
    if (
      t.type === "code" &&
      (t.lang === "bunker-quiz" ||
        t.lang === "bunker-note" ||
        t.lang === "bunker-exercise")
    )
      result.text = parseEditorial(String(t.lang), String(t.text));
    return [result];
  });
}
export function openVisual(
  source: string,
):
  | { document: JSONContent; error?: never }
  | { error: string; document?: never } {
  try {
    validateEditorial(source);
    const original = semantics(markdownManager.instance.lexer(source));
    const document = markdownManager.parse(source);
    const serialized = markdownManager.serialize(document);
    const restored = semantics(markdownManager.instance.lexer(serialized));
    if (JSON.stringify(original) !== JSON.stringify(restored))
      throw new Error(
        "A conversão visual não preserva integralmente a estrutura deste Markdown.",
      );
    return { document };
  } catch (error) {
    return {
      error: `${error instanceof Error ? error.message : "Conversão indisponível."} Use Editar fonte Markdown; o original foi preservado.`,
    };
  }
}
