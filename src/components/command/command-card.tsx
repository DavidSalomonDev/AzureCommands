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
import { ParamInput } from "@/components/command/param-input";
import { CodeBlock } from "@/components/command/code-block";
import { SHELL_LABELS, type Command } from "@/lib/types";
import {
  buildDefaultValues,
  parseTemplateSegments,
  renderTemplate,
} from "@/lib/params/template-engine";

interface CommandCardProps {
  command: Command;
  actions?: ReactNode;
}

export function CommandCard({ command, actions }: CommandCardProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    buildDefaultValues(command.parameters)
  );

  const segments = useMemo(
    () => parseTemplateSegments(command.template),
    [command.template]
  );
  const renderedText = useMemo(
    () => renderTemplate(command.template, values),
    [command.template, values]
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
          {actions}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">{SHELL_LABELS[command.shell]}</Badge>
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {command.parameters.map((param) => (
              <ParamInput
                key={param.name}
                parameter={param}
                value={values[param.name] ?? ""}
                onChange={(v) => handleChange(param.name, v)}
              />
            ))}
          </div>
        )}
        <CodeBlock segments={segments} values={values} renderedText={renderedText} />
        {command.notesHtml ? (
          <div
            className="command-notes text-xs text-muted-foreground [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:mt-1 [&_p:first-child]:mt-0 [&_strong]:font-semibold [&_strong]:text-foreground"
            dangerouslySetInnerHTML={{ __html: command.notesHtml }}
          />
        ) : (
          command.notes && (
            <p className="text-xs text-muted-foreground">{command.notes}</p>
          )
        )}
      </CardContent>
    </Card>
  );
}
