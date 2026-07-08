// Server-only content loader. Reads the MDX command library from `content/`
// at build time. Importing this from a Client Component will fail because of
// the `node:fs` dependency — that is intentional.
import { promises as fs } from "node:fs";
import path from "node:path";

import matter from "gray-matter";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";

import { frontmatterSchema } from "@/lib/content/frontmatter-schema";
import { slugify } from "@/lib/slugify";
import type { Command, Shell } from "@/lib/types";

const CONTENT_DIR = path.join(process.cwd(), "content");
const USE_CACHE = process.env.NODE_ENV === "production";

let cache: Command[] | null = null;

async function walkMdxFiles(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const nested = await Promise.all(
    entries.map((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walkMdxFiles(full);
      return /\.mdx?$/.test(entry.name) ? Promise.resolve([full]) : Promise.resolve([]);
    })
  );
  return nested.flat();
}

async function markdownToHtml(markdown: string): Promise<string> {
  if (!markdown.trim()) return "";
  const processed = await remark()
    .use(remarkGfm)
    .use(remarkHtml, { sanitize: false })
    .process(markdown);
  return String(processed).trim();
}

async function loadFile(file: string): Promise<Command> {
  const raw = await fs.readFile(file, "utf8");
  const { data, content } = matter(raw);

  const parsed = frontmatterSchema.safeParse(data);
  if (!parsed.success) {
    const rel = path.relative(CONTENT_DIR, file);
    throw new Error(
      `Frontmatter inválido en content/${rel}:\n${JSON.stringify(parsed.error.format(), null, 2)}`
    );
  }

  const fm = parsed.data;
  const slug = fm.slug ?? slugify(path.basename(file).replace(/\.mdx?$/, ""));
  const notesHtml = await markdownToHtml(content);

  return {
    id: `lib-${fm.shell}-${slug}`,
    slug,
    title: fm.title,
    description: fm.description,
    shell: fm.shell,
    category: fm.category,
    tags: fm.tags,
    template: fm.template,
    parameters: fm.parameters,
    notesHtml: notesHtml || undefined,
    source: "library",
  };
}

/** Loads and validates every command `.mdx` file under `content/`. */
export async function getLibraryCommands(): Promise<Command[]> {
  if (USE_CACHE && cache) return cache;

  const files = await walkMdxFiles(CONTENT_DIR);
  const commands = await Promise.all(files.map(loadFile));

  commands.sort(
    (a, b) =>
      a.category.localeCompare(b.category, "es") ||
      a.title.localeCompare(b.title, "es")
  );

  if (USE_CACHE) cache = commands;
  return commands;
}

export async function getLibraryCommandsByShell(shell: Shell): Promise<Command[]> {
  const all = await getLibraryCommands();
  return all.filter((c) => c.shell === shell);
}
