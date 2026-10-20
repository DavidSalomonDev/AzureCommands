"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { CodeView } from "@/components/code/code-view";
import { Button } from "@/components/ui/button";
import type { HighlightLanguage } from "@/lib/highlight/language";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  /** Código con los `<token>` sin sustituir: así se puede colorear. */
  code: string;
  language: HighlightLanguage;
  values: Record<string, string>;
  /** Con esto se muestra el botón de copiar; `text` ya va sustituido. */
  copy?: { text: string; label: string; successMessage: string };
  /** Debajo del código, dentro del marco (p. ej. "ver script completo"). */
  footer?: ReactNode;
  className?: string;
  codeClassName?: string;
}

/**
 * El bloque de código de las tarjetas: marco, resaltado de sintaxis, los
 * parámetros resueltos en vivo y, si se pide, el botón de copiar.
 */
export function CodeBlock({
  code,
  language,
  values,
  copy,
  footer,
  className,
  codeClassName,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!copy) return;
    try {
      await navigator.clipboard.writeText(copy.text);
      setCopied(true);
      toast.success(copy.successMessage);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("No se pudo copiar. Copia el texto manualmente.");
    }
  }

  return (
    <div
      className={cn(
        "relative rounded-lg border bg-muted/40 dark:bg-muted/20",
        className
      )}
    >
      <pre
        className={cn(
          "overflow-x-auto p-3 text-sm leading-relaxed",
          copy && "pr-11",
          codeClassName
        )}
      >
        <CodeView code={code} language={language} values={values} />
      </pre>

      {copy && (
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={handleCopy}
          className="absolute top-2 right-2"
          aria-label={copy.label}
        >
          {copied ? <Check className="text-emerald-500" /> : <Copy />}
        </Button>
      )}

      {footer}
    </div>
  );
}
