import type { Command } from "@/lib/types";
import { commandArraySchema, commandSchema, exportBundleSchema } from "@/lib/schema";
import type {
  ExportBundle,
  ImportMode,
  ImportResult,
  NewCommandInput,
  UpdateCommandInput,
  UserCommandsRepository,
} from "@/lib/repositories/types";

const STORAGE_KEY = "azure-commands:user-commands:v1";

/** Thrown when the browser refuses to persist the command library. */
export class StorageWriteError extends Error {
  readonly name = "StorageWriteError";
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Attempts to read a raw import payload either as a full ExportBundle
 * ({ app, version, commands }) or as a bare array of commands, so users can
 * import files exported by an older version or hand-written JSON.
 */
function extractCommandsFromPayload(payload: unknown): Command[] | null {
  const bundleResult = exportBundleSchema.safeParse(payload);
  if (bundleResult.success) return bundleResult.data.commands;

  const arrayResult = commandArraySchema.safeParse(payload);
  if (arrayResult.success) return arrayResult.data;

  // Last resort: array of partial commands missing id/source (e.g. hand-authored).
  if (Array.isArray(payload)) {
    const withDefaults = payload.map((item) => ({
      id: generateId(),
      source: "user" as const,
      tags: [],
      parameters: [],
      ...((item as object) ?? {}),
    }));
    const lenientResult = commandArraySchema.safeParse(withDefaults);
    if (lenientResult.success) return lenientResult.data;
  }

  return null;
}

export class LocalStorageUserCommandsRepository implements UserCommandsRepository {
  private read(): Command[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = commandArraySchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : [];
    } catch {
      return [];
    }
  }

  /**
   * localStorage can refuse a write: private browsing, a browser policy, or
   * the quota being exhausted by a large import. Those throw, so the error is
   * turned into a `StorageWriteError` the UI can report instead of letting it
   * escape a React event handler.
   */
  private write(commands: Command[]): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(commands));
    } catch (cause) {
      throw new StorageWriteError(
        "No se pudieron guardar los comandos en este navegador. " +
          "Puede que el almacenamiento esté lleno o bloqueado (modo privado).",
        { cause }
      );
    }
  }

  list(): Command[] {
    return this.read();
  }

  get(id: string): Command | undefined {
    return this.read().find((c) => c.id === id);
  }

  create(input: NewCommandInput): Command {
    const command = commandSchema.parse({
      ...input,
      id: generateId(),
      source: "user",
    });
    const commands = this.read();
    commands.push(command);
    this.write(commands);
    return command;
  }

  update(id: string, patch: UpdateCommandInput): Command | undefined {
    const commands = this.read();
    const index = commands.findIndex((c) => c.id === id);
    if (index === -1) return undefined;

    const updated = commandSchema.parse({ ...commands[index], ...patch });
    commands[index] = updated;
    this.write(commands);
    return updated;
  }

  remove(id: string): void {
    this.write(this.read().filter((c) => c.id !== id));
  }

  clear(): void {
    this.write([]);
  }

  exportAll(): ExportBundle {
    return {
      app: "azure-commands",
      version: 1,
      exportedAt: new Date().toISOString(),
      commands: this.read(),
    };
  }

  // `importAll` already reports problems through `ImportResult.errors`, so a
  // refused write is returned the same way instead of thrown.
  importAll(bundle: unknown, mode: ImportMode): ImportResult {
    const incoming = extractCommandsFromPayload(bundle);
    if (!incoming) {
      return { imported: 0, errors: ["El archivo no tiene un formato de comandos válido."] };
    }

    const sanitized = incoming.map((c) => ({ ...c, source: "user" as const }));

    const existing = mode === "replace" ? [] : this.read();
    const next = this.appendTo(existing, sanitized);

    try {
      this.write(next);
    } catch (error) {
      if (error instanceof StorageWriteError) {
        return { imported: 0, errors: [error.message] };
      }
      throw error;
    }
    return { imported: sanitized.length, errors: [] };
  }

  /** Adds `incoming` after `existing`, giving a fresh id to every collision. */
  private appendTo(existing: Command[], incoming: Command[]): Command[] {
    const takenIds = new Set(existing.map((c) => c.id));
    const added = incoming.map((c) => {
      const id = c.id && !takenIds.has(c.id) ? c.id : generateId();
      takenIds.add(id);
      return { ...c, id };
    });
    return [...existing, ...added];
  }
}
