"use client";

import { useEffect, useMemo, useState } from "react";

import { sectionForId, type CatalogSection } from "@/lib/catalog";
import type { Command, Script } from "@/lib/types";

interface CatalogPayload {
  commands: Command[];
  scripts: Script[];
}

/**
 * One in-flight (then resolved) promise per section, kept at module level so
 * leaving the page and coming back does not download it again.
 */
const requests = new Map<CatalogSection, Promise<CatalogPayload>>();

function loadSection(section: CatalogSection): Promise<CatalogPayload> {
  let pending = requests.get(section);
  if (!pending) {
    pending = fetch(`/catalog/${section}`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<CatalogPayload>;
      })
      .catch((error) => {
        // Let a later visit retry instead of caching the failure forever.
        requests.delete(section);
        throw error;
      });
    requests.set(section, pending);
  }
  return pending;
}

export interface FavoriteCatalog {
  commands: Command[];
  scripts: Script[];
  /** False while a needed section is still downloading. */
  ready: boolean;
  failed: boolean;
}

/**
 * Resolves favorite ids against the catalog, downloading only the sections
 * those ids belong to. With no catalog favorites nothing is fetched at all.
 */
export function useFavoriteCatalog(ids: readonly string[]): FavoriteCatalog {
  // Memoized through the joined key so `sections` keeps its identity between
  // renders and can be depended on directly.
  const key = useMemo(() => {
    const needed = new Set<CatalogSection>();
    for (const id of ids) {
      const section = sectionForId(id);
      if (section) needed.add(section);
    }
    return [...needed].sort().join(",");
  }, [ids]);

  const sections = useMemo(
    () => (key === "" ? [] : (key.split(",") as CatalogSection[])),
    [key]
  );

  const [loaded, setLoaded] = useState<Partial<Record<CatalogSection, CatalogPayload>>>(
    {}
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const missing = sections.filter((section) => !(section in loaded));
    if (missing.length === 0) return;

    let cancelled = false;
    Promise.all(
      missing.map(async (section) => [section, await loadSection(section)] as const)
    )
      .then((entries) => {
        if (!cancelled) {
          setLoaded((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [sections, loaded]);

  const ready = sections.every((section) => section in loaded);

  const commands = useMemo(
    () => sections.flatMap((section) => loaded[section]?.commands ?? []),
    [sections, loaded]
  );
  const scripts = useMemo(
    () => sections.flatMap((section) => loaded[section]?.scripts ?? []),
    [sections, loaded]
  );

  return { commands, scripts, ready, failed };
}
