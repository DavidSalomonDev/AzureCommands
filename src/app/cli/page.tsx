import type { Metadata } from "next";

import { CommandList } from "@/components/command/command-list";
import { getLibraryCommandsByShell } from "@/lib/content/loader";

export const metadata: Metadata = { title: "Azure CLI · Azure Commands" };

export default async function CliPage() {
  const commands = await getLibraryCommandsByShell("azurecli");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Azure CLI</h1>
        <p className="text-muted-foreground">
          Comandos <code className="font-mono text-sm">az</code> en Bash para crear,
          modificar, eliminar y consultar recursos de Azure desde Cloud Shell o tu
          terminal local.
        </p>
      </div>
      <CommandList commands={commands} />
    </div>
  );
}
