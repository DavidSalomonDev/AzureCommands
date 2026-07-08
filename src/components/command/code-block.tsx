"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TemplateSegment } from "@/lib/params/template-engine";

interface CodeBlockProps {
  segments: TemplateSegment[];
  values: Record<string, string>;
  renderedText: string;
  className?: string;
}

export function CodeBlock({ segments, values, renderedText, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(renderedText);
      setCopied(true);
      toast.success("Comando copiado al portapapeles");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("No se pudo copiar. Copia el texto manualmente.");
    }
  }

  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-muted/40 dark:bg-muted/20",
        className
      )}
    >
      <pre className="overflow-x-auto p-3 pr-11 text-sm leading-relaxed">
        <code className="font-mono whitespace-pre">
          {segments.map((seg, i) => {
            if (seg.type === "text") return <span key={i}>{seg.value}</span>;
            const filled = (values[seg.value] ?? "").trim().length > 0;
            return (
              <span
                key={i}
                className={cn(
                  "rounded px-0.5",
                  filled
                    ? "text-primary font-medium"
                    : "text-amber-600 dark:text-amber-400 underline decoration-dashed decoration-amber-500/60 underline-offset-4"
                )}
                title={filled ? undefined : `Falta el parámetro: ${seg.value}`}
              >
                {filled ? values[seg.value] : `<${seg.value}>`}
              </span>
            );
          })}
        </code>
      </pre>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={handleCopy}
        className="absolute top-2 right-2"
        aria-label="Copiar comando"
      >
        {copied ? <Check className="text-emerald-500" /> : <Copy />}
      </Button>
    </div>
  );
}
