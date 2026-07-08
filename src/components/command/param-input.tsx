"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CommandParameter } from "@/lib/types";

interface ParamInputProps {
  parameter: CommandParameter;
  value: string;
  onChange: (value: string) => void;
}

export function ParamInput({ parameter, value, onChange }: ParamInputProps) {
  const inputId = `param-${parameter.name}`;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={inputId} className="text-xs font-medium">
        {parameter.label}
        {parameter.required && <span className="text-destructive"> *</span>}
      </Label>

      {parameter.type === "enum" ? (
        <Select value={value || undefined} onValueChange={(v) => onChange(String(v))}>
          <SelectTrigger id={inputId} size="sm" className="w-full">
            <SelectValue placeholder={parameter.placeholder ?? "Selecciona…"} />
          </SelectTrigger>
          <SelectContent>
            {parameter.options?.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : parameter.type === "boolean" ? (
        <Select value={value || "false"} onValueChange={(v) => onChange(String(v))}>
          <SelectTrigger id={inputId} size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">true</SelectItem>
            <SelectItem value="false">false</SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={inputId}
          type={parameter.type === "number" ? "number" : "text"}
          value={value}
          placeholder={parameter.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-sm"
        />
      )}

      {parameter.description && (
        <p className="text-xs text-muted-foreground">{parameter.description}</p>
      )}
    </div>
  );
}
