// Server-only helpers shared by the two content loaders.
import { promises as fs } from "node:fs";
import path from "node:path";

import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";

/**
 * The loaders keep the whole catalog in a module-level variable, but only in
 * production: in dev it is reread on every request so that editing an `.mdx`
 * shows up without restarting the server.
 */
export const USE_CACHE = process.env.NODE_ENV === "production";

export const CONTENT_DIR = path.join(process.cwd(), "content");

/** Walks `dir`, returning every file whose name `accept` approves. */
export async function walkFiles(
  dir: string,
  accept: (fileName: string) => boolean,
  skipDirectory: (dirName: string) => boolean = () => false
): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const nested = await Promise.all(
    entries.map((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return skipDirectory(entry.name) ? [] : walkFiles(full, accept, skipDirectory);
      }
      return accept(entry.name) ? [full] : [];
    })
  );
  return nested.flat();
}

/**
 * Renders the Markdown body of a content file to HTML.
 *
 * `sanitize: false` keeps raw HTML in the notes: the input is the
 * repository's own content, authored by whoever can commit to `content/`,
 * never anything a visitor supplies.
 */
export async function markdownToHtml(markdown: string): Promise<string> {
  if (!markdown.trim()) return "";
  const processed = await remark()
    .use(remarkGfm)
    .use(remarkHtml, { sanitize: false })
    .process(markdown);
  return String(processed).trim();
}

/** Path as it reads in an error message: always with forward slashes. */
export function relativeToProject(file: string): string {
  return path.relative(process.cwd(), file).split(path.sep).join("/");
}
