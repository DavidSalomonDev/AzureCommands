// Server-only: builds the sidebar tree (secciones → productos → operaciones)
// from the MDX command catalog and the script catalog.
import { getLibraryCommands } from "@/lib/content/loader";
import { getScripts } from "@/lib/content/scripts-loader";
import { NAV_ITEMS, type NavIcon } from "@/lib/nav-items";
import { compareOperations, resolveOperation, resolveScriptOperation } from "@/lib/operations";
import type { CrudOperation } from "@/lib/types";

export interface NavOperation {
  operation: CrudOperation;
  count: number;
}

export interface NavCategory {
  name: string;
  count: number;
  operations: NavOperation[];
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

interface Classified {
  category: string;
  operation: CrudOperation;
}

function tally(items: Classified[]): NavCategory[] {
  const byCategory = new Map<string, Map<CrudOperation, number>>();

  for (const item of items) {
    const operations = byCategory.get(item.category) ?? new Map<CrudOperation, number>();
    operations.set(item.operation, (operations.get(item.operation) ?? 0) + 1);
    byCategory.set(item.category, operations);
  }

  return Array.from(byCategory.entries())
    .map(([name, operations]) => ({
      name,
      count: Array.from(operations.values()).reduce((sum, n) => sum + n, 0),
      operations: Array.from(operations.entries())
        .map(([operation, count]) => ({ operation, count }))
        .sort((a, b) => compareOperations(a.operation, b.operation)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export async function getNavSections(): Promise<NavSection[]> {
  const [commands, scripts] = await Promise.all([getLibraryCommands(), getScripts()]);

  return NAV_ITEMS.map((item) => {
    let classified: Classified[] | null = null;

    if (item.href === "/scripts") {
      classified = scripts.map((s) => ({
        category: s.category,
        operation: resolveScriptOperation(s),
      }));
    } else if (item.shell) {
      classified = commands
        .filter((c) => c.shell === item.shell)
        .map((c) => ({ category: c.category, operation: resolveOperation(c) }));
    }

    return {
      href: item.href,
      label: item.label,
      description: item.description,
      status: item.status,
      icon: item.icon,
      count: classified?.length,
      categories: classified ? tally(classified) : [],
    };
  });
}
