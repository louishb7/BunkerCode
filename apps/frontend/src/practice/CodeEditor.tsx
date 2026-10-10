import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { formatCode } from "./code-tools";
import { useEffect, useRef } from "react";
import { EditorSelection, EditorState } from "@codemirror/state";
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
      minHeight: "420px",
      caretColor: "#e8bd68",
    },
    ".cm-scroller": {
      overflow: "auto",
      lineHeight: "1.7",
      height: "clamp(360px, 50dvh, 650px)",
    },
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
  formatRequest,
  onFormatState,
}: {
  code: string;
  language: "typescript" | "javascript";
  onChange: (code: string) => void;
  formatRequest: number;
  onFormatState: (busy: boolean, message: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const callback = useRef(onChange);
  callback.current = onChange;
  const initial = useRef(code);
  const formatCallback = useRef(onFormatState);
  formatCallback.current = onFormatState;
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
          closeBrackets(),
          autocompletion(),
          highlightSelectionMatches(),
          javascript({ typescript: language === "typescript" }),
          syntaxHighlighting(darcula),
          theme,
          keymap.of([
            ...completionKeymap,
            ...closeBracketsKeymap,
            indentWithTab,
            ...defaultKeymap,
            ...historyKeymap,
            ...searchKeymap,
          ]),
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
  useEffect(() => {
    const editor = view.current;
    if (!formatRequest || !editor) return;
    const original = editor.state.doc.toString();
    const selection = editor.state.selection.main;
    const controller = new AbortController();
    formatCallback.current(true, "Formatando…");
    void formatCode(original, language, controller.signal)
      .then((formatted) => {
        if (controller.signal.aborted) return;
        if (editor.state.doc.toString() !== original) {
          formatCallback.current(
            false,
            "O código mudou durante a formatação. Solicite novamente; seu texto foi preservado.",
          );
          return;
        }
        editor.dispatch({
          changes: { from: 0, to: editor.state.doc.length, insert: formatted },
          selection: EditorSelection.range(
            Math.min(selection.anchor, formatted.length),
            Math.min(selection.head, formatted.length),
          ),
          userEvent: "input.format",
        });
        editor.focus();
        formatCallback.current(false, "Código formatado.");
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          formatCallback.current(
            false,
            `Não foi possível formatar: ${error instanceof Error ? error.message : "erro de sintaxe"}`,
          );
      });
    return () => controller.abort();
  }, [formatRequest, language]);
  return <div ref={host} className="code-editor min-w-0 overflow-hidden" />;
}
