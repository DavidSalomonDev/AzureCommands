"use client";

import { CatalogList, type CatalogItemAccessors } from "@/components/catalog-list";
import { ScriptCard } from "@/components/script/script-card";
import { resolveScriptOperation } from "@/lib/operations";
import type { Script } from "@/lib/types";

// Defined once, outside the component, so the list's memos stay stable.
const accessors: CatalogItemAccessors<Script> = {
  getId: (s) => s.id,
  getCategory: (s) => s.category,
  getOperation: resolveScriptOperation,
  getSearchText: (s) =>
    [s.title, s.description, s.category, s.fileName, ...(s.tags ?? [])]
      .join(" ")
      .toLowerCase(),
};

export function ScriptList({ scripts }: { scripts: Script[] }) {
  return (
    <CatalogList
      items={scripts}
      accessors={accessors}
      renderItem={(script) => <ScriptCard script={script} />}
      searchPlaceholder="Buscar por título, descripción, archivo o etiqueta…"
      itemNoun="scripts"
      basePath="/scripts"
    />
  );
}
