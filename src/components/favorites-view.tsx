"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Star } from "lucide-react";

import { CommandCard } from "@/components/command/command-card";
import { ScriptCard } from "@/components/script/script-card";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/lib/store/use-favorites";
import { useUserCommands } from "@/lib/store/use-user-commands";
import type { Command, Script } from "@/lib/types";

interface FavoritesViewProps {
  /** Whole catalog, so favorites can be resolved by id on the client. */
  commands: Command[];
  scripts: Script[];
}

export function FavoritesView({ commands, scripts }: FavoritesViewProps) {
  const { ids, clear } = useFavorites();
  const { commands: userCommands, hydrated } = useUserCommands();

  const favoriteCommands = useMemo(() => {
    const all = [...commands, ...userCommands];
    // Keep the order in which they were marked.
    return ids
      .map((id) => all.find((c) => c.id === id))
      .filter((c): c is Command => Boolean(c));
  }, [commands, userCommands, ids]);

  const favoriteScripts = useMemo(
    () =>
      ids
        .map((id) => scripts.find((s) => s.id === id))
        .filter((s): s is Script => Boolean(s)),
    [scripts, ids]
  );

  const total = favoriteCommands.length + favoriteScripts.length;

  // `ids` is empty during the server render; wait for the user commands to
  // hydrate too so a favorite of "Mis comandos" doesn't flash as missing.
  if (!hydrated) return null;

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
