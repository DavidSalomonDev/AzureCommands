import type { Command } from "@/lib/types";

export interface ExportBundle {
  app: "azure-commands";
  version: 1;
  exportedAt: string;
  commands: Command[];
}

export interface ImportResult {
  imported: number;
  errors: string[];
}

export type ImportMode = "merge" | "replace";

export type NewCommandInput = Omit<Command, "id" | "source">;
export type UpdateCommandInput = Partial<NewCommandInput>;

export interface UserCommandsRepository {
  list(): Command[];
  get(id: string): Command | undefined;
  create(input: NewCommandInput): Command;
  update(id: string, patch: UpdateCommandInput): Command | undefined;
  remove(id: string): void;
  clear(): void;
  exportAll(): ExportBundle;
  importAll(bundle: unknown, mode: ImportMode): ImportResult;
}
