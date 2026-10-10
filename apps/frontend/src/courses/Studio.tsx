import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import { useLessonNavigation } from "../product/SiteHeader";
import { Link, useParams } from "react-router";
import { lessonPath, useContent, incompatibleContent } from "./api";
import { Page } from "./Page";
import { ContentStatus } from "./ContentStatus";
import { Markdown, lessonBody } from "./Markdown";
import {
  editorialPath,
  parseEditableLesson,
  readEditableLesson,
  saveMarkdown,
  StudioError,
  type EditableLesson,
  type MarkdownRevision,
} from "./studio-api";
import "./studio.css";

const VisualEditor = lazy(() => import("../studio/VisualEditor"));

interface EditorPosition {
  start: number;
  end: number;
  direction: "forward" | "backward" | "none";
  top: number;
  left: number;
}
interface BufferState extends MarkdownRevision {
  baseMarkdown: string;
}
function initialBuffer(key: string, lesson: EditableLesson) {
  const fallback = {
    markdown: lesson.markdown,
    baseMarkdown: lesson.markdown,
    version: lesson.version,
  };
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return { buffer: fallback, notice: "" };
    const value: unknown = JSON.parse(raw);
    if (
      !value ||
      typeof value !== "object" ||
      !("markdown" in value) ||
      !("baseMarkdown" in value) ||
      !("version" in value) ||
      typeof value.markdown !== "string" ||
      typeof value.baseMarkdown !== "string" ||
      typeof value.version !== "string" ||
      !/^[a-f0-9]{64}$/.test(value.version)
    )
      throw new Error("Invalid tab draft");
    return {
      buffer: {
        markdown: value.markdown,
        baseMarkdown: value.baseMarkdown,
        version: value.version,
      },
      notice:
        "Rascunho recuperado nesta aba; ele ainda não foi salvo no arquivo.",
    };
  } catch {
    return {
      buffer: fallback,
      notice:
        "Não foi possível recuperar o rascunho desta aba. O conteúdo exibido veio do arquivo.",
    };
  }
}
function failureMessage(error: unknown) {
  return error instanceof StudioError
    ? error.message
    : "Falha de comunicação ou de confirmação. Seu texto foi preservado; confira o arquivo antes de tentar novamente.";
}
export function StudioPage() {
  const { id = "", slug = "" } = useParams();
  const { data: lesson, error } = useContent(
    editorialPath(id, slug),
    parseEditableLesson,
  );
  if (!lesson || lesson.course.id !== id || lesson.slug !== slug)
    return (
      <ContentStatus error={error || (lesson ? incompatibleContent : "")} />
    );
  return <LessonEditor key={id + "/" + slug} lesson={lesson} />;
}
function LessonEditor({ lesson }: { lesson: EditableLesson }) {
  useLessonNavigation(lesson);
  const id = lesson.course.id,
    slug = lesson.slug;
  const storageKey = "bunkercode:studio:" + id + "/" + slug;
  const [initial] = useState(() => initialBuffer(storageKey, lesson));
  const [buffer, setBuffer] = useState<BufferState>(initial.buffer);
  const [notice, setNotice] = useState(initial.notice);
  const [error, setError] = useState(
    initial.buffer.version !== lesson.version
      ? "O arquivo mudou desde o rascunho desta aba. Revise a versão atual antes de salvar."
      : "",
  );
  const [conflict, setConflict] = useState(
    initial.buffer.version !== lesson.version,
  );
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [current, setCurrent] = useState<MarkdownRevision | null>(null);
  const [view, setView] = useState<"visual" | "edit" | "preview">("visual");
  const [storageError, setStorageError] = useState("");
  const editor = useRef<HTMLTextAreaElement>(null);
  const editingPosition = useRef<EditorPosition | null>(null);
  const viewScroll = useRef({ visual: 0, edit: 0, preview: 0 });
  const changingView = useRef(false);
  const alive = useRef(true);
  function changeView(next: "visual" | "edit" | "preview") {
    if (view === next) return;
    viewScroll.current[view] = window.scrollY;
    const input = editor.current;
    if (view === "edit" && input)
      editingPosition.current = {
        start: input.selectionStart,
        end: input.selectionEnd,
        direction: input.selectionDirection,
        top: input.scrollTop,
        left: input.scrollLeft,
      };
    changingView.current = true;
    setView(next);
  }
  useLayoutEffect(() => {
    if (!changingView.current) return;
    changingView.current = false;
    const position = editingPosition.current;
    const input = editor.current;
    if (view === "edit" && position && input) {
      input.setSelectionRange(position.start, position.end, position.direction);
      input.scrollTop = position.top;
      input.scrollLeft = position.left;
    }
    window.scrollTo(0, viewScroll.current[view]);
  }, [view]);
  const dirty = buffer.markdown !== buffer.baseMarkdown;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!dirty && !saving) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);
  function changeBuffer(next: BufferState) {
    setBuffer(next);
    setSaved(false);
    try {
      if (next.markdown === next.baseMarkdown)
        sessionStorage.removeItem(storageKey);
      else sessionStorage.setItem(storageKey, JSON.stringify(next));
      setStorageError("");
    } catch {
      setStorageError(
        "Não foi possível guardar o rascunho nesta aba. Copie seu texto antes de sair ou recarregar.",
      );
    }
  }
  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    setCurrent(null);
    try {
      const confirmation = await saveMarkdown(id, slug, {
        markdown: buffer.markdown,
        version: buffer.version,
      });
      if (!alive.current) return;
      changeBuffer({ ...confirmation, baseMarkdown: confirmation.markdown });
      setSaved(true);
      setConflict(false);
    } catch (failure) {
      if (!alive.current) return;
      setError(failureMessage(failure));
      setConflict(failure instanceof StudioError && failure.status === 409);
    } finally {
      if (alive.current) setSaving(false);
    }
  }
  async function review() {
    setReviewing(true);
    try {
      const file = await readEditableLesson(id, slug);
      if (alive.current) setCurrent(file);
    } catch (failure) {
      if (alive.current) setError(failureMessage(failure));
    } finally {
      if (alive.current) setReviewing(false);
    }
  }
  function useReviewedFile(keepText: boolean) {
    if (!current) return;
    if (
      !keepText &&
      !window.confirm("Descartar seu texto editado e carregar o arquivo atual?")
    )
      return;
    changeBuffer({
      markdown: keepText ? buffer.markdown : current.markdown,
      baseMarkdown: current.markdown,
      version: current.version,
    });
    setCurrent(null);
    setError("");
    setConflict(false);
    setNotice(
      keepText
        ? "Versão revisada. Salvar substituirá esse arquivo pelo seu texto."
        : "Versão do arquivo carregada. Nenhuma gravação foi feita.",
    );
  }
  const status = saving
    ? "Salvando…"
    : saved
      ? "Salvo no arquivo."
      : dirty
        ? "Alterações não salvas."
        : "Sem alterações.";
  return (
    <Page
      title={`Studio · ${lesson.title} · ${lesson.course.title}`}
      className="page-width reading-page studio-page"
    >
      <header className="studio-controls studio-topbar">
        <Link
          className="studio-back"
          to={lessonPath(id, slug)}
          aria-label="Voltar à lição"
          title="Voltar à lição"
        >
          <ArrowLeft size={19} />
        </Link>
        <span className="studio-identity" title={lesson.title}>
          {slug}
        </span>
        <p
          className={dirty ? "studio-status pending" : "studio-status"}
          role="status"
        >
          {status}
        </p>
        <details className="studio-options">
          <summary aria-label="Mais opções" title="Mais opções">
            <MoreHorizontal size={20} />
          </summary>
          <div role="group" aria-label="Visualização do Studio">
            {(
              [
                ["visual", "Editor visual"],
                ["edit", "Editar fonte Markdown"],
                ["preview", "Prévia"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                aria-pressed={view === mode}
                onClick={(event) => {
                  changeView(mode);
                  const details = event.currentTarget.closest("details");
                  if (details) {
                    details.open = false;
                    details
                      .querySelector("summary")
                      ?.focus({ preventScroll: true });
                  }
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </details>
        <button
          className="studio-save"
          disabled={!dirty || saving || conflict}
          onClick={() => void save()}
        >
          {saving ? "Salvando…" : "Salvar alterações"}
        </button>
      </header>
      {notice && <p className="studio-notice">{notice}</p>}
      {storageError && (
        <p role="alert" className="studio-error">
          {storageError}
        </p>
      )}
      {error && (
        <section className="studio-error">
          <h2>
            {conflict
              ? "Conflito de edição"
              : "Não foi possível confirmar o salvamento"}
          </h2>
          <p role="alert">{error}</p>
          <p>
            Seu texto continua no editor. A prévia não grava nem executa código.
          </p>
          <button disabled={reviewing || saving} onClick={() => void review()}>
            {reviewing ? "Consultando arquivo…" : "Revisar arquivo atual"}
          </button>
        </section>
      )}
      {current && (
        <section className="studio-comparison">
          <h2>Versão atual do arquivo</h2>
          <p>
            Compare com seu texto antes de escolher. Uma nova alteração externa
            ainda será verificada no próximo salvamento.
          </p>
          <textarea
            aria-label="Markdown atual no arquivo"
            value={current.markdown}
            readOnly
            rows={10}
            spellCheck={false}
          />
          <div className="studio-review-actions">
            <button onClick={() => useReviewedFile(true)}>
              Manter meu texto e usar esta versão como base
            </button>
            <button onClick={() => useReviewedFile(false)}>
              Carregar arquivo no editor
            </button>
          </div>
        </section>
      )}
      {view === "visual" && (
        <Suspense fallback={<p role="status">Carregando editor visual…</p>}>
          <fieldset
            disabled={saving}
            inert={saving}
            className="visual-editor-fieldset"
          >
            <VisualEditor
              source={buffer.markdown}
              disabled={saving}
              onChange={(markdown) => {
                if (
                  buffer.baseMarkdown.includes("\r\n") &&
                  !buffer.baseMarkdown.replaceAll("\r\n", "").includes("\n")
                )
                  markdown = markdown.replaceAll("\n", "\r\n");
                changeBuffer({ ...buffer, markdown });
              }}
            />
          </fieldset>
        </Suspense>
      )}
      <section className="studio-edit-panel" hidden={view !== "edit"}>
        <label htmlFor="lesson-markdown">Markdown completo</label>
        <textarea
          id="lesson-markdown"
          ref={editor}
          value={buffer.markdown}
          disabled={saving}
          spellCheck={false}
          wrap="soft"
          onChange={(event) => {
            let markdown = event.target.value;
            if (
              buffer.baseMarkdown.includes("\r\n") &&
              !buffer.baseMarkdown.replaceAll("\r\n", "").includes("\n")
            )
              markdown = markdown.replaceAll("\n", "\r\n");
            changeBuffer({ ...buffer, markdown });
          }}
        />
        <p className="studio-caption">
          O rascunho fica nesta aba; o arquivo só muda ao salvar. Limite: 256
          KiB em UTF-8.
        </p>
      </section>
      {view === "preview" && (
        <section className="studio-preview" aria-label="Prévia da lição">
          <h2 className="studio-preview-title reading-title">{lesson.title}</h2>
          <div className="prose">
            {buffer.markdown.trim() ? (
              <Markdown source={lessonBody(buffer.markdown, lesson.title)} />
            ) : (
              <p>Esta lição ainda está vazia.</p>
            )}
          </div>
        </section>
      )}
      <details className="studio-file-details">
        <summary>Arquivo da lição</summary>
        <p className="studio-file">
          Arquivo:{" "}
          <code>
            {"content/courses/" + id + "/lessons/" + slug + "/lesson.md"}
          </code>
        </p>
        <p className="studio-caption">
          Após salvar, confira o arquivo no VS Code e revise seu git diff. O
          Studio não faz commits.
        </p>
      </details>
    </Page>
  );
}
