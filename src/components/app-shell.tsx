"use client";

import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
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
  /** Set on the <aside> so the shell can trap focus inside the open drawer. */
  drawerRef: RefObject<HTMLElement | null>;
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
  const drawerRef = useRef<HTMLElement | null>(null);

  const toggle = useCallback(() => {
    if (window.matchMedia(DESKTOP_QUERY).matches) {
      writePreference(!readPreference());
    } else {
      setMobileOpen((prev) => !prev);
    }
  }, []);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // Con el cajón abierto: Escape lo cierra, el Tab se queda dentro y la
  // página de detrás no hace scroll.
  useEffect(() => {
    if (!mobileOpen) return;

    const drawer = drawerRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    function focusables(): HTMLElement[] {
      if (!drawer) return [];
      return Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const items = focusables();
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !drawer?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    focusables()[0]?.focus();
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus();
    };
  }, [mobileOpen]);

  return (
    <SidebarContext.Provider
      value={{ collapsed, mobileOpen, toggle, closeMobile, drawerRef }}
    >
      <SiteHeader />
      <div className="flex flex-1">
        {/* useSearchParams() dentro del sidebar necesita un límite de Suspense. */}
        <Suspense fallback={<div className="hidden w-64 shrink-0 border-r md:block" />}>
          <AppSidebar sections={sections} />
        </Suspense>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-6">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </SidebarContext.Provider>
  );
}
