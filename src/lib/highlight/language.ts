import type { ScriptLanguage, Shell } from "@/lib/types";

/**
 * What the highlighter can colour. Only Bash has a tokenizer so far
 * (`src/lib/highlight/bash.ts`); everything else renders as plain text with
 * its `<token>` placeholders still highlighted.
 */
export type HighlightLanguage = "bash" | "plain";

/** Azure CLI commands are Bash, so they get the same colours as the scripts. */
const BASH_SHELLS = new Set<Shell>(["azurecli", "bash"]);

export function highlightLanguageForShell(shell: Shell): HighlightLanguage {
  return BASH_SHELLS.has(shell) ? "bash" : "plain";
}

export function highlightLanguageForScript(language: ScriptLanguage): HighlightLanguage {
  return language === "bash" ? "bash" : "plain";
}
