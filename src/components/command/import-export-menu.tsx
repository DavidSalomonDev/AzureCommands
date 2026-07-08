"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ExportBundle, ImportMode, ImportResult } from "@/lib/repositories/types";

interface ImportExportMenuProps {
  commandCount: number;
  exportAll: () => ExportBundle;
  importAll: (bundle: unknown, mode: ImportMode) => ImportResult;
}

function countIncoming(payload: unknown): number {
  if (Array.isArray(payload)) return payload.length;
  if (
    payload &&
    typeof payload === "object" &&
    "commands" in payload &&
    Array.isArray((payload as { commands: unknown }).commands)
  ) {
    return (payload as { commands: unknown[] }).commands.length;
  }
  return 0;
}

export function ImportExportMenu({ commandCount, exportAll, importAll }: ImportExportMenuProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modeRef = useRef<ImportMode>("merge");
  const [pendingReplace, setPendingReplace] = useState<{ data: unknown; count: number } | null>(
    null
  );

  function notifyResult(result: ImportResult) {
    if (result.imported > 0) {
      toast.success(`Se importaron ${result.imported} comando(s).`);
    }
    for (const error of result.errors) {
      toast.error(error);
    }
  }

  function handleExport() {
    const bundle = exportAll();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `azure-commands-mis-comandos-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Se exportaron ${bundle.commands.length} comando(s).`);
  }

  function triggerImport(mode: ImportMode) {
    modeRef.current = mode;
    fileInputRef.current?.click();
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (modeRef.current === "replace") {
        setPendingReplace({ data, count: countIncoming(data) });
        return;
      }

      notifyResult(importAll(data, "merge"));
    } catch {
      toast.error("El archivo no es un JSON válido.");
    }
  }

  function confirmReplace() {
    if (!pendingReplace) return;
    notifyResult(importAll(pendingReplace.data, "replace"));
    setPendingReplace(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleExport} disabled={commandCount === 0}>
        <Download /> Exportar
      </Button>
      <Button variant="outline" size="sm" onClick={() => triggerImport("merge")}>
        <Upload /> Importar
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => triggerImport("replace")}
      >
        Reemplazar todo desde archivo
      </Button>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleFileChange}
      />

      <AlertDialog
        open={pendingReplace !== null}
        onOpenChange={(next) => !next && setPendingReplace(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reemplazar todos tus comandos?</AlertDialogTitle>
            <AlertDialogDescription>
              Esto eliminará tus {commandCount} comando(s) actuales y los sustituirá por los{" "}
              {pendingReplace?.count ?? 0} comando(s) del archivo. Esta acción no se puede
              deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmReplace}>
              Reemplazar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
