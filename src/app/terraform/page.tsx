import type { Metadata } from "next";

import { ComingSoon } from "@/components/command/coming-soon";

export const metadata: Metadata = { title: "Terraform · Azure Commands" };

export default function TerraformPage() {
  return (
    <ComingSoon
      title="Plantillas Terraform"
      description="Próximamente: módulos y bloques Terraform reutilizables para el proveedor de Azure, en la segunda fase del proyecto."
    />
  );
}
