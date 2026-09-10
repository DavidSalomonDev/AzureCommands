// Server-only loader for the script catalog (`content/scripts/`).
//
// A script is a real `.ps1` / `.sh` file — the same file you would run — plus
// an optional sidecar `.md` with the same basename holding its frontmatter and
// notes. Keeping the code in its own file means it stays runnable and diffable
// instead of being pasted inside markdown.
import { promises as fs } from "node:fs";
import path from "node:path";

import matter from "gray-matter";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";

import { scriptFrontmatterSchema } from "@/lib/content/script-schema";
import { slugify } from "@/lib/slugify";
import type { Script, ScriptLanguage } from "@/lib/types";

export const SCRIPTS_DIR = path.join(process.cwd(), "content", "scripts");
const USE_CACHE = process.env.NODE_ENV === "production";

const LANGUAGE_BY_EXTENSION: Record<string, ScriptLanguage> = {
  ".ps1": "powershell",
  ".psm1": "powershell",
  ".sh": "bash",
  ".bash": "bash",
  ".azcli": "bash",
};

const DEFAULT_CATEGORY = "Sin categoría";

let cache: Script[] | null = null;

async function walkScriptFiles(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const nested = await Promise.all(
    entries.map((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walkScriptFiles(full);
      const ext = path.extname(entry.name).toLowerCase();
      return ext in LANGUAGE_BY_EXTENSION
        ? Promise.resolve([full])
        : Promise.resolve([]);
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

/** Reads `<script>.md` next to the script, when it exists. */
async function readSidecar(scriptFile: string) {
  const sidecar = scriptFile.replace(/\.[^.]+$/, ".md");
  let raw: string;
  try {
    raw = await fs.readFile(sidecar, "utf8");
  } catch {
    return null;
  }

  const { data, content } = matter(raw);
  const parsed = scriptFrontmatterSchema.safeParse(data);
  if (!parsed.success) {
    const rel = path.relative(process.cwd(), sidecar).split(path.sep).join("/");
    throw new Error(
      `Frontmatter inválido en ${rel}:\n${JSON.stringify(parsed.error.format(), null, 2)}`
    );
  }
  return { frontmatter: parsed.data, body: content };
}

async function loadScript(file: string): Promise<Script> {
  const code = (await fs.readFile(file, "utf8")).replace(/\r\n/g, "\n").trimEnd();
  const fileName = path.basename(file);
  const baseName = fileName.replace(/\.[^.]+$/, "");
  const ext = path.extname(fileName).toLowerCase();

  const sidecar = await readSidecar(file);
  const fm = sidecar?.frontmatter;

  // Without a sidecar, fall back to the folder name as category so that simply
  // dropping a script into `content/scripts/<carpeta>/` already groups it.
  const parentDir = path.basename(path.dirname(file));
  const fallbackCategory = parentDir === "scripts" ? DEFAULT_CATEGORY : parentDir;

  const slug = fm?.slug ?? slugify(baseName);

  return {
    id: `script-${slug}`,
    slug,
    title: fm?.title ?? baseName,
    description: fm?.description ?? "Script sin descripción.",
    language: fm?.language ?? LANGUAGE_BY_EXTENSION[ext] ?? "powershell",
    category: fm?.category ?? fallbackCategory,
    tags: fm?.tags,
    fileName,
    code,
    usage: fm?.usage,
    operation: fm?.operation ?? "other",
    parameters: fm?.parameters ?? [],
    requirements: fm?.requirements,
    notesHtml: sidecar ? (await markdownToHtml(sidecar.body)) || undefined : undefined,
  };
}

/** Loads every script under `content/scripts/`, sorted by category and title. */
export async function getScripts(): Promise<Script[]> {
  if (USE_CACHE && cache) return cache;

  const files = await walkScriptFiles(SCRIPTS_DIR);
  const scripts = await Promise.all(files.map(loadScript));

  scripts.sort(
    (a, b) =>
      a.category.localeCompare(b.category, "es") || a.title.localeCompare(b.title, "es")
  );

  if (USE_CACHE) cache = scripts;
  return scripts;
}
