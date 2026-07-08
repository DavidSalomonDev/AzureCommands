"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Terminal } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { NAV_ITEMS } from "@/lib/nav-items";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 font-heading font-semibold">
            <Terminal className="size-5 text-primary" />
            <span>Azure Commands</span>
          </Link>
          <ThemeToggle />
        </div>

        <nav className="flex flex-wrap gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {item.label}
                {item.status === "soon" && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "px-1 py-0 text-[10px] leading-4",
                      active && "border-primary-foreground/40 text-primary-foreground"
                    )}
                  >
                    pronto
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
