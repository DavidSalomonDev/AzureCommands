"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { CATEGORY_PARAM, OPERATION_PARAM } from "@/components/app-sidebar";
import {
  OperationHeading,
  groupByCategoryAndOperation,
} from "@/components/grouped-section";
import { ScriptCard } from "@/components/script/script-card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { OPERATION_LABELS, resolveScriptOperation } from "@/lib/operations";
import type { CrudOperation, Script } from "@/lib/types";

export function ScriptList({ scripts }: { scripts: Script[] }) {
  const searchParams = useSearchParams();
  const category = searchParams.get(CATEGORY_PARAM);
  const operation = searchParams.get(OPERATION_PARAM) as CrudOperation | null;
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scripts.filter((s) => {
      if (category && s.category !== category) return false;
      if (operation && resolveScriptOperation(s) !== operation) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.fileName.toLowerCase().includes(q) ||
        s.tags?.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [scripts, query, category, operation]);

  const grouped = useMemo(
    () =>
      groupByCategoryAndOperation(
        filtered,
        (s) => s.category,
        (s) => resolveScriptOperation(s)
      ),
    [filtered]
  );

  const clearOperationHref = category
    ? `/scripts?${CATEGORY_PARAM}=${encodeURIComponent(category)}`
    : "/scripts";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Buscar por título, descripción, archivo o etiqueta…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-md"
        />
        <div className="flex flex-wrap gap-2">
          {category && (
            <Link href="/scripts">
              <Badge variant="secondary" className="gap-1 py-1">
                {category}
                <X className="size-3" />
                <span className="sr-only">Quitar filtro de categoría</span>
              </Badge>
            </Link>
          )}
          {operation && (
            <Link href={clearOperationHref}>
              <Badge variant="secondary" className="gap-1 py-1">
                {OPERATION_LABELS[operation]}
                <X className="size-3" />
                <span className="sr-only">Quitar filtro de operación</span>
              </Badge>
            </Link>
          )}
        </div>
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {query.trim()
            ? `No se encontraron scripts para “${query}”.`
            : "No hay scripts con estos filtros."}
        </p>
      )}

      {grouped.map(({ category: groupCategory, groups }) => (
        <section key={groupCategory} className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {groupCategory}
          </h2>
          {groups.map(({ operation: groupOperation, items }) => (
            <div key={groupOperation} className="flex flex-col gap-3">
              <OperationHeading operation={groupOperation} count={items.length} />
              {items.map((script) => (
                <ScriptCard key={script.id} script={script} />
              ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
