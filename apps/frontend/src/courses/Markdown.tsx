import { Children, isValidElement } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize from "rehype-sanitize";

export function Markdown({ source }: { source: string }) {
  return (
    <ReactMarkdown
      skipHtml
      rehypePlugins={[rehypeSanitize, [rehypeHighlight, { detect: false }]]}
      components={{
        pre({ children }) {
          const child = Children.toArray(children)[0];
          const className = isValidElement<{ className?: string }>(child)
            ? (child.props.className ?? "")
            : "";
          const language = /language-([\w-]+)/.exec(className)?.[1] ?? "texto";
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
