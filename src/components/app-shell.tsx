"use client";

import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import type { NavSection } from "@/lib/content/nav-tree";

interface SidebarState {
  /** Desktop: rail (icon-only) instead of the full sidebar. */
  collapsed: boolean;
  /** Mobile: off-canvas drawer visibility. */
  mobileOpen: boolean;
  toggle: () => void;
  closeMobile: () => void;
}

const SidebarContext = createContext<SidebarState | null>(null);

export function useSidebar(): SidebarState {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar debe usarse dentro de <AppShell>");
  return ctx;
}

const STORAGE_KEY = "azure-commands:sidebar-collapsed";
const DESKTOP_QUERY = "(min-width: 768px)";

// The collapsed preference lives in localStorage, so it is read through
// useSyncExternalStore: the server (and the first client render) always sees
// the expanded sidebar, and React re-renders once hydrated.
const listeners = new Set<() => void>();

function subscribeToPreference(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readPreference(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // localStorage puede estar bloqueado (modo privado, políticas del navegador).
    return false;
  }
}

function writePreference(collapsed: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    // Ignorado a propósito: la preferencia simplemente no persiste.
  }
  for (const listener of listeners) listener();
}

export function AppShell({
  sections,
  children,
}: {
  sections: NavSection[];
  children: React.ReactNode;
}) {
  const collapsed = useSyncExternalStore(
    subscribeToPreference,
    readPreference,
    () => false
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggle = useCallback(() => {
    if (window.matchMedia(DESKTOP_QUERY).matches) {
      writePreference(!readPreference());
    } else {
      setMobileOpen((prev) => !prev);
    }
  }, []);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  return (
    <SidebarContext.Provider value={{ collapsed, mobileOpen, toggle, closeMobile }}>
      <SiteHeader />
      <div className="flex flex-1">
        {/* useSearchParams() dentro del sidebar necesita un límite de Suspense. */}
        <Suspense fallback={<div className="hidden w-64 shrink-0 border-r md:block" />}>
          <AppSidebar sections={sections} />
        </Suspense>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-6">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </SidebarContext.Provider>
  );
}
