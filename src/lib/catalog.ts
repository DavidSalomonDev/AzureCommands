import type { Shell } from "@/lib/types";

/**
 * The build-time catalog, split into the pieces that can be fetched on their
 * own. Favorites are ids in localStorage, so the page that shows them has to
 * work out which files it needs before downloading anything: the id carries
 * its section, and every id is built here so both ends agree on the shape.
 */
export const CATALOG_SECTIONS = ["cli", "powershell", "scripts"] as const;

export type CatalogSection = (typeof CATALOG_SECTIONS)[number];

/** Shell behind each section backed by the MDX command catalog. */
export const SHELL_BY_SECTION = {
  cli: "azurecli",
  powershell: "powershell",
} as const satisfies Partial<Record<CatalogSection, Shell>>;

export type CommandSection = keyof typeof SHELL_BY_SECTION;

export function commandId(shell: Shell, slug: string): string {
  return `lib-${shell}-${slug}`;
}

export function scriptId(slug: string): string {
  return `script-${slug}`;
}

/**
 * Which section an id belongs to, or null when it is not part of the catalog
 * — a personal command, which lives in localStorage and needs no download.
 */
export function sectionForId(id: string): CatalogSection | null {
  if (id.startsWith(scriptId(""))) return "scripts";

  for (const section of Object.keys(SHELL_BY_SECTION) as CommandSection[]) {
    if (id.startsWith(commandId(SHELL_BY_SECTION[section], ""))) return section;
  }
  return null;
}

export function isCatalogSection(value: string): value is CatalogSection {
  return (CATALOG_SECTIONS as readonly string[]).includes(value);
}
