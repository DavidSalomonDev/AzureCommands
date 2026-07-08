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

  private write(commands: Command[]): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(commands));
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

  importAll(bundle: unknown, mode: ImportMode): ImportResult {
    const incoming = extractCommandsFromPayload(bundle);
    if (!incoming) {
      return { imported: 0, errors: ["El archivo no tiene un formato de comandos válido."] };
    }

    const sanitized = incoming.map((c) => ({ ...c, source: "user" as const }));

    if (mode === "replace") {
      const withFreshIds = sanitized.map((c) => ({ ...c, id: c.id || generateId() }));
      this.write(withFreshIds);
      return { imported: withFreshIds.length, errors: [] };
    }

    const existing = this.read();
    const existingIds = new Set(existing.map((c) => c.id));
    const toAdd: Command[] = [];

    for (const c of sanitized) {
      const id = c.id && !existingIds.has(c.id) ? c.id : generateId();
      existingIds.add(id);
      toAdd.push({ ...c, id });
    }

    this.write([...existing, ...toAdd]);
    return { imported: toAdd.length, errors: [] };
  }
}
