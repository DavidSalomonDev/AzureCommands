"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";

import { CATEGORY_PARAM, OPERATION_PARAM } from "@/components/app-sidebar";
import {
  OperationHeading,
  groupByCategoryAndOperation,
} from "@/components/grouped-section";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OPERATION_LABELS, parseOperationParam } from "@/lib/operations";
import type { CrudOperation } from "@/lib/types";

const ALL_CATEGORIES = "__all__";

/** What the list needs from an item, whatever its concrete type. */
export interface CatalogItemAccessors<T> {
  getId: (item: T) => string;
  getCategory: (item: T) => string;
  getOperation: (item: T) => CrudOperation;
  /** Lowercased haystack the search box matches against. */
  getSearchText: (item: T) => string;
}

interface CatalogListProps<T> {
  items: T[];
  accessors: CatalogItemAccessors<T>;
  renderItem: (item: T) => ReactNode;
  searchPlaceholder: string;
  /** "comandos" / "scripts": used in the empty-state messages. */
  itemNoun: string;
  /**
   * Sections listed in the sidebar filter by category through the `?cat=`
   * query param. "Mis comandos" has no sidebar categories (its data lives in
   * the browser), so it renders its own dropdown instead.
   */
  showCategorySelect?: boolean;
  /** Base path used to clear the filters, e.g. "/cli". */
  basePath?: string;
}

/**
 * The shared catalog view: search box, the `?cat=` / `?op=` filter chips, and
 * the items grouped by product and CRUD operation. Commands and scripts only
 * differ in how a single card is rendered and in where their fields live,
 * which is what `accessors` and `renderItem` supply.
 */
export function CatalogList<T>({
  items,
  accessors,
  renderItem,
  searchPlaceholder,
  itemNoun,
  showCategorySelect = false,
  basePath = "",
}: CatalogListProps<T>) {
  const { getId, getCategory, getOperation, getSearchText } = accessors;

  const searchParams = useSearchParams();
  const urlCategory = searchParams.get(CATEGORY_PARAM);
  const urlOperation = parseOperationParam(searchParams.get(OPERATION_PARAM));

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>(ALL_CATEGORIES);

  const category = showCategorySelect ? selected : (urlCategory ?? ALL_CATEGORIES);

  const categories = useMemo(() => {
    const set = new Set(items.map(getCategory));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [items, getCategory]);

  // Built once per catalog instead of once per keystroke per item.
  const searchIndex = useMemo(() => {
    const index = new Map<string, string>();
    for (const item of items) index.set(getId(item), getSearchText(item));
    return index;
  }, [items, getId, getSearchText]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== ALL_CATEGORIES && getCategory(item) !== category) return false;
      if (urlOperation && getOperation(item) !== urlOperation) return false;
      return !q || (searchIndex.get(getId(item)) ?? "").includes(q);
    });
  }, [items, query, category, urlOperation, getCategory, getOperation, getId, searchIndex]);

  const grouped = useMemo(
    () => groupByCategoryAndOperation(filtered, getCategory, getOperation),
    [filtered, getCategory, getOperation]
  );

  const clearOperationHref = urlCategory
    ? `${basePath}?${CATEGORY_PARAM}=${encodeURIComponent(urlCategory)}`
    : basePath || "?";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder={searchPlaceholder}
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
              <Link href={clearOperationHref}>
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
            ? `No se encontraron ${itemNoun} para “${query}”.`
            : `No hay ${itemNoun} con estos filtros.`}
        </p>
      )}

      {grouped.map(({ category: groupCategory, groups }) => (
        <section key={groupCategory} className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {groupCategory}
          </h2>
          {groups.map(({ operation, items: groupItems }) => (
            <div key={operation} className="flex flex-col gap-3">
              <OperationHeading operation={operation} count={groupItems.length} />
              {groupItems.map((item) => (
                <Fragment key={getId(item)}>{renderItem(item)}</Fragment>
              ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
