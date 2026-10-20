// Server-only checks that the catalog honours the rules the README states for
// authors. They run while loading, so a mistake fails `next build` with the
// offending file named, exactly like an invalid frontmatter does.
import { extractPlaceholders } from "@/lib/params/template-engine";
import type { CommandParameter } from "@/lib/types";

/**
 * Every `<token>` in the code must have a declared parameter, and every
 * declared parameter must appear in the code.
 *
 * The first direction is what users feel: an undeclared token renders as a
 * placeholder nobody can fill, and copy/download emit it verbatim. The second
 * catches a renamed token leaving its parameter behind.
 */
export function assertParametersMatchTemplate(
  template: string,
  parameters: CommandParameter[],
  origin: string
): void {
  const used = extractPlaceholders(template);
  const declared = parameters.map((p) => p.name);

  const undeclared = used.filter((name) => !declared.includes(name));
  const unused = declared.filter((name) => !used.includes(name));

  const problems: string[] = [];
  if (undeclared.length > 0) {
    problems.push(
      `- Sin declarar en "parameters": ${undeclared.map((n) => `<${n}>`).join(", ")}.\n` +
        `  Si no son parámetros (por ejemplo dentro de un comentario), evita los signos < > ahí.`
    );
  }
  if (unused.length > 0) {
    problems.push(
      `- Declarados en "parameters" pero ausentes del código: ${unused.join(", ")}.`
    );
  }

  if (problems.length > 0) {
    throw new Error(`Parámetros inconsistentes en ${origin}:\n${problems.join("\n")}`);
  }
}

/**
 * Ids have to be unique: they key the React lists and identify a favorite in
 * localStorage, so a collision silently merges two entries. An id is built
 * from the slug, which defaults to the file name — two files with the same
 * name under the same shell collide.
 */
export function assertUniqueIds(items: { id: string }[], what: string): void {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) duplicates.add(item.id);
    seen.add(item.id);
  }

  if (duplicates.size > 0) {
    throw new Error(
      `${what}: id duplicado(s): ${[...duplicates].join(", ")}.\n` +
        `El id sale del nombre del archivo; renombra uno de ellos o fija un "slug" distinto en su frontmatter.`
    );
  }
}
