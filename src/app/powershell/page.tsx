import { Suspense } from "react";
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
          Comandos del módulo Az, útiles cuando ya trabajas dentro de PowerShell o
          necesitas encadenar objetos. Si te da igual el shell, empieza por Azure CLI.
        </p>
      </div>
      <Suspense fallback={null}>
        <CommandList commands={commands} basePath="/powershell" />
      </Suspense>
    </div>
  );
}
