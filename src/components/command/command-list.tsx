"use client";

import { useMemo, useState, type ReactNode } from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CommandCard } from "@/components/command/command-card";
import type { Command } from "@/lib/types";

interface CommandListProps {
  commands: Command[];
  renderActions?: (command: Command) => ReactNode;
}

const ALL_CATEGORIES = "__all__";

export function CommandList({ commands, renderActions }: CommandListProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);

  const categories = useMemo(() => {
    const set = new Set(commands.map((c) => c.category));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [commands]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return commands.filter((c) => {
      if (category !== ALL_CATEGORIES && c.category !== category) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.tags?.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [commands, query, category]);

  const grouped = useMemo(() => {
    const map = new Map<string, Command[]>();
    for (const cmd of filtered) {
      const list = map.get(cmd.category) ?? [];
      list.push(cmd);
      map.set(cmd.category, list);
    }
    return map;
  }, [filtered]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Buscar por título, descripción, categoría o etiqueta…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-md"
        />
        <Select value={category} onValueChange={setCategory}>
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
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {query.trim()
            ? `No se encontraron comandos para “${query}”.`
            : "No hay comandos en esta categoría."}
        </p>
      )}

      {Array.from(grouped.entries()).map(([category, cmds]) => (
        <section key={category} className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {category}
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {cmds.map((cmd) => (
              <CommandCard key={cmd.id} command={cmd} actions={renderActions?.(cmd)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
