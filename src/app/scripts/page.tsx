import { Suspense } from "react";
import type { Metadata } from "next";

import { ScriptList } from "@/components/script/script-list";
import { getScripts } from "@/lib/content/scripts-loader";

export const metadata: Metadata = { title: "Scripts · Azure Commands" };

export default async function ScriptsPage() {
  const scripts = await getScripts();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Scripts</h1>
        <p className="text-muted-foreground">
          Automatizaciones de varias líneas que no caben en un solo comando: respaldos
          masivos, snapshots de discos e inventarios. Cópialas o descárgalas como archivo
          y ejecútalas desde tu terminal.
        </p>
      </div>
      <Suspense fallback={null}>
        <ScriptList scripts={scripts} />
      </Suspense>
    </div>
  );
}
