import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  drawSelection,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import {
  bracketMatching,
  indentOnInput,
  HighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { tags } from "@lezer/highlight";
const darcula = HighlightStyle.define([
  { tag: [tags.keyword, tags.bool], color: "#db7e32" },
  { tag: tags.string, color: "#7cb961" },
  { tag: tags.number, color: "#6897bb" },
  { tag: [tags.typeName, tags.className], color: "#ebb662" },
  { tag: tags.propertyName, color: "#bf93d8" },
  { tag: tags.function(tags.variableName), color: "#f7d064" },
  { tag: tags.comment, color: "#909090" },
  { tag: tags.variableName, color: "#a9b7c6" },
]);
const theme = EditorView.theme(
  {
    "&": { backgroundColor: "#23272c", color: "#d4d4d4", fontSize: "14px" },
    ".cm-content": {
      fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
      padding: "18px 0",
      minHeight: "360px",
      caretColor: "#e8bd68",
    },
    ".cm-scroller": { overflow: "auto", lineHeight: "1.7", maxHeight: "65dvh" },
    ".cm-gutters": {
      backgroundColor: "#202429",
      color: "#a0a5ac",
      borderRight: "1px solid #343b42",
    },
    ".cm-activeLine": { backgroundColor: "#ffffff05" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
      backgroundColor: "#455163",
    },
    "&.cm-focused": { outline: "2px solid #e8bd68", outlineOffset: "-2px" },
  },
  { dark: true },
);
export function CodeEditor({
  code,
  language,
  onChange,
}: {
  code: string;
  language: "typescript" | "javascript";
  onChange: (code: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const callback = useRef(onChange);
  callback.current = onChange;
  const initial = useRef(code);
  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initial.current,
        extensions: [
          lineNumbers(),
          history(),
          drawSelection(),
          highlightActiveLine(),
          bracketMatching(),
          indentOnInput(),
          javascript({ typescript: language === "typescript" }),
          syntaxHighlighting(darcula),
          theme,
          keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
          EditorView.contentAttributes.of({
            "aria-label": "Código da solução",
            "aria-describedby": "editor-keyboard-help",
            spellcheck: "false",
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged)
              callback.current(update.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = editor;
    return () => {
      view.current = null;
      editor.destroy();
    };
  }, [language]);
  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== code)
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: code },
      });
  }, [code]);
  return <div ref={host} className="code-editor min-w-0 overflow-hidden" />;
}
