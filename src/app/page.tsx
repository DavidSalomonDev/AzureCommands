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
import { NAV_ITEMS } from "@/lib/nav-items";
import { getLibraryCommands } from "@/lib/content/loader";
import type { Shell } from "@/lib/types";

const SHELL_BY_HREF: Partial<Record<string, Shell>> = {
  "/powershell": "powershell",
  "/cli": "azurecli",
};

export default async function Home() {
  const library = await getLibraryCommands();
  const countByShell = library.reduce<Partial<Record<Shell, number>>>((acc, c) => {
    acc[c.shell] = (acc[c.shell] ?? 0) + 1;
    return acc;
  }, {});

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
          Encuentra los comandos más usados de PowerShell y Azure CLI, completa sus
          parámetros y copia la línea lista para pegar en Cloud Shell o tu terminal.
          Guarda además tus propios comandos en “Mis comandos”.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {NAV_ITEMS.map((item) => {
          const shell = SHELL_BY_HREF[item.href];
          const count = shell ? countByShell[shell] ?? 0 : null;

          return (
            <Link key={item.href} href={item.href} className="group">
              <Card className="h-full transition-colors group-hover:ring-primary/40">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{item.label}</CardTitle>
                    {item.status === "soon" ? (
                      <Badge variant="outline">pronto</Badge>
                    ) : (
                      count !== null && (
                        <Badge variant="secondary">{count} comandos</Badge>
                      )
                    )}
                  </div>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Explorar
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
