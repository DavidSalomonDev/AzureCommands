import type { Metadata } from "next";

import { CommandList } from "@/components/command/command-list";
import { getLibraryCommandsByShell } from "@/lib/content/loader";

export const metadata: Metadata = { title: "PowerShell · Azure Commands" };

export default async function PowerShellPage() {
  const commands = await getLibraryCommandsByShell("powershell");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">PowerShell</h1>
        <p className="text-muted-foreground">
          Comandos del módulo Az para crear, modificar, eliminar y consultar recursos de
          Azure desde Cloud Shell o tu terminal local.
        </p>
      </div>
      <CommandList commands={commands} />
    </div>
  );
}
