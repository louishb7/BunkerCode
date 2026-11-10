export interface TextSelection {
  start: number;
  end: number;
}
export interface TextEdit extends TextSelection {
  text: string;
}
export function wrapNoteText(
  text: string,
  range: TextSelection,
  marker: string,
  placeholder: string,
): TextEdit {
  const selected = text.slice(range.start, range.end) || placeholder;
  if (
    range.start >= marker.length &&
    text.slice(range.start - marker.length, range.start) === marker &&
    text.slice(range.end, range.end + marker.length) === marker
  )
    return {
      text:
        text.slice(0, range.start - marker.length) +
        selected +
        text.slice(range.end + marker.length),
      start: range.start - marker.length,
      end: range.start - marker.length + selected.length,
    };
  return {
    text:
      text.slice(0, range.start) +
      marker +
      selected +
      marker +
      text.slice(range.end),
    start: range.start + marker.length,
    end: range.start + marker.length + selected.length,
  };
}
export function listNoteText(text: string, range: TextSelection): TextEdit {
  const start = text.lastIndexOf("\n", range.start - 1) + 1;
  const next = text.indexOf("\n", Math.max(range.start, range.end - 1));
  const end = next < 0 ? text.length : next;
  const lines = (text.slice(start, end) || "item").split("\n");
  const remove = lines.every((line) => line.startsWith("- "));
  const replacement = lines
    .map((line) => (remove ? line.slice(2) : "- " + line))
    .join("\n");
  return {
    text: text.slice(0, start) + replacement + text.slice(end),
    start,
    end: start + replacement.length,
  };
}
export function linkNoteText(
  text: string,
  range: TextSelection,
  href: string,
): TextEdit {
  const label = text.slice(range.start, range.end) || "link";
  const replacement = `[${label.replaceAll("[", "\\[").replaceAll("]", "\\]")}](${href.replaceAll("(", "%28").replaceAll(")", "%29")})`;
  return {
    text: text.slice(0, range.start) + replacement + text.slice(range.end),
    start: range.start + 1,
    end: range.start + 1 + label.length,
  };
}
