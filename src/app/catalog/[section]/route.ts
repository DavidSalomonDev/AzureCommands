// Serves each catalog section as JSON, prerendered at build time next to the
// pages. "Favoritos" uses it to download only the sections it actually has
// favorites in, instead of receiving the whole catalog with every visit.
import {
  CATALOG_SECTIONS,
  SHELL_BY_SECTION,
  isCatalogSection,
  type CatalogSection,
  type CommandSection,
} from "@/lib/catalog";
import { getLibraryCommandsByShell } from "@/lib/content/loader";
import { getScripts } from "@/lib/content/scripts-loader";
import type { Command, Script } from "@/lib/types";

export const dynamic = "force-static";
/** Only the sections below exist; anything else is a 404 instead of a build. */
export const dynamicParams = false;

export interface CatalogPayload {
  commands: Command[];
  scripts: Script[];
}

export function generateStaticParams() {
  return CATALOG_SECTIONS.map((section) => ({ section }));
}

async function loadSection(section: CatalogSection): Promise<CatalogPayload> {
  if (section === "scripts") {
    return { commands: [], scripts: await getScripts() };
  }
  const shell = SHELL_BY_SECTION[section as CommandSection];
  return { commands: await getLibraryCommandsByShell(shell), scripts: [] };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ section: string }> }
) {
  const { section } = await params;
  if (!isCatalogSection(section)) {
    return new Response("Not found", { status: 404 });
  }

  return Response.json(await loadSection(section));
}
