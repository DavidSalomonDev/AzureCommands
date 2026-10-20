"use client";

import { useMemo, useState, type ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FavoriteButton } from "@/components/favorite-button";
import { MarkdownNotes } from "@/components/markdown-notes";
import { ParamInput } from "@/components/command/param-input";
import { CodeBlock } from "@/components/code/code-block";
import {
  OPERATION_BADGE_CLASSES,
  OPERATION_LABELS,
  resolveOperation,
} from "@/lib/operations";
import { SHELL_LABELS, type Command } from "@/lib/types";
import { cn } from "@/lib/utils";
import { highlightLanguageForShell } from "@/lib/highlight/language";
import { buildDefaultValues, renderTemplate } from "@/lib/params/template-engine";

interface CommandCardProps {
  command: Command;
  actions?: ReactNode;
  /**
   * The card is a preview of something not saved yet (the "Mis comandos"
   * form). It has no real id, so the star is hidden: marking it would leave a
   * favorite pointing at nothing.
   */
  preview?: boolean;
}

export function CommandCard({ command, actions, preview = false }: CommandCardProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    buildDefaultValues(command.parameters)
  );

  const operation = resolveOperation(command);
  const language = highlightLanguageForShell(command.shell);

  const renderedText = useMemo(
    () => renderTemplate(command.template, values, command.parameters),
    [command.template, values, command.parameters]
  );

  function handleChange(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  return (
    <Card>
      <CardHeader className="gap-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <CardTitle>{command.title}</CardTitle>
            <CardDescription>{command.description}</CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {!preview && <FavoriteButton id={command.id} title={command.title} />}
            {actions}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">{SHELL_LABELS[command.shell]}</Badge>
          <Badge variant="outline" className={cn(OPERATION_BADGE_CLASSES[operation])}>
            {OPERATION_LABELS[operation]}
          </Badge>
          <Badge variant="outline">{command.category}</Badge>
          {command.tags?.map((tag) => (
            <Badge key={tag} variant="outline" className="text-muted-foreground">
              #{tag}
            </Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {command.parameters.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {command.parameters.map((param) => (
              <ParamInput
                key={param.name}
                parameter={param}
                idPrefix={command.id}
                value={values[param.name] ?? ""}
                onChange={(v) => handleChange(param.name, v)}
              />
            ))}
          </div>
        )}
        <CodeBlock
          code={command.template}
          language={language}
          values={values}
          parameters={command.parameters}
          copy={{
            text: renderedText,
            label: "Copiar comando",
            successMessage: "Comando copiado al portapapeles",
          }}
        />
        {command.notesHtml ? (
          <MarkdownNotes html={command.notesHtml} />
        ) : (
          command.notes && (
            <p className="text-xs text-muted-foreground">{command.notes}</p>
          )
        )}
      </CardContent>
    </Card>
  );
}
