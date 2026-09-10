// Server-only: builds the sidebar tree (sections + their categories) from the
// MDX command catalog and the script catalog.
import { getLibraryCommands } from "@/lib/content/loader";
import { getScripts } from "@/lib/content/scripts-loader";
import { NAV_ITEMS, type NavIcon } from "@/lib/nav-items";

export interface NavCategory {
  name: string;
  count: number;
}

export interface NavSection {
  href: string;
  label: string;
  description: string;
  status: "available" | "soon";
  icon: NavIcon;
  /** Total items in the section, when it is backed by content. */
  count?: number;
  categories: NavCategory[];
}

function tally(items: { category: string }[]): NavCategory[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  }
  return Array.from(counts, ([name, count]) => ({ name, count })).sort((a, b) =>
    a.name.localeCompare(b.name, "es")
  );
}

export async function getNavSections(): Promise<NavSection[]> {
  const [commands, scripts] = await Promise.all([getLibraryCommands(), getScripts()]);

  return NAV_ITEMS.map((item) => {
    const items =
      item.href === "/scripts"
        ? scripts
        : item.shell
          ? commands.filter((c) => c.shell === item.shell)
          : null;

    return {
      href: item.href,
      label: item.label,
      description: item.description,
      status: item.status,
      icon: item.icon,
      count: items?.length,
      categories: items ? tally(items) : [],
    };
  });
}
