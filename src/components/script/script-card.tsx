"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Copy, Download } from "lucide-react";
import { toast } from "sonner";

import { FavoriteButton } from "@/components/favorite-button";
import { MarkdownNotes } from "@/components/markdown-notes";
import { CodeBlock } from "@/components/code/code-block";
import { CodeView } from "@/components/code/code-view";
import { ParamInput } from "@/components/command/param-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { downloadFile } from "@/lib/download";
import { highlightLanguageForScript } from "@/lib/highlight/language";
import { buildDefaultValues, renderTemplate } from "@/lib/params/template-engine";
import {
  OPERATION_BADGE_CLASSES,
  OPERATION_LABELS,
  resolveScriptOperation,
} from "@/lib/operations";
import { SCRIPT_LANGUAGE_LABELS, type Script } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Renders `backticked` fragments of a plain string as inline code. */
function InlineCode({ text }: { text: string }) {
  return (
    <>
      {text.split(/`([^`]+)`/).map((part, index) =>
        index % 2 === 1 ? (
          <code key={index} className="rounded bg-muted px-1 py-0.5 font-mono">
            {part}
          </code>
        ) : (
          part
        )
      )}
    </>
  );
}

/** Lines shown before the script is expanded. */
const PREVIEW_LINES = 18;

export function ScriptCard({ script }: { script: Script }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() =>
    buildDefaultValues(script.parameters)
  );

  const operation = resolveScriptOperation(script);
  const language = highlightLanguageForScript(script.language);
  const lines = useMemo(() => script.code.split("\n"), [script.code]);
  const truncated = lines.length > PREVIEW_LINES;

  // The preview is truncated on the template so the <token> highlighting still
  // works; copy and download always use the full, substituted script.
  const visibleCode = useMemo(
    () =>
      expanded || !truncated ? script.code : lines.slice(0, PREVIEW_LINES).join("\n"),
    [script.code, lines, expanded, truncated]
  );

  const renderedCode = useMemo(
    () => renderTemplate(script.code, values, script.parameters),
    [script.code, values, script.parameters]
  );

  function handleChange(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(renderedCode);
      setCopied(true);
      toast.success("Script copiado al portapapeles");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("No se pudo copiar. Descarga el archivo en su lugar.");
    }
  }

  function handleDownload() {
    downloadFile(renderedCode + "\n", script.fileName, "text/plain;charset=utf-8");
  }

  return (
    <Card>
      <CardHeader className="gap-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <CardTitle>{script.title}</CardTitle>
            <CardDescription>{script.description}</CardDescription>
          </div>
          <div className="flex shrink-0 gap-1">
            <FavoriteButton id={script.id} title={script.title} />
            <Button
              variant="outline"
              size="icon-sm"
              onClick={handleCopy}
              aria-label="Copiar script"
            >
              {copied ? <Check className="text-emerald-500" /> : <Copy />}
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={handleDownload}
              aria-label={"Descargar " + script.fileName}
            >
              <Download />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">{SCRIPT_LANGUAGE_LABELS[script.language]}</Badge>
          <Badge variant="outline" className={cn(OPERATION_BADGE_CLASSES[operation])}>
            {OPERATION_LABELS[operation]}
          </Badge>
          <Badge variant="outline">{script.category}</Badge>
          <Badge variant="outline" className="font-mono text-muted-foreground">
            {script.fileName}
          </Badge>
          {script.tags?.map((tag) => (
            <Badge key={tag} variant="outline" className="text-muted-foreground">
              #{tag}
            </Badge>
          ))}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {script.parameters.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {script.parameters.map((param) => (
              <ParamInput
                key={param.name}
                parameter={param}
                idPrefix={script.id}
                value={values[param.name] ?? ""}
                onChange={(v) => handleChange(param.name, v)}
              />
            ))}
          </div>
        )}

        {script.usage && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Uso
            </span>
            <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-2.5 text-sm dark:bg-muted/20">
              <CodeView
                code={script.usage}
                language={language}
                values={values}
                parameters={script.parameters}
              />
            </pre>
          </div>
        )}

        {script.requirements && script.requirements.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Requisitos
            </span>
            <ul className="list-disc pl-4 text-xs text-muted-foreground">
              {script.requirements.map((req) => (
                <li key={req}>
                  <InlineCode text={req} />
                </li>
              ))}
            </ul>
          </div>
        )}

        <CodeBlock
          code={visibleCode}
          language={language}
          values={values}
          parameters={script.parameters}
          codeClassName="text-xs"
          footer={
            truncated && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded((prev) => !prev)}
              className="w-full rounded-t-none border-t"
            >
              {expanded ? (
                <>
                  <ChevronUp /> Ver menos
                </>
              ) : (
                <>
                  <ChevronDown /> Ver script completo ({lines.length} líneas)
                </>
              )}
              </Button>
            )
          }
        />

        {script.notesHtml && <MarkdownNotes html={script.notesHtml} />}
      </CardContent>
    </Card>
  );
}
