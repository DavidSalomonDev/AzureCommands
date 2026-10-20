"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Star } from "lucide-react";

import { CommandCard } from "@/components/command/command-card";
import { ScriptCard } from "@/components/script/script-card";
import { Button } from "@/components/ui/button";
import { useFavoriteCatalog } from "@/lib/store/use-favorite-catalog";
import { useFavorites } from "@/lib/store/use-favorites";
import { useUserCommands } from "@/lib/store/use-user-commands";
import type { Command, Script } from "@/lib/types";

/**
 * Favorites are ids in localStorage, so the catalog behind them is fetched in
 * the browser (see `useFavoriteCatalog`) rather than shipped with the page:
 * marking three commands should not cost a download of all of them.
 */
export function FavoritesView() {
  const { ids, clear } = useFavorites();
  const { commands: userCommands, hydrated } = useUserCommands();
  const { commands, scripts, ready, failed } = useFavoriteCatalog(ids);

  const { favoriteCommands, favoriteScripts } = useMemo(() => {
    const byId = new Map<string, Command | Script>();
    for (const command of commands) byId.set(command.id, command);
    for (const command of userCommands) byId.set(command.id, command);
    for (const script of scripts) byId.set(script.id, script);

    const favoriteCommands: Command[] = [];
    const favoriteScripts: Script[] = [];
    // Keep the order in which they were marked.
    for (const id of ids) {
      const item = byId.get(id);
      if (!item) continue;
      if ("template" in item) favoriteCommands.push(item);
      else favoriteScripts.push(item);
    }
    return { favoriteCommands, favoriteScripts };
  }, [commands, scripts, userCommands, ids]);

  const total = favoriteCommands.length + favoriteScripts.length;

  // `ids` is empty during the server render; wait for the user commands to
  // hydrate too so a favorite of "Mis comandos" doesn't flash as missing.
  if (!hydrated) return null;

  if (failed) {
    return (
      <p className="text-sm text-muted-foreground">
        No se pudo cargar el catálogo de comandos. Comprueba tu conexión y vuelve a
        cargar la página.
      </p>
    );
  }

  if (!ready) {
    return <p className="text-sm text-muted-foreground">Cargando tus favoritos…</p>;
  }

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-20 text-center">
        <Star className="size-8 text-muted-foreground" />
        <p className="max-w-md text-sm text-muted-foreground">
          Aún no tienes favoritos. Pulsa la estrella de cualquier comando o script para
          tenerlo siempre a mano aquí.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link href="/cli">
            <Button variant="outline">Ver comandos de Azure CLI</Button>
          </Link>
          <Link href="/scripts">
            <Button variant="outline">Ver scripts</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {total} {total === 1 ? "elemento guardado" : "elementos guardados"} en este
          navegador.
        </p>
        <Button variant="ghost" size="sm" onClick={clear}>
          Vaciar favoritos
        </Button>
      </div>

      {favoriteCommands.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Comandos
          </h2>
          {favoriteCommands.map((command) => (
            <CommandCard key={command.id} command={command} />
          ))}
        </section>
      )}

      {favoriteScripts.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Scripts
          </h2>
          {favoriteScripts.map((script) => (
            <ScriptCard key={script.id} script={script} />
          ))}
        </section>
      )}
    </div>
  );
}
