import type { Shell } from "@/lib/types";

export type NavIcon =
  | "terminal"
  | "powershell"
  | "scripts"
  | "template"
  | "bookmark"
  | "star";

export interface NavItem {
  href: string;
  label: string;
  description: string;
  status: "available" | "soon";
  icon: NavIcon;
  /** Set for sections backed by the MDX command catalog. */
  shell?: Shell;
}

/**
 * Order matters: it drives the sidebar, the home grid and the docs. Azure CLI
 * goes first — it is the shell we recommend by default (multiplataforma, misma
 * sintaxis en Cloud Shell, Bash y Windows).
 */
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/cli",
    label: "Azure CLI",
    description: "Comandos az (recomendado)",
    status: "available",
    icon: "terminal",
    shell: "azurecli",
  },
  {
    href: "/scripts",
    label: "Scripts",
    description: "Scripts completos de varias líneas",
    status: "available",
    icon: "scripts",
  },
  {
    href: "/powershell",
    label: "PowerShell",
    description: "Comandos del módulo Az",
    status: "available",
    icon: "powershell",
    shell: "powershell",
  },
  {
    href: "/favoritos",
    label: "Favoritos",
    description: "Comandos y scripts marcados",
    status: "available",
    icon: "star",
  },
  {
    href: "/mis-comandos",
    label: "Mis comandos",
    description: "Tu biblioteca personal",
    status: "available",
    icon: "bookmark",
  },
  {
    href: "/arm",
    label: "ARM",
    description: "Plantillas ARM (JSON)",
    status: "soon",
    icon: "template",
  },
  {
    href: "/bicep",
    label: "Bicep",
    description: "Plantillas Bicep",
    status: "soon",
    icon: "template",
  },
  {
    href: "/terraform",
    label: "Terraform",
    description: "Plantillas Terraform",
    status: "soon",
    icon: "template",
  },
];
