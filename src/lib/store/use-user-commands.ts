"use client";

import { useCallback, useSyncExternalStore } from "react";

import { LocalStorageUserCommandsRepository } from "@/lib/repositories/local-storage-repo";
import type {
  ExportBundle,
  ImportMode,
  ImportResult,
  NewCommandInput,
  UpdateCommandInput,
} from "@/lib/repositories/types";
import type { Command } from "@/lib/types";

/**
 * The personal command library lives in localStorage. It is read through
 * useSyncExternalStore so every mounted component shares one snapshot: a
 * command created in "Mis comandos" is immediately visible to the favorites
 * view, and the server render always sees an empty list (no hydration
 * mismatch).
 */
const repo = new LocalStorageUserCommandsRepository();

const listeners = new Set<() => void>();

const EMPTY: Command[] = [];

// Snapshots must be referentially stable between renders, so the parsed list
// is cached and only rebuilt after a write (ours, or another tab's).
let snapshot: Command[] | null = null;

function getSnapshot(): Command[] {
  snapshot ??= repo.list();
  return snapshot;
}

function getServerSnapshot(): Command[] {
  return EMPTY;
}

function invalidate() {
  snapshot = null;
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Another tab wrote to localStorage: drop the cached snapshot and re-read.
  window.addEventListener("storage", invalidate);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", invalidate);
  };
}

/**
 * True once React has hydrated. Lets the UI tell "no commands yet" apart from
 * "not read from localStorage yet" without reaching for an effect.
 */
const subscribeToNothing = () => () => {};

export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false
  );
}

export function useUserCommands() {
  const commands = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useHydrated();

  const create = useCallback((input: NewCommandInput) => {
    const created = repo.create(input);
    invalidate();
    return created;
  }, []);

  const update = useCallback((id: string, patch: UpdateCommandInput) => {
    const updated = repo.update(id, patch);
    invalidate();
    return updated;
  }, []);

  const remove = useCallback((id: string) => {
    repo.remove(id);
    invalidate();
  }, []);

  const exportAll = useCallback((): ExportBundle => repo.exportAll(), []);

  const importAll = useCallback((bundle: unknown, mode: ImportMode): ImportResult => {
    const result = repo.importAll(bundle, mode);
    invalidate();
    return result;
  }, []);

  return { commands, hydrated, create, update, remove, exportAll, importAll };
}
