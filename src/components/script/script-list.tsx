"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { CATEGORY_PARAM } from "@/components/app-sidebar";
import { ScriptCard } from "@/components/script/script-card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { Script } from "@/lib/types";

export function ScriptList({ scripts }: { scripts: Script[] }) {
  const searchParams = useSearchParams();
  const category = searchParams.get(CATEGORY_PARAM);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scripts.filter((s) => {
      if (category && s.category !== category) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.fileName.toLowerCase().includes(q) ||
        s.tags?.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [scripts, query, category]);

  const grouped = useMemo(() => {
    const map = new Map<string, Script[]>();
    for (const script of filtered) {
      const list = map.get(script.category) ?? [];
      list.push(script);
      map.set(script.category, list);
    }
    return map;
  }, [filtered]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Buscar por título, descripción, archivo o etiqueta…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-md"
        />
        {category && (
          <Link href="/scripts" className="w-fit">
            <Badge variant="secondary" className="gap-1 py-1">
              {category}
              <X className="size-3" />
              <span className="sr-only">Quitar filtro de categoría</span>
            </Badge>
          </Link>
        )}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {query.trim()
            ? `No se encontraron scripts para “${query}”.`
            : "No hay scripts en esta categoría."}
        </p>
      )}

      {Array.from(grouped.entries()).map(([groupCategory, items]) => (
        <section key={groupCategory} className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {groupCategory}
          </h2>
          <div className="flex flex-col gap-4">
            {items.map((script) => (
              <ScriptCard key={script.id} script={script} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
