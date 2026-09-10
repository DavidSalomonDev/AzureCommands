"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORY_PARAM, OPERATION_PARAM } from "@/components/app-sidebar";
import {
  OperationHeading,
  groupByCategoryAndOperation,
} from "@/components/grouped-section";
import { CommandCard } from "@/components/command/command-card";
import { OPERATION_LABELS, resolveOperation } from "@/lib/operations";
import type { Command, CrudOperation } from "@/lib/types";

interface CommandListProps {
  commands: Command[];
  renderActions?: (command: Command) => ReactNode;
  /**
   * Sections listed in the sidebar filter by category through the `?cat=` query
   * param. "Mis comandos" has no sidebar categories (its data lives in the
   * browser), so it renders its own dropdown instead.
   */
  showCategorySelect?: boolean;
  /** Base path used to clear the category filter, e.g. "/cli". */
  basePath?: string;
}

const ALL_CATEGORIES = "__all__";

export function CommandList({
  commands,
  renderActions,
  showCategorySelect = false,
  basePath = "",
}: CommandListProps) {
  const searchParams = useSearchParams();
  const urlCategory = searchParams.get(CATEGORY_PARAM);
  const urlOperation = searchParams.get(OPERATION_PARAM) as CrudOperation | null;

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>(ALL_CATEGORIES);

  const category = showCategorySelect ? selected : (urlCategory ?? ALL_CATEGORIES);

  const categories = useMemo(() => {
    const set = new Set(commands.map((c) => c.category));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [commands]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return commands.filter((c) => {
      if (category !== ALL_CATEGORIES && c.category !== category) return false;
      if (urlOperation && resolveOperation(c) !== urlOperation) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.tags?.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [commands, query, category, urlOperation]);

  const grouped = useMemo(
    () =>
      groupByCategoryAndOperation(
        filtered,
        (c) => c.category,
        (c) => resolveOperation(c)
      ),
    [filtered]
  );

  const clearHref = urlCategory
    ? `${basePath}?${CATEGORY_PARAM}=${encodeURIComponent(urlCategory)}`
    : basePath || "?";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Buscar por título, descripción, categoría o etiqueta…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-md"
        />

        {showCategorySelect ? (
          <Select
            value={selected}
            onValueChange={(value) => setSelected(value ?? ALL_CATEGORIES)}
          >
            <SelectTrigger className="w-full sm:w-64" aria-label="Filtrar por categoría">
              <SelectValue>
                {(value: string) =>
                  value === ALL_CATEGORIES ? "Todas las categorías" : value
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORIES}>Todas las categorías</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex flex-wrap gap-2">
            {urlCategory && (
              <Link href={basePath || "?"}>
                <Badge variant="secondary" className="gap-1 py-1">
                  {urlCategory}
                  <X className="size-3" />
                  <span className="sr-only">Quitar filtro de categoría</span>
                </Badge>
              </Link>
            )}
            {urlOperation && (
              <Link href={clearHref}>
                <Badge variant="secondary" className="gap-1 py-1">
                  {OPERATION_LABELS[urlOperation]}
                  <X className="size-3" />
                  <span className="sr-only">Quitar filtro de operación</span>
                </Badge>
              </Link>
            )}
          </div>
        )}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {query.trim()
            ? `No se encontraron comandos para “${query}”.`
            : "No hay comandos con estos filtros."}
        </p>
      )}

      {grouped.map(({ category: groupCategory, groups }) => (
        <section key={groupCategory} className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {groupCategory}
          </h2>
          {groups.map(({ operation, items }) => (
            <div key={operation} className="flex flex-col gap-3">
              <OperationHeading operation={operation} count={items.length} />
              {items.map((cmd) => (
                <CommandCard key={cmd.id} command={cmd} actions={renderActions?.(cmd)} />
              ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
