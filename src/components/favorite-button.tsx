"use client";

import { Star } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useFavorites } from "@/lib/store/use-favorites";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  /** Command or script id. */
  id: string;
  /** Shown in the toast, e.g. "Listar máquinas virtuales". */
  title: string;
}

export function FavoriteButton({ id, title }: FavoriteButtonProps) {
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(id);

  function handleClick() {
    const added = toggle(id);
    toast.success(
      added ? `“${title}” añadido a favoritos` : `“${title}” quitado de favoritos`
    );
  }

  return (
    <Button
      variant="outline"
      size="icon-sm"
      onClick={handleClick}
      aria-pressed={active}
      aria-label={active ? "Quitar de favoritos" : "Añadir a favoritos"}
      title={active ? "Quitar de favoritos" : "Añadir a favoritos"}
    >
      <Star
        className={cn(
          active && "fill-amber-400 text-amber-500 dark:fill-amber-400/90 dark:text-amber-400"
        )}
      />
    </Button>
  );
}
