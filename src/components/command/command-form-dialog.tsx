"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CommandCard } from "@/components/command/command-card";
import { ParamEditorRow } from "@/components/command/param-editor-row";
import { extractPlaceholders } from "@/lib/params/template-engine";
import type { NewCommandInput } from "@/lib/repositories/types";
import { slugify } from "@/lib/slugify";
import {
  SHELL_LABELS,
  USER_SHELL_OPTIONS,
  type Command,
  type CommandParameter,
  type Shell,
} from "@/lib/types";

interface DraftState {
  title: string;
  description: string;
  category: string;
  shell: Shell;
  tagsText: string;
  template: string;
  notes: string;
  parameters: CommandParameter[];
}

function blankDraft(): DraftState {
  return {
    title: "",
    description: "",
    category: "",
    shell: "bash",
    tagsText: "",
    template: "",
    notes: "",
    parameters: [],
  };
}

function draftFromCommand(command: Command): DraftState {
  return {
    title: command.title,
    description: command.description,
    category: command.category,
    shell: command.shell,
    tagsText: (command.tags ?? []).join(", "),
    template: command.template,
    notes: command.notes ?? "",
    parameters: command.parameters,
  };
}

function syncParametersWithTemplate(
  template: string,
  existing: CommandParameter[]
): CommandParameter[] {
  return extractPlaceholders(template).map((name) => {
    const found = existing.find((p) => p.name === name);
    return found ?? { name, label: name, type: "string", required: false };
  });
}

interface CommandFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCommand?: Command | null;
  existingCategories: string[];
  onSubmit: (input: NewCommandInput) => void;
}

export function CommandFormDialog({
  open,
  onOpenChange,
  initialCommand,
  existingCategories,
  onSubmit,
}: CommandFormDialogProps) {
  const [draft, setDraft] = useState<DraftState>(blankDraft);

  useEffect(() => {
    if (open) {
      setDraft(initialCommand ? draftFromCommand(initialCommand) : blankDraft());
    }
  }, [open, initialCommand]);

  function handleTemplateChange(value: string) {
    setDraft((prev) => ({
      ...prev,
      template: value,
      parameters: syncParametersWithTemplate(value, prev.parameters),
    }));
  }

  function updateParameter(name: string, patch: Partial<CommandParameter>) {
    setDraft((prev) => ({
      ...prev,
      parameters: prev.parameters.map((p) => (p.name === name ? { ...p, ...patch } : p)),
    }));
  }

  const tagsArray = useMemo(
    () =>
      draft.tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    [draft.tagsText]
  );

  const previewCommand: Command = useMemo(
    () => ({
      id: initialCommand?.id ?? "preview",
      slug: slugify(draft.title || "vista-previa"),
      title: draft.title || "Título del comando",
      description: draft.description || "Descripción del comando",
      shell: draft.shell,
      category: draft.category || "Sin categoría",
      tags: tagsArray,
      template: draft.template || "echo <mensaje>",
      parameters: draft.parameters,
      notes: draft.notes || undefined,
      source: "user",
    }),
    [draft, initialCommand, tagsArray]
  );

  const previewKey = `${draft.template}::${draft.parameters
    .map((p) => `${p.name}:${p.default ?? ""}`)
    .join("|")}`;

  const canSubmit = draft.title.trim().length > 0 && draft.template.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit({
      title: draft.title.trim(),
      description: draft.description.trim(),
      category: draft.category.trim() || "General",
      shell: draft.shell,
      tags: tagsArray,
      template: draft.template.trim(),
      parameters: draft.parameters,
      notes: draft.notes.trim() || undefined,
      slug: slugify(draft.title),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full max-w-2xl overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initialCommand ? "Editar comando" : "Nuevo comando"}</DialogTitle>
          <DialogDescription>
            Usa <code className="font-mono">&lt;nombre&gt;</code> dentro del comando para crear
            parámetros automáticamente. Funciona con cualquier línea de Linux o Windows.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="cmd-title">Título</Label>
              <Input
                id="cmd-title"
                value={draft.title}
                onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Reiniciar el servicio nginx"
              />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="cmd-description">Descripción</Label>
              <Textarea
                id="cmd-description"
                value={draft.description}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Qué hace este comando y cuándo usarlo."
                className="min-h-16"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cmd-category">Categoría</Label>
              <Input
                id="cmd-category"
                list="user-command-categories"
                value={draft.category}
                onChange={(e) => setDraft((prev) => ({ ...prev, category: e.target.value }))}
                placeholder="Redes, servidores…"
              />
              <datalist id="user-command-categories">
                {existingCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cmd-shell">Tipo</Label>
              <Select
                value={draft.shell}
                onValueChange={(v) => setDraft((prev) => ({ ...prev, shell: v as Shell }))}
              >
                <SelectTrigger id="cmd-shell" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USER_SHELL_OPTIONS.map((shell) => (
                    <SelectItem key={shell} value={shell}>
                      {SHELL_LABELS[shell]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="cmd-tags">Etiquetas (separadas por coma)</Label>
              <Input
                id="cmd-tags"
                value={draft.tagsText}
                onChange={(e) => setDraft((prev) => ({ ...prev, tagsText: e.target.value }))}
                placeholder="backup, produccion"
              />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="cmd-template">Comando</Label>
              <Textarea
                id="cmd-template"
                value={draft.template}
                onChange={(e) => handleTemplateChange(e.target.value)}
                placeholder="systemctl restart <servicio>"
                className="min-h-20 font-mono text-sm"
              />
            </div>
          </div>

          {draft.parameters.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">Parámetros detectados</Label>
              <div className="flex flex-col gap-2">
                {draft.parameters.map((param) => (
                  <ParamEditorRow
                    key={param.name}
                    parameter={param}
                    onChange={(patch) => updateParameter(param.name, patch)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cmd-notes">Notas (opcional)</Label>
            <Textarea
              id="cmd-notes"
              value={draft.notes}
              onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Advertencias, enlaces, contexto adicional…"
              className="min-h-16"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground">Vista previa</Label>
            <CommandCard key={previewKey} command={previewCommand} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {initialCommand ? "Guardar cambios" : "Crear comando"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
