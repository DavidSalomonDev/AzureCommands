import { z } from "zod";

import { commandParameterSchema, shellSchema } from "@/lib/schema";

/**
 * Shape of the YAML frontmatter authored at the top of each command `.mdx`
 * file in `content/`. The markdown body (below the frontmatter) becomes the
 * command notes.
 */
export const frontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  shell: shellSchema,
  category: z.string().min(1),
  tags: z.array(z.string()).optional(),
  template: z.string().min(1),
  parameters: z.array(commandParameterSchema).default([]),
  /** Optional explicit slug; defaults to the filename when omitted. */
  slug: z.string().optional(),
});

export type Frontmatter = z.infer<typeof frontmatterSchema>;
