import type { Metadata } from "next";

import { FavoritesView } from "@/components/favorites-view";
import { getLibraryCommands } from "@/lib/content/loader";
import { getScripts } from "@/lib/content/scripts-loader";

export const metadata: Metadata = { title: "Favoritos · Azure Commands" };

export default async function FavoritosPage() {
  const [commands, scripts] = await Promise.all([getLibraryCommands(), getScripts()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Favoritos</h1>
        <p className="text-muted-foreground">
          Los comandos y scripts que marcaste con la estrella, reunidos en un solo sitio.
          Se guardan en este navegador.
        </p>
      </div>
      <FavoritesView commands={commands} scripts={scripts} />
    </div>
  );
}
