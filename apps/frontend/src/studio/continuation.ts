import type { EditorView } from "@tiptap/pm/view";
import type { Editor } from "@tiptap/react";
import { closeHistory } from "@tiptap/pm/history";
import { TextSelection } from "@tiptap/pm/state";

export function endsInSpecialBlock(editor: Editor) {
  return ["codeBlock", "editorialBlock"].includes(
    editor.state.doc.lastChild?.type.name ?? "",
  );
}
// Only an explicit writing action changes the document. Reuse an empty following
// paragraph; preserve existing prose in its own block when inserting before it.
export function continueAfter(view: EditorView, after: number, text = "") {
  if (!view.editable) return;
  const following = view.state.doc.nodeAt(after);
  const tr = closeHistory(view.state.tr);
  if (following?.type.name !== "paragraph" || following.content.size > 0)
    tr.insert(after, view.state.schema.nodes.paragraph!.create());
  if (text) tr.insertText(text, after + 1);
  tr.setSelection(TextSelection.create(tr.doc, after + 1 + text.length));
  view.dispatch(tr.scrollIntoView());
  view.focus();
}
