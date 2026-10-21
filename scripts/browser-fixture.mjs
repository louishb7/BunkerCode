import {
  cpSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { dirname, basename, join, sep } from "node:path";
import { tmpdir } from "node:os";

function rejectLinks(path) {
  if (lstatSync(path).isSymbolicLink())
    throw new Error(`Symlink in fixture: ${path}`);
  if (lstatSync(path).isDirectory())
    for (const name of readdirSync(path)) rejectLinks(join(path, name));
}

/** Only the server supervisor owns the disposable copy. Config/--list never copy. */
export async function withBrowserFixture(env, source, run) {
  const path = env.BUNKERCODE_BROWSER_CONTENT_DIR;
  if (!path) throw new Error("Missing browser content directory");
  const owned = env.BUNKERCODE_BROWSER_OWNED_CONTENT_DIR === path;
  if (!owned) {
    const canonical = realpathSync(source);
    const external = realpathSync(path);
    if (
      external === canonical ||
      external.startsWith(canonical + sep) ||
      canonical.startsWith(external + sep)
    )
      throw new Error("Browser fixture must not overlap canonical content");
    return run(path); // Explicit external directories are never changed here.
  }
  if (
    dirname(path) !== realpathSync(tmpdir()) ||
    !/^bunkercode-browser-content-[0-9a-f-]{36}$/.test(basename(path))
  )
    throw new Error("Invalid owned fixture location");
  rejectLinks(source);
  mkdirSync(path, { mode: 0o700 }); // Exclusive: never adopt another execution's directory.
  const identity = lstatSync(path);
  try {
    cpSync(source, path, { recursive: true, dereference: false });
    return await run(path);
  } finally {
    const current = lstatSync(path, { throwIfNoEntry: false });
    if (
      current &&
      !current.isSymbolicLink() &&
      current.ino === identity.ino &&
      current.dev === identity.dev
    )
      rmSync(path, { recursive: true }); // Node unlinks nested symlinks, never traverses them.
  }
}
