import type { Command, CrudOperation, Script, Shell } from "@/lib/types";

/**
 * Commands are grouped by product (category) and then by CRUD operation,
 * always in `OPERATION_ORDER`: consultar primero, porque es lo que más se usa
 * en el día a día.
 */
export type { CrudOperation };

export const OPERATION_ORDER: CrudOperation[] = [
  "read",
  "create",
  "update",
  "delete",
  "other",
];

export const OPERATION_LABELS: Record<CrudOperation, string> = {
  read: "Consultar",
  create: "Crear",
  update: "Actualizar",
  delete: "Eliminar",
  other: "Otras acciones",
};

/** Badge colors, subtle enough to work on both themes. */
export const OPERATION_BADGE_CLASSES: Record<CrudOperation, string> = {
  read: "border-sky-500/30 text-sky-700 dark:text-sky-300",
  create: "border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
  update: "border-amber-500/30 text-amber-700 dark:text-amber-300",
  delete: "border-rose-500/30 text-rose-700 dark:text-rose-300",
  other: "border-border text-muted-foreground",
};

export function compareOperations(a: CrudOperation, b: CrudOperation): number {
  return OPERATION_ORDER.indexOf(a) - OPERATION_ORDER.indexOf(b);
}

// --- Inference -------------------------------------------------------------

/** PowerShell approved verbs, mapped to their CRUD bucket. */
const POWERSHELL_VERBS: Record<string, CrudOperation> = {
  Get: "read",
  Find: "read",
  Search: "read",
  Show: "read",
  Test: "read",
  Measure: "read",
  Export: "read",
  New: "create",
  Add: "create",
  Import: "create",
  Copy: "create",
  Publish: "create",
  Set: "update",
  Update: "update",
  Enable: "update",
  Disable: "update",
  Start: "update",
  Stop: "update",
  Restart: "update",
  Resize: "update",
  Move: "update",
  Rename: "update",
  Invoke: "other",
  Connect: "other",
  Disconnect: "other",
  Remove: "delete",
  Clear: "delete",
  Revoke: "delete",
};

const CLI_ACTIONS: Record<string, CrudOperation> = {
  // read
  list: "read",
  show: "read",
  get: "read",
  tail: "read",
  download: "read",
  export: "read",
  wait: "read",
  // create
  create: "create",
  add: "create",
  new: "create",
  upload: "create",
  import: "create",
  build: "create",
  generate: "create",
  "backup-now": "create",
  // update
  update: "update",
  set: "update",
  enable: "update",
  disable: "update",
  start: "update",
  stop: "update",
  restart: "update",
  deallocate: "update",
  scale: "update",
  "open-port": "update",
  attach: "update",
  detach: "update",
  assign: "update",
  reset: "update",
  rotate: "update",
  sync: "update",
  move: "update",
  // delete
  delete: "delete",
  remove: "delete",
  purge: "delete",
  revoke: "delete",
};

const CLI_PREFIXES: [string, CrudOperation][] = [
  ["list", "read"],
  ["show", "read"],
  ["get", "read"],
  ["check", "read"],
  ["create", "create"],
  ["add", "create"],
  ["import", "create"],
  ["enable-", "update"],
  ["disable-", "update"],
  ["set", "update"],
  ["update", "update"],
  ["delete", "delete"],
  ["remove", "delete"],
];

/**
 * Extracts the action of an `az` command: the last word before the first
 * option, e.g. `az storage account keys list --…` → "list".
 */
function cliAction(template: string): string | null {
  const azIndex = template.indexOf("az ");
  if (azIndex === -1) return null;

  const words = template.slice(azIndex + 3).trim().split(/\s+/);
  const positional: string[] = [];
  for (const word of words) {
    if (word.startsWith("-")) break;
    positional.push(word.replace(/["']/g, ""));
  }
  return positional.at(-1) ?? null;
}

function inferFromCli(template: string): CrudOperation {
  const action = cliAction(template)?.toLowerCase();
  if (!action) return "other";

  const exact = CLI_ACTIONS[action];
  if (exact) return exact;

  for (const [prefix, operation] of CLI_PREFIXES) {
    if (action.startsWith(prefix)) return operation;
  }
  return "other";
}

function inferFromPowerShell(template: string): CrudOperation {
  // Matches the first `Verb-AzSomething`, even inside `(Get-AzResourceGroup).Count`
  // or `$item = Get-AzRecoveryServicesBackupItem …`.
  const match = template.match(/\b([A-Z][a-z]+)-Az/);
  if (!match) return "other";
  return POWERSHELL_VERBS[match[1]] ?? "other";
}

/** Best-effort CRUD classification of a command template. */
export function inferOperation(template: string, shell: Shell): CrudOperation {
  if (shell === "powershell") return inferFromPowerShell(template);
  return inferFromCli(template);
}

/** The command's declared operation, falling back to inference. */
export function resolveOperation(command: Command): CrudOperation {
  return command.operation ?? inferOperation(command.template, command.shell);
}

export function resolveScriptOperation(script: Script): CrudOperation {
  return script.operation ?? "other";
}
