// Server-only loader for the script catalog (`content/scripts/`).
//
// A script is a real `.ps1` / `.sh` file — the same file you would run — plus
// an optional sidecar `.md` with the same basename holding its frontmatter and
// notes. Keeping the code in its own file means it stays runnable and diffable
// instead of being pasted inside markdown.
import { promises as fs } from "node:fs";
import path from "node:path";

import { cache as reactCache } from "react";

import matter from "gray-matter";

import { scriptId } from "@/lib/catalog";
import {
  CONTENT_DIR,
  USE_CACHE,
  markdownToHtml,
  relativeToProject,
  walkFiles,
} from "@/lib/content/fs-utils";
import { scriptFrontmatterSchema } from "@/lib/content/script-schema";
import { assertParametersMatchTemplate, assertUniqueIds } from "@/lib/content/validate";
import { slugify } from "@/lib/slugify";
import type { Script, ScriptLanguage } from "@/lib/types";

export const SCRIPTS_DIR = path.join(CONTENT_DIR, "scripts");

const LANGUAGE_BY_EXTENSION: Record<string, ScriptLanguage> = {
  ".ps1": "powershell",
  ".psm1": "powershell",
  ".sh": "bash",
  ".bash": "bash",
  ".azcli": "bash",
};

const DEFAULT_CATEGORY = "Sin categoría";

let cache: Script[] | null = null;

const isScript = (fileName: string) =>
  path.extname(fileName).toLowerCase() in LANGUAGE_BY_EXTENSION;

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
    throw new Error(
      `Frontmatter inválido en ${relativeToProject(sidecar)}:\n` +
        JSON.stringify(parsed.error.format(), null, 2)
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
  const parameters = fm?.parameters ?? [];

  assertParametersMatchTemplate(code, parameters, relativeToProject(file));

  return {
    id: scriptId(slug),
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
    parameters,
    requirements: fm?.requirements,
    notesHtml: sidecar ? (await markdownToHtml(sidecar.body)) || undefined : undefined,
  };
}

/** Loads every script under `content/scripts/`, sorted by category and title. */
export const getScripts = reactCache(async (): Promise<Script[]> => {
  if (USE_CACHE && cache) return cache;

  const files = await walkFiles(SCRIPTS_DIR, isScript);
  const scripts = await Promise.all(files.map(loadScript));

  assertUniqueIds(scripts, "Catálogo de scripts (content/scripts/)");

  scripts.sort(
    (a, b) =>
      a.category.localeCompare(b.category, "es") || a.title.localeCompare(b.title, "es")
  );

  if (USE_CACHE) cache = scripts;
  return scripts;
});
