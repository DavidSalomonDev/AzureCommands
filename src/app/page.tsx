import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getNavSections } from "@/lib/content/nav-tree";

const ITEM_NOUN: Record<string, string> = {
  "/scripts": "scripts",
};

export default async function Home() {
  const sections = await getNavSections();

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <Badge variant="secondary" className="w-fit">
          Biblia de comandos de Azure
        </Badge>
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          Organiza, completa y copia tus comandos de Azure
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Empieza por <strong className="text-foreground">Azure CLI</strong>: los comandos{" "}
          <code className="font-mono text-sm">az</code> funcionan igual en Cloud Shell,
          Linux, macOS y Windows. Completa sus parámetros, copia la línea lista para
          pegar y, cuando una tarea necesite más de una línea, pásate a{" "}
          <strong className="text-foreground">Scripts</strong>. PowerShell sigue
          disponible para cuando prefieras el módulo Az.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <Link key={section.href} href={section.href} className="group">
            <Card className="h-full transition-colors group-hover:ring-primary/40">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{section.label}</CardTitle>
                  {section.status === "soon" ? (
                    <Badge variant="outline">pronto</Badge>
                  ) : (
                    section.count !== undefined && (
                      <Badge variant="secondary">
                        {section.count} {ITEM_NOUN[section.href] ?? "comandos"}
                      </Badge>
                    )
                  )}
                </div>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Explorar
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
