"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Bookmark,
  FileCode2,
  Layers,
  SquareTerminal,
  Star,
  Terminal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useSidebar } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { NavSection } from "@/lib/content/nav-tree";
import type { NavIcon } from "@/lib/nav-items";
import { OPERATION_LABELS } from "@/lib/operations";
import { useFavorites } from "@/lib/store/use-favorites";
import { cn } from "@/lib/utils";

const ICONS: Record<NavIcon, LucideIcon> = {
  terminal: Terminal,
  powershell: SquareTerminal,
  scripts: FileCode2,
  template: Layers,
  bookmark: Bookmark,
  star: Star,
};

export const CATEGORY_PARAM = "cat";
export const OPERATION_PARAM = "op";

export function AppSidebar({ sections }: { sections: NavSection[] }) {
  const { collapsed, mobileOpen, closeMobile } = useSidebar();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get(CATEGORY_PARAM);
  const activeOperation = searchParams.get(OPERATION_PARAM);
  const { count: favoriteCount } = useFavorites();

  return (
    <>
      {/* Velo del cajón en móvil */}
      <div
        onClick={closeMobile}
        aria-hidden
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      <aside
        aria-label="Secciones y categorías"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-[transform,width] duration-200 ease-out",
          "md:sticky md:top-(--header-h) md:z-30 md:h-[calc(100dvh-var(--header-h))] md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed && "md:w-14"
        )}
      >
        <nav className="flex flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto p-2">
          {sections.map((section) => {
            const Icon = ICONS[section.icon];
            const active =
              pathname === section.href || pathname.startsWith(`${section.href}/`);
            const soon = section.status === "soon";
            const count =
              section.href === "/favoritos" ? favoriteCount : section.count;

            const link = (
              <Link
                href={section.href}
                onClick={closeMobile}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                  collapsed && "md:justify-center md:px-0",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className={cn("flex-1 truncate", collapsed && "md:hidden")}>
                  {section.label}
                </span>
                {soon ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "px-1 py-0 text-[10px] leading-4",
                      collapsed && "md:hidden",
                      active &&
                        "border-sidebar-primary-foreground/40 text-sidebar-primary-foreground"
                    )}
                  >
                    pronto
                  </Badge>
                ) : (
                  count !== undefined && (
                    <span
                      className={cn(
                        "text-xs tabular-nums opacity-70",
                        collapsed && "md:hidden"
                      )}
                    >
                      {count}
                    </span>
                  )
                )}
              </Link>
            );

            return (
              <div key={section.href} className="flex flex-col">
                {collapsed ? (
                  <Tooltip>
                    <TooltipTrigger render={link} />
                    <TooltipContent side="right">{section.label}</TooltipContent>
                  </Tooltip>
                ) : (
                  link
                )}

                {/* Productos de la sección abierta, con sus operaciones CRUD */}
                {active && section.categories.length > 0 && (
                  <ul className={cn("mt-1 mb-2 flex flex-col", collapsed && "md:hidden")}>
                    <CategoryLink
                      href={section.href}
                      label="Todas"
                      count={section.count ?? 0}
                      active={!activeCategory}
                      onNavigate={closeMobile}
                    />
                    {section.categories.map((category) => {
                      const categoryHref = `${section.href}?${CATEGORY_PARAM}=${encodeURIComponent(category.name)}`;
                      const categoryActive = activeCategory === category.name;

                      return (
                        <li key={category.name}>
                          <CategoryLink
                            href={categoryHref}
                            label={category.name}
                            count={category.count}
                            active={categoryActive && !activeOperation}
                            onNavigate={closeMobile}
                            asItem={false}
                          />

                          {categoryActive && (
                            <ul className="flex flex-col">
                              {category.operations.map(({ operation, count: opCount }) => (
                                <li key={operation}>
                                  <Link
                                    href={`${categoryHref}&${OPERATION_PARAM}=${operation}`}
                                    onClick={closeMobile}
                                    aria-current={
                                      activeOperation === operation ? "true" : undefined
                                    }
                                    className={cn(
                                      "ml-8 flex items-center gap-2 border-l py-1 pr-2 pl-3 text-xs transition-colors",
                                      activeOperation === operation
                                        ? "border-primary font-medium text-foreground"
                                        : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                                    )}
                                  >
                                    <span className="flex-1 truncate">
                                      {OPERATION_LABELS[operation]}
                                    </span>
                                    <span className="tabular-nums opacity-70">
                                      {opCount}
                                    </span>
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

function CategoryLink({
  href,
  label,
  count,
  active,
  onNavigate,
  asItem = true,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
  onNavigate: () => void;
  /** False when the caller already renders the surrounding <li>. */
  asItem?: boolean;
}) {
  const link = (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "true" : undefined}
      className={cn(
        "ml-4 flex items-center gap-2 border-l py-1.5 pr-2 pl-3 text-sm transition-colors",
        active
          ? "border-primary font-medium text-foreground"
          : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
      )}
    >
      <span className="flex-1 truncate">{label}</span>
      <span className="text-xs tabular-nums opacity-70">{count}</span>
    </Link>
  );

  return asItem ? <li>{link}</li> : link;
}
