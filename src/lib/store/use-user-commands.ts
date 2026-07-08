"use client";

import { useCallback, useEffect, useState } from "react";

import { LocalStorageUserCommandsRepository } from "@/lib/repositories/local-storage-repo";
import type {
  ExportBundle,
  ImportMode,
  ImportResult,
  NewCommandInput,
  UpdateCommandInput,
} from "@/lib/repositories/types";
import type { Command } from "@/lib/types";

const repo = new LocalStorageUserCommandsRepository();

export function useUserCommands() {
  const [commands, setCommands] = useState<Command[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCommands(repo.list());
    setHydrated(true);
  }, []);

  const create = useCallback((input: NewCommandInput) => {
    const created = repo.create(input);
    setCommands(repo.list());
    return created;
  }, []);

  const update = useCallback((id: string, patch: UpdateCommandInput) => {
    const updated = repo.update(id, patch);
    setCommands(repo.list());
    return updated;
  }, []);

  const remove = useCallback((id: string) => {
    repo.remove(id);
    setCommands(repo.list());
  }, []);

  const exportAll = useCallback((): ExportBundle => repo.exportAll(), []);

  const importAll = useCallback((bundle: unknown, mode: ImportMode): ImportResult => {
    const result = repo.importAll(bundle, mode);
    setCommands(repo.list());
    return result;
  }, []);

  return { commands, hydrated, create, update, remove, exportAll, importAll };
}
