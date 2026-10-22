import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readSync,
} from "node:fs";
import { isUtf8 } from "node:buffer";

export const MAX_MANIFEST_BYTES = 64 * 1024;

export type ManifestReadFailure = "unavailable" | "too-large" | "invalid-utf8";

export class ManifestReadError extends Error {
  constructor(
    readonly reason: ManifestReadFailure,
    message: string,
  ) {
    super(message);
    this.name = "ManifestReadError";
  }
}

export interface ManifestSource {
  text: string;
  bytes: Buffer;
}

function fail(reason: ManifestReadFailure, message: string): never {
  throw new ManifestReadError(reason, message);
}

// Node-only: validates the original bytes before JSON parsing and bounds the
// actual read, because the file can grow after fstat.
export function readManifestSource(
  path: string,
  limit = MAX_MANIFEST_BYTES,
): ManifestSource {
  if (!Number.isSafeInteger(limit) || limit <= 0)
    throw new RangeError("Manifest limit must be a positive safe integer.");
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      path,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const stat = fstatSync(descriptor);
    if (!stat.isFile())
      fail(
        "unavailable",
        "Manifesto indisponível: use arquivo regular UTF-8 sem symlink.",
      );
    if (stat.size > limit)
      fail("too-large", `Manifesto excede o limite de ${limit} bytes.`);
    const buffer = Buffer.alloc(limit + 1);
    let count = 0;
    while (count < buffer.length) {
      const size = readSync(
        descriptor,
        buffer,
        count,
        buffer.length - count,
        count,
      );
      if (!size) break;
      count += size;
    }
    const bytes = buffer.subarray(0, count);
    if (count > limit)
      fail("too-large", `Manifesto excede o limite de ${limit} bytes.`);
    if (!isUtf8(bytes))
      fail(
        "invalid-utf8",
        "Manifesto inválido: conteúdo não é UTF-8 válido.",
      );
    return { text: bytes.toString("utf8"), bytes };
  } catch (error) {
    if (error instanceof ManifestReadError) throw error;
    throw new ManifestReadError(
      "unavailable",
      "Manifesto indisponível: use arquivo regular UTF-8 sem symlink.",
    );
  } finally {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        // The bytes are already validated; a close failure cannot produce text.
      }
    }
  }
}
