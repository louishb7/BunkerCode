import { useAppearance } from "../appearance/Appearance";
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { formatCode } from "./code-tools";
import { useEffect, useRef } from "react";
import { Compartment, EditorState } from "@codemirror/state";
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
  isolateHistory,
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
  { tag: [tags.keyword, tags.bool], color: "var(--editor-keyword, #db7e32)" },
  { tag: tags.string, color: "var(--editor-string, #7cb961)" },
  { tag: tags.number, color: "var(--editor-number, #6897bb)" },
  {
    tag: [tags.typeName, tags.className],
    color: "var(--editor-type, #ebb662)",
  },
  { tag: tags.propertyName, color: "var(--editor-property, #bf93d8)" },
  {
    tag: tags.function(tags.variableName),
    color: "var(--editor-function, #f7d064)",
  },
  { tag: tags.comment, color: "var(--editor-comment, #909090)" },
  { tag: tags.variableName, color: "var(--editor-variable, #a9b7c6)" },
]);
const theme = (dark: boolean) =>
  EditorView.theme(
    {
      "&": {
        backgroundColor: "var(--reading-background, #23272c)",
        color: "var(--reading-text, #d4d4d4)",
        fontSize: "14px",
      },
      ".cm-content": {
        fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
        padding: "18px 0",
        minHeight: "420px",
        caretColor: "var(--editor-accent, #e8bd68)",
      },
      ".cm-scroller": {
        overflow: "auto",
        lineHeight: "1.7",
        height: "clamp(360px, 50dvh, 650px)",
      },
      ".cm-gutters": {
        backgroundColor: "var(--editor-surface, #202429)",
        color: "var(--editor-muted, #a0a5ac)",
        borderRight: "1px solid var(--editor-line, #343b42)",
      },
      ".cm-cursor, .cm-dropCursor": {
        borderLeftColor: "var(--editor-accent, #e8bd68)",
      },
      "& .cm-matchingBracket, & .cm-selectionMatch": {
        backgroundColor: "var(--editor-raised, #353b43)",
        outline: "1px solid var(--editor-accent, #e8bd68)",
      },
      ".cm-searchMatch, .cm-searchMatch.cm-searchMatch-selected": {
        backgroundColor: "var(--editor-selection, #455163)",
        outline: "1px solid var(--editor-accent, #e8bd68)",
      },
      ".cm-activeLine": { backgroundColor: "var(--editor-surface, #ffffff05)" },
      "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground": {
        backgroundColor: "var(--editor-selection, #455163)",
      },
      "&.cm-focused": {
        outline: "2px solid var(--editor-accent, #e8bd68)",
        outlineOffset: "-2px",
      },
    },
    { dark },
  );
export function CodeEditor({
  code,
  language,
  variant = "practice",
  lessonAppearance = false,
  onChange,
  formatRequest,
  onFormatState,
  readOnly = false,
  label = "Código da solução",
}: {
  code: string;
  variant?: "practice" | "example";
  lessonAppearance?: boolean;
  readOnly?: boolean;
  label?: string;
  language: string;
  onChange: (code: string) => void;
  formatRequest: number;
  onFormatState: (busy: boolean, message: string) => void;
}) {
  const { effectiveTone } = useAppearance();
  const dark = !lessonAppearance || effectiveTone < 3;
  const themeConfig = useRef(new Compartment());
  const initialDark = useRef(dark);
  initialDark.current = dark;
  const languageConfig = useRef(new Compartment());
  const initialLanguage = useRef(language);
  initialLanguage.current = language;
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const documentRevision = useRef(0);
  const callback = useRef(onChange);
  callback.current = onChange;
  const initial = useRef(code);
  initial.current = code;
  const formatCallback = useRef(onFormatState);
  formatCallback.current = onFormatState;
  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initial.current,
        extensions: [
          EditorState.readOnly.of(readOnly),
          EditorView.editable.of(!readOnly),
          lineNumbers(),
          history(),
          drawSelection(),
          highlightActiveLine(),
          bracketMatching(),
          indentOnInput(),
          closeBrackets(),
          autocompletion(),
          highlightSelectionMatches(),
          languageConfig.current.of(
            initialLanguage.current === "typescript" ||
              initialLanguage.current === "javascript"
              ? javascript({
                  typescript: initialLanguage.current === "typescript",
                })
              : [],
          ),
          syntaxHighlighting(darcula),
          themeConfig.current.of(theme(initialDark.current)),
          ...(variant === "example"
            ? [
                EditorView.theme({
                  "&": { width: "100%", maxWidth: "100%" },
                  ".cm-scroller": {
                    height: "auto",
                    minHeight: "80px",
                    maxHeight: "420px",
                    lineHeight: "1.5",
                    overflow: "auto",
                  },
                  ".cm-content": { minHeight: "80px", padding: "16px 0" },
                }),
              ]
            : []),
          keymap.of([
            ...completionKeymap,
            ...closeBracketsKeymap,
            indentWithTab,
            ...defaultKeymap,
            ...historyKeymap,
            ...searchKeymap,
          ]),
          EditorView.contentAttributes.of({
            "aria-label": label,
            "aria-readonly": String(readOnly),
            "aria-describedby": "editor-keyboard-help",
            spellcheck: "false",
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              documentRevision.current++;
              callback.current(update.state.doc.toString());
            }
          }),
        ],
      }),
    });
    view.current = editor;
    return () => {
      view.current = null;
      editor.destroy();
    };
  }, [readOnly, label, variant]);
  useEffect(() => {
    view.current?.dispatch({
      effects: themeConfig.current.reconfigure(theme(dark)),
    });
  }, [dark]);
  useEffect(() => {
    view.current?.dispatch({
      effects: languageConfig.current.reconfigure(
        language === "typescript" || language === "javascript"
          ? javascript({ typescript: language === "typescript" })
          : [],
      ),
    });
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
    if (
      !formatRequest ||
      !editor ||
      readOnly ||
      (language !== "typescript" && language !== "javascript")
    )
      return;
    const original = editor.state.doc.toString();
    const revision = documentRevision.current;
    const focusOwner = document.activeElement;
    const controller = new AbortController();
    formatCallback.current(true, "Formatando…");
    void formatCode(original, language, controller.signal)
      .then((formatted) => {
        if (controller.signal.aborted) return;
        if (documentRevision.current !== revision) {
          formatCallback.current(
            false,
            "O código mudou durante a formatação. Solicite novamente; seu texto foi preservado.",
          );
          return;
        }
        // Patch only changed ranges so unchanged code, selection and viewport survive.
        // Read selection/scroll now: the user may have moved them while Prettier ran.
        const changes = editor.state.changes(formatted.changes);
        if (!changes.empty) {
          editor.dispatch({
            changes,
            selection: editor.state.selection.map(changes),
            effects: editor.scrollSnapshot().map(changes),
            annotations: isolateHistory.of("full"),
            userEvent: "input.format",
          });
        }
        // Return focus for the initiating control, without stealing it from a new context.
        if (document.activeElement === focusOwner) editor.focus();
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
  }, [formatRequest, language, readOnly]);
  return (
    <div
      ref={host}
      className={`code-editor ${variant === "example" ? "example-code" : ""} min-w-0 overflow-hidden`}
    />
  );
}
