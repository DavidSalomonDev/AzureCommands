import { Suspense } from "react";
import type { Metadata } from "next";

import { CommandList } from "@/components/command/command-list";
import { getLibraryCommandsByShell } from "@/lib/content/loader";

export const metadata: Metadata = { title: "Linux en la VM · Azure Commands" };

export default async function LinuxPage() {
  const commands = await getLibraryCommandsByShell("bash");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Linux en la VM</h1>
        <p className="text-muted-foreground">
          Lo mínimo para orientarse cuando hay que entrar por SSH, Bastion o Serial
          Console a una VM Linux: discos, red, servicios y estado del sistema. No es un
          manual de Linux, solo los comandos de diagnóstico que de verdad se usan. Para
          administrar la VM desde fuera, usa <strong>Azure CLI</strong>.
        </p>
      </div>
      <Suspense fallback={null}>
        <CommandList commands={commands} basePath="/linux" />
      </Suspense>
    </div>
  );
}
