import type { Metadata } from "next";

import { ComingSoon } from "@/components/command/coming-soon";

export const metadata: Metadata = { title: "ARM · Azure Commands" };

export default function ArmPage() {
  return (
    <ComingSoon
      title="Plantillas ARM"
      description="Próximamente: plantillas ARM (JSON) reutilizables con parámetros dinámicos, en la segunda fase del proyecto."
    />
  );
}
