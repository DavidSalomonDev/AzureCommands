"use client";

import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CommandParameter, ParamType } from "@/lib/types";

const TYPE_LABELS: Record<ParamType, string> = {
  string: "Texto",
  number: "Número",
  boolean: "Booleano",
  enum: "Lista (enum)",
};

interface ParamEditorRowProps {
  parameter: CommandParameter;
  onChange: (patch: Partial<CommandParameter>) => void;
}

export function ParamEditorRow({ parameter, onChange }: ParamEditorRowProps) {
  const [optionsText, setOptionsText] = useState((parameter.options ?? []).join(", "));

  function commitOptions() {
    onChange({
      options: optionsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <code className="font-mono text-xs text-muted-foreground">
          &lt;{parameter.name}&gt;
        </code>
        <div className="flex items-center gap-1.5">
          <Checkbox
            id={`required-${parameter.name}`}
            checked={parameter.required}
            onCheckedChange={(checked) => onChange({ required: checked === true })}
          />
          <Label htmlFor={`required-${parameter.name}`} className="text-xs font-normal">
            Obligatorio
          </Label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Etiqueta</Label>
          <Input
            value={parameter.label}
            onChange={(e) => onChange({ label: e.target.value })}
            className="h-8 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs">Tipo</Label>
          <Select
            value={parameter.type}
            onValueChange={(v) => onChange({ type: v as ParamType })}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TYPE_LABELS) as ParamType[]).map((type) => (
                <SelectItem key={type} value={type}>
                  {TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs">Valor por defecto</Label>
          <Input
            value={parameter.default ?? ""}
            onChange={(e) => onChange({ default: e.target.value })}
            className="h-8 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs">Placeholder / ejemplo</Label>
          <Input
            value={parameter.placeholder ?? ""}
            onChange={(e) => onChange({ placeholder: e.target.value })}
            className="h-8 text-sm"
          />
        </div>

        {parameter.type === "enum" && (
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label className="text-xs">Opciones (separadas por coma)</Label>
            <Input
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              onBlur={commitOptions}
              placeholder="table, json, tsv"
              className="h-8 text-sm"
            />
          </div>
        )}
      </div>
    </div>
  );
}
