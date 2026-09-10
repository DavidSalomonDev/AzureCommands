import { z } from "zod";

import { commandParameterSchema, crudOperationSchema } from "@/lib/schema";

export const scriptLanguageSchema = z.enum(["powershell", "bash"]);

/**
 * Frontmatter of the sidecar `.md` file that documents a script. It lives next
 * to the script itself and shares its basename:
 * `content/scripts/Backup-VMs.ps1` + `content/scripts/Backup-VMs.md`.
 *
 * The sidecar is optional: a script without one still shows up in the catalog
 * with a title derived from its file name.
 */
export const scriptFrontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  tags: z.array(z.string()).optional(),
  /** Overrides the language inferred from the file extension. */
  language: scriptLanguageSchema.optional(),
  /** Example invocation, e.g. `./Backup-VMs.ps1 -VMNames "vm1,vm2"`. */
  usage: z.string().optional(),
  requirements: z.array(z.string()).optional(),
  /** CRUD sub-category; "other" cuando no aplica. */
  operation: crudOperationSchema.default("other"),
  /**
   * Inputs shown above the code. Each `name` must match a `<token>` used in the
   * script body, exactly like the command templates.
   */
  parameters: z.array(commandParameterSchema).default([]),
  /** Optional explicit slug; defaults to the file name when omitted. */
  slug: z.string().optional(),
});

export type ScriptFrontmatter = z.infer<typeof scriptFrontmatterSchema>;
