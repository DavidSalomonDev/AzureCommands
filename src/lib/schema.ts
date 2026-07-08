import { z } from "zod";

export const paramTypeSchema = z.enum(["string", "number", "boolean", "enum"]);

export const shellSchema = z.enum([
  "powershell",
  "azurecli",
  "arm",
  "bicep",
  "terraform",
  "bash",
  "cmd",
  "other",
]);

export const commandParameterSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  type: paramTypeSchema,
  required: z.boolean(),
  default: z.string().optional(),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
});

export const commandSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  shell: shellSchema,
  category: z.string().min(1),
  tags: z.array(z.string()).optional(),
  template: z.string().min(1),
  parameters: z.array(commandParameterSchema),
  notes: z.string().optional(),
  source: z.enum(["library", "user"]),
});

export const commandArraySchema = z.array(commandSchema);

export const exportBundleSchema = z.object({
  app: z.literal("azure-commands"),
  version: z.literal(1),
  exportedAt: z.string(),
  commands: commandArraySchema,
});
