"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Favorites are just a list of command/script ids kept in localStorage. They
 * are read through useSyncExternalStore so every card on the page reacts to a
 * change without prop drilling, and the server render always sees an empty
 * list (no hydration mismatch).
 */
const STORAGE_KEY = "azure-commands:favorites:v1";

const listeners = new Set<() => void>();

const EMPTY: readonly string[] = [];

// Snapshots must be referentially stable between renders, so the parsed array
// is cached and only rebuilt when the raw string actually changes.
let cachedRaw: string | null = null;
let cachedIds: readonly string[] = EMPTY;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // localStorage bloqueado (modo privado, políticas del navegador).
    return null;
  }
}

function getSnapshot(): readonly string[] {
  const raw = readRaw();
  if (raw === cachedRaw) return cachedIds;

  cachedRaw = raw;
  if (!raw) {
    cachedIds = EMPTY;
    return cachedIds;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    cachedIds = Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : EMPTY;
  } catch {
    cachedIds = EMPTY;
  }
  return cachedIds;
}

function getServerSnapshot(): readonly string[] {
  return EMPTY;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function write(ids: readonly string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Ignorado: los favoritos simplemente no persisten.
  }
  // Invalida la caché aunque localStorage no esté disponible.
  cachedRaw = JSON.stringify(ids);
  cachedIds = ids;
  for (const listener of listeners) listener();
}

export function useFavorites() {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const isFavorite = useCallback((id: string) => ids.includes(id), [ids]);

  const toggle = useCallback(
    (id: string) => {
      const current = getSnapshot();
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
      write(next);
      return !current.includes(id);
    },
    []
  );

  const remove = useCallback((id: string) => {
    write(getSnapshot().filter((item) => item !== id));
  }, []);

  const clear = useCallback(() => write([]), []);

  return { ids, count: ids.length, isFavorite, toggle, remove, clear };
}
