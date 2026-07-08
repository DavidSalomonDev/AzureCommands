import type { Metadata } from "next";

import { ComingSoon } from "@/components/command/coming-soon";

export const metadata: Metadata = { title: "Bicep · Azure Commands" };

export default function BicepPage() {
  return (
    <ComingSoon
      title="Plantillas Bicep"
      description="Próximamente: plantillas Bicep reutilizables con parámetros dinámicos, en la segunda fase del proyecto."
    />
  );
}
