"use client";

import { useMemo } from "react";

import { tokenizeBash, type CodeToken, type CodeTokenType } from "@/lib/highlight/bash";
import type { HighlightLanguage } from "@/lib/highlight/language";
import { parseTemplateSegments } from "@/lib/params/template-engine";
import { cn } from "@/lib/utils";

/** Clase CSS por tipo de token; las de `globals.css` bajo `.code-hl`. */
const TOKEN_CLASSES: Partial<Record<CodeTokenType, string>> = {
  comment: "tok-comment",
  string: "tok-string",
  variable: "tok-variable",
  keyword: "tok-keyword",
  builtin: "tok-builtin",
  command: "tok-command",
  function: "tok-function",
  number: "tok-number",
  flag: "tok-flag",
  operator: "tok-operator",
};

/** Sin resaltador para el lenguaje: sólo texto y placeholders. */
function tokenizePlain(code: string): CodeToken[] {
  return parseTemplateSegments(code).map((segment) => ({
    type: segment.type === "token" ? "param" : "plain",
    value: segment.value,
  }));
}

interface CodeViewProps {
  /** Código con los <token> de parámetro sin sustituir. */
  code: string;
  language: HighlightLanguage;
  values: Record<string, string>;
  className?: string;
}

/**
 * Pinta el código con color por tipo de token y resuelve los placeholders
 * con los valores escritos en el formulario. Los que siguen vacíos se marcan
 * en ámbar para que se vea lo que falta.
 */
export function CodeView({ code, language, values, className }: CodeViewProps) {
  const tokens = useMemo(
    () => (language === "bash" ? tokenizeBash(code) : tokenizePlain(code)),
    [code, language]
  );

  return (
    <code className={cn("code-hl font-mono whitespace-pre", className)}>
      {tokens.map((token, index) => {
        if (token.type === "param") {
          const filled = (values[token.value] ?? "").trim().length > 0;
          return (
            <span
              key={index}
              className={cn(
                "rounded px-0.5",
                filled
                  ? "text-primary font-medium"
                  : "text-amber-600 underline decoration-dashed decoration-amber-500/60 underline-offset-4 dark:text-amber-400"
              )}
              title={filled ? undefined : `Falta el parámetro: ${token.value}`}
            >
              {filled ? values[token.value] : `<${token.value}>`}
            </span>
          );
        }

        return (
          <span key={index} className={TOKEN_CLASSES[token.type]}>
            {token.value}
          </span>
        );
      })}
    </code>
  );
}
