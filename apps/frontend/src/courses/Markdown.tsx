import { validateEditorial } from "@bunkercode/content";
import { EditorialBlock } from "./EditorialBlock";
import { Children, isValidElement } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize from "rehype-sanitize";

export function Markdown({
  source,
  exercise,
}: {
  source: string;
  exercise?: React.ReactNode;
}) {
  try {
    validateEditorial(source);
  } catch (error) {
    return (
      <div>
        <p role="alert">
          Conteúdo editorial inválido:{" "}
          {error instanceof Error ? error.message : "revise a fonte."}
        </p>
        <pre>{source}</pre>
      </div>
    );
  }
  return (
    <ReactMarkdown
      skipHtml
      rehypePlugins={[
        rehypeSanitize,
        [
          rehypeHighlight,
          {
            detect: false,
            plainText: ["bunker-quiz", "bunker-note", "bunker-exercise"],
          },
        ],
      ]}
      components={{
        h2({ node, children }) {
          return (
            <h2 id={`section-line-${node?.position?.start.line}`}>
              {children}
            </h2>
          );
        },
        h3({ node, children }) {
          return (
            <h3 id={`section-line-${node?.position?.start.line}`}>
              {children}
            </h3>
          );
        },
        pre({ children }) {
          const child = Children.toArray(children)[0];
          const className = isValidElement<{
            className?: string;
            children?: React.ReactNode;
          }>(child)
            ? (child.props.className ?? "")
            : "";
          const language = /language-([\w-]+)/.exec(className)?.[1] ?? "texto";
          if (language === "bunker-exercise")
            return (
              exercise ?? (
                <aside className="editorial-note">
                  Enunciado do exercício associado à lição.
                </aside>
              )
            );
          if (
            (language === "bunker-quiz" || language === "bunker-note") &&
            isValidElement<{ children?: React.ReactNode }>(child)
          )
            return (
              <EditorialBlock
                language={language}
                source={String(child.props.children ?? "")}
              />
            );
          return (
            <div className="code-block">
              <div className="code-language">{language}</div>
              <pre>{children}</pre>
            </div>
          );
        },
        a({ href, children }) {
          return (
            <a
              href={href}
              target={/^https?:\/\//.test(href ?? "") ? "_blank" : undefined}
              rel="noopener noreferrer"
            >
              {children}
            </a>
          );
        },
      }}
    >
      {source}
    </ReactMarkdown>
  );
}

export function lessonBody(markdown: string, title: string) {
  const lines = markdown.split("\n");
  return lines[0]?.trim() === "# " + title
    ? lines.slice(1).join("\n")
    : markdown;
}
