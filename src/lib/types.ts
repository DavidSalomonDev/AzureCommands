export type Shell =
  | "powershell"
  | "azurecli"
  | "arm"
  | "bicep"
  | "terraform"
  | "bash"
  | "cmd"
  | "other";

export type ParamType = "string" | "number" | "boolean" | "enum";

export interface CommandParameter {
  /** Token as it appears in the template, e.g. "resourceGroup" for <resourceGroup> */
  name: string;
  /** Human readable label shown above the input */
  label: string;
  description?: string;
  type: ParamType;
  required: boolean;
  default?: string;
  placeholder?: string;
  /** Only used when type === "enum" */
  options?: string[];
}

export interface Command {
  id: string;
  slug: string;
  title: string;
  description: string;
  shell: Shell;
  category: string;
  tags?: string[];
  /** Raw command text containing <token> placeholders */
  template: string;
  parameters: CommandParameter[];
  /** Free-form notes, tips, doc links (plain text; used by user commands). */
  notes?: string;
  /** Notes rendered from the MDX body to HTML at build time (library commands). */
  notesHtml?: string;
  source: "library" | "user";
}

export const SHELL_LABELS: Record<Shell, string> = {
  powershell: "PowerShell",
  azurecli: "Azure CLI (Bash)",
  arm: "ARM Template",
  bicep: "Bicep",
  terraform: "Terraform",
  bash: "Bash / Linux",
  cmd: "CMD (Windows)",
  other: "Otro",
};

/** Shells offered when authoring a personal command in "Mis comandos". */
export const USER_SHELL_OPTIONS: Shell[] = [
  "powershell",
  "azurecli",
  "bash",
  "cmd",
  "other",
];
