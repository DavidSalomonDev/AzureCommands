// Server-only content loader. Reads the MDX command library from `content/`
// at build time. Importing this from a Client Component will fail because of
// the `node:fs` dependency — that is intentional.
import { promises as fs } from "node:fs";
import path from "node:path";

import { cache as reactCache } from "react";

import matter from "gray-matter";

import { commandId } from "@/lib/catalog";
import { frontmatterSchema } from "@/lib/content/frontmatter-schema";
import {
  CONTENT_DIR,
  USE_CACHE,
  markdownToHtml,
  relativeToProject,
  walkFiles,
} from "@/lib/content/fs-utils";
import { assertParametersMatchTemplate, assertUniqueIds } from "@/lib/content/validate";
import { inferOperation } from "@/lib/operations";
import { slugify } from "@/lib/slugify";
import type { Command, Shell } from "@/lib/types";

/** Folders under `content/` that hold something other than command MDX files. */
const IGNORED_DIRS = new Set(["scripts"]);

let cache: Command[] | null = null;

const isMdx = (fileName: string) => /\.mdx?$/.test(fileName);
/** `_powershell-originales` and friends: kept in the repo, out of the catalog. */
const isIgnoredDir = (dirName: string) =>
  IGNORED_DIRS.has(dirName) || dirName.startsWith("_");

async function loadFile(file: string): Promise<Command> {
  const raw = await fs.readFile(file, "utf8");
  const { data, content } = matter(raw);
  const origin = relativeToProject(file);

  const parsed = frontmatterSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      `Frontmatter inválido en ${origin}:\n${JSON.stringify(parsed.error.format(), null, 2)}`
    );
  }

  const fm = parsed.data;
  assertParametersMatchTemplate(fm.template, fm.parameters, origin);

  const slug = fm.slug ?? slugify(path.basename(file).replace(/\.mdx?$/, ""));
  const notesHtml = await markdownToHtml(content);

  return {
    id: commandId(fm.shell, slug),
    slug,
    title: fm.title,
    description: fm.description,
    shell: fm.shell,
    category: fm.category,
    tags: fm.tags,
    template: fm.template,
    parameters: fm.parameters,
    operation: fm.operation ?? inferOperation(fm.template, fm.shell),
    notesHtml: notesHtml || undefined,
    source: "library",
  };
}

/**
 * Loads and validates every command `.mdx` file under `content/`.
 *
 * `cache()` deduplicates the work within a single render: the sidebar (built
 * in the root layout) and the page itself both ask for the catalog, and in
 * dev —where the module cache is off so that editing an `.mdx` shows up
 * without a restart— that would otherwise mean reading every file twice.
 */
export const getLibraryCommands = reactCache(async (): Promise<Command[]> => {
  if (USE_CACHE && cache) return cache;

  const files = await walkFiles(CONTENT_DIR, isMdx, isIgnoredDir);
  const commands = await Promise.all(files.map(loadFile));

  assertUniqueIds(commands, "Catálogo de comandos (content/)");

  commands.sort(
    (a, b) =>
      a.category.localeCompare(b.category, "es") ||
      a.title.localeCompare(b.title, "es")
  );

  if (USE_CACHE) cache = commands;
  return commands;
});

export async function getLibraryCommandsByShell(shell: Shell): Promise<Command[]> {
  const all = await getLibraryCommands();
  return all.filter((c) => c.shell === shell);
}
