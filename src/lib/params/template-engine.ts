import type { CommandParameter } from "@/lib/types";

export interface TemplateSegment {
  type: "text" | "token";
  value: string;
}

/**
 * A placeholder name is an identifier: no spaces, quotes or line breaks. The
 * stricter shape keeps bash redirections and process substitutions
 * (`< <(az vm list ...)`, heredocs) from being read as tokens.
 */
export const PLACEHOLDER_PATTERN = "<([A-Za-z_][A-Za-z0-9_.-]*)>";

const TOKEN_REGEX = new RegExp(PLACEHOLDER_PATTERN, "g");

/** Splits a template into literal text and <token> segments, in order. */
export function parseTemplateSegments(template: string): TemplateSegment[] {
  const segments: TemplateSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const regex = new RegExp(TOKEN_REGEX);
  while ((match = regex.exec(template)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: template.slice(lastIndex, match.index) });
    }
    segments.push({ type: "token", value: match[1].trim() });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < template.length) {
    segments.push({ type: "text", value: template.slice(lastIndex) });
  }
  return segments;
}

/** Returns the unique token names found in a template, in first-appearance order. */
export function extractPlaceholders(template: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const seg of parseTemplateSegments(template)) {
    if (seg.type === "token" && !seen.has(seg.value)) {
      seen.add(seg.value);
      result.push(seg.value);
    }
  }
  return result;
}

/**
 * Renders the template substituting known values. Unfilled tokens are kept
 * as `<token>` so the user can see what's still missing.
 *
 * Optional parameters are the exception: leaving one blank is a choice, not an
 * omission, so they render as an empty string. Otherwise the literal `<token>`
 * leaks into the script and a branch like `if [ -n "$VM_NAMES" ]` reads it as
 * a real value. Pass `parameters` to get that behaviour.
 */
export function renderTemplate(
  template: string,
  values: Record<string, string>,
  parameters: CommandParameter[] = []
): string {
  const optional = new Set(parameters.filter((p) => !p.required).map((p) => p.name));

  return parseTemplateSegments(template)
    .map((seg) => {
      if (seg.type === "text") return seg.value;
      const val = values[seg.value];
      if (val && val.trim().length > 0) return val;
      return optional.has(seg.value) ? "" : `<${seg.value}>`;
    })
    .join("");
}

/** Seeds a values map from each parameter's declared default. */
export function buildDefaultValues(parameters: CommandParameter[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const p of parameters) {
    if (p.default !== undefined) values[p.name] = p.default;
  }
  return values;
}
