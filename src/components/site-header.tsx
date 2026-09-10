"use client";

import Link from "next/link";
import { Menu, PanelLeftClose, PanelLeftOpen, Terminal } from "lucide-react";

import { useSidebar } from "@/components/app-shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { collapsed, mobileOpen, toggle } = useSidebar();

  return (
    <header className="sticky top-0 z-40 h-(--header-h) border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="flex h-full items-center gap-2 px-3 md:px-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label={
            mobileOpen || !collapsed ? "Ocultar menú lateral" : "Mostrar menú lateral"
          }
          aria-expanded={mobileOpen || !collapsed}
        >
          <Menu className="md:hidden" />
          {collapsed ? (
            <PanelLeftOpen className="hidden md:block" />
          ) : (
            <PanelLeftClose className="hidden md:block" />
          )}
        </Button>

        <Link href="/" className="flex items-center gap-2 font-heading font-semibold">
          <Terminal className="size-5 text-primary" />
          <span>Azure Commands</span>
        </Link>

        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
