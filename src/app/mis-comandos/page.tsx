"use client";

import { useMemo, useState } from "react";
import { MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CommandFormDialog } from "@/components/command/command-form-dialog";
import { CommandList } from "@/components/command/command-list";
import { ImportExportMenu } from "@/components/command/import-export-menu";
import type { NewCommandInput } from "@/lib/repositories/types";
import { useUserCommands } from "@/lib/store/use-user-commands";
import type { Command } from "@/lib/types";

export default function MisComandosPage() {
  const { commands, hydrated, create, update, remove, exportAll, importAll } =
    useUserCommands();

  const [formOpen, setFormOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState<Command | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Command | null>(null);

  const existingCategories = useMemo(
    () => Array.from(new Set(commands.map((c) => c.category))).sort(),
    [commands]
  );

  function openCreate() {
    setEditingCommand(null);
    setFormOpen(true);
  }

  function openEdit(command: Command) {
    setEditingCommand(command);
    setFormOpen(true);
  }

  function handleSubmit(input: NewCommandInput) {
    if (editingCommand) {
      update(editingCommand.id, input);
    } else {
      create(input);
    }
    setFormOpen(false);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    remove(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Mis comandos</h1>
          <p className="text-muted-foreground">
            Guarda tus propios comandos de Linux o Windows, como marcadores. Se almacenan
            solo en este navegador.
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus /> Nuevo comando
        </Button>
      </div>

      {!hydrated ? null : commands.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-20 text-center">
          <p className="max-w-md text-sm text-muted-foreground">
            Aún no tienes comandos guardados. Crea el primero o importa un archivo
            exportado desde otro equipo.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={openCreate}>
              <Plus /> Crear mi primer comando
            </Button>
            <ImportExportMenu commandCount={0} exportAll={exportAll} importAll={importAll} />
          </div>
        </div>
      ) : (
        <>
          <ImportExportMenu
            commandCount={commands.length}
            exportAll={exportAll}
            importAll={importAll}
          />
          <CommandList
            commands={commands}
            renderActions={(cmd) => (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon-sm" aria-label="Más acciones" />
                  }
                >
                  <MoreVertical />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEdit(cmd)}>
                    <Pencil /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setDeleteTarget(cmd)}
                  >
                    <Trash2 /> Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          />
        </>
      )}

      <CommandFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initialCommand={editingCommand}
        existingCategories={existingCategories}
        onSubmit={handleSubmit}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar “{deleteTarget?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
