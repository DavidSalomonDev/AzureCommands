"use client";

import type { ReactNode } from "react";

import { CatalogList, type CatalogItemAccessors } from "@/components/catalog-list";
import { CommandCard } from "@/components/command/command-card";
import { resolveOperation } from "@/lib/operations";
import type { Command } from "@/lib/types";

// Defined once, outside the component, so the list's memos stay stable.
const accessors: CatalogItemAccessors<Command> = {
  getId: (c) => c.id,
  getCategory: (c) => c.category,
  getOperation: resolveOperation,
  getSearchText: (c) =>
    [c.title, c.description, c.category, ...(c.tags ?? [])].join(" ").toLowerCase(),
};

interface CommandListProps {
  commands: Command[];
  renderActions?: (command: Command) => ReactNode;
  /** See `CatalogList`: "Mis comandos" uses its own category dropdown. */
  showCategorySelect?: boolean;
  /** Base path used to clear the filters, e.g. "/cli". */
  basePath?: string;
}

export function CommandList({
  commands,
  renderActions,
  showCategorySelect = false,
  basePath = "",
}: CommandListProps) {
  return (
    <CatalogList
      items={commands}
      accessors={accessors}
      renderItem={(command) => (
        <CommandCard command={command} actions={renderActions?.(command)} />
      )}
      searchPlaceholder="Buscar por título, descripción, categoría o etiqueta…"
      itemNoun="comandos"
      showCategorySelect={showCategorySelect}
      basePath={basePath}
    />
  );
}
