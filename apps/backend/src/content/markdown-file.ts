import { constants, openSync, fstatSync, readSync, closeSync } from "node:fs";
import { isUtf8 } from "node:buffer";
import { createHash } from "node:crypto";
import { UnprocessableEntityException } from "@nestjs/common";

export const MAX_MARKDOWN_BYTES = 256 * 1024;
export interface MarkdownRevision {
  markdown: string;
  version: string;
}
export function markdownVersion(markdown: string): string {
  return createHash("sha256").update(markdown, "utf8").digest("hex");
}
export function readMarkdownFile(path: string): MarkdownRevision {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = fstatSync(descriptor);
    if (!stat.isFile() || stat.size > MAX_MARKDOWN_BYTES)
      throw new Error("Invalid Markdown size or file type");
    // Bound the actual read too: an external writer can grow the file after stat.
    const buffer = Buffer.alloc(MAX_MARKDOWN_BYTES + 1);
    let count = 0;
    while (count < buffer.length) {
      const bytes = readSync(
        descriptor,
        buffer,
        count,
        buffer.length - count,
        count,
      );
      if (!bytes) break;
      count += bytes;
    }
    const bytes = buffer.subarray(0, count);
    if (count > MAX_MARKDOWN_BYTES || !isUtf8(bytes))
      throw new Error("Markdown must be bounded UTF-8");
    const markdown = bytes.toString("utf8");
    return { markdown, version: markdownVersion(markdown) };
  } catch {
    throw new UnprocessableEntityException(
      "Markdown indisponível: use arquivo UTF-8 regular de até 256 KiB, sem symlink.",
    );
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}
