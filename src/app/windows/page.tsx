import { Suspense } from "react";
import type { Metadata } from "next";

import { CommandList } from "@/components/command/command-list";
import { getLibraryCommandsByShell } from "@/lib/content/loader";

export const metadata: Metadata = { title: "Windows en la VM · Azure Commands" };

export default async function WindowsPage() {
  const commands = await getLibraryCommandsByShell("cmd");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Windows en la VM</h1>
        <p className="text-muted-foreground">
          Lo mínimo para orientarse cuando hay que entrar por RDP, Bastion o Serial
          Console a una VM Windows: KBs instalados, discos, red y eventos. Casi todo es
          PowerShell (marcado con <code className="font-mono text-sm">#powershell</code>);
          lo que funciona en <code className="font-mono text-sm">cmd.exe</code> lleva la
          etiqueta <code className="font-mono text-sm">#cmd</code>. Para administrar la VM
          desde fuera, usa <strong>Azure CLI</strong>.
        </p>
      </div>
      <Suspense fallback={null}>
        <CommandList commands={commands} basePath="/windows" />
      </Suspense>
    </div>
  );
}
