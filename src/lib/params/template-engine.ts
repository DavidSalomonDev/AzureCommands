import type { CommandParameter } from "@/lib/types";

export interface TemplateSegment {
  type: "text" | "token";
  value: string;
}

const TOKEN_REGEX = /<([^<>]+)>/g;

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
 */
export function renderTemplate(template: string, values: Record<string, string>): string {
  return parseTemplateSegments(template)
    .map((seg) => {
      if (seg.type === "text") return seg.value;
      const val = values[seg.value];
      return val && val.trim().length > 0 ? val : `<${seg.value}>`;
    })
    .join("");
}

/** True when every declared parameter (required or not) has a non-empty value. */
export function isTemplateFullyFilled(
  parameters: CommandParameter[],
  values: Record<string, string>
): boolean {
  return parameters
    .filter((p) => p.required)
    .every((p) => (values[p.name] ?? "").trim().length > 0);
}

/** Seeds a values map from each parameter's declared default. */
export function buildDefaultValues(parameters: CommandParameter[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const p of parameters) {
    if (p.default !== undefined) values[p.name] = p.default;
  }
  return values;
}

/**
 * Auto-detects <token> placeholders in a user-authored command and turns
 * them into plain string parameters (the "hybrid" model for "Mis comandos").
 */
export function autoDetectParameters(template: string): CommandParameter[] {
  return extractPlaceholders(template).map((name) => ({
    name,
    label: name,
    type: "string",
    required: false,
  }));
}
