import { Suspense } from "react";
import type { Metadata } from "next";

import { CommandList } from "@/components/command/command-list";
import { getLibraryCommandsByShell } from "@/lib/content/loader";

export const metadata: Metadata = { title: "ARM · Azure Commands" };

export default async function ArmPage() {
  const commands = await getLibraryCommandsByShell("arm");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Plantillas ARM</h1>
        <p className="text-muted-foreground">
          Plantillas ARM (JSON) de los recursos que más se crean. Rellena los parámetros,
          copia el JSON a un archivo y despliégalo con{" "}
          <code className="font-mono text-sm">az deployment group create</code>. Lo que
          escribas aquí llega como <code className="font-mono text-sm">defaultValue</code>{" "}
          de cada parámetro, así que la plantilla sigue siendo reutilizable y se puede
          sobrescribir al desplegar.
        </p>
      </div>
      <Suspense fallback={null}>
        <CommandList commands={commands} basePath="/arm" />
      </Suspense>
    </div>
  );
}
