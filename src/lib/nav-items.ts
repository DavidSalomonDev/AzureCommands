export interface NavItem {
  href: string;
  label: string;
  description: string;
  status: "available" | "soon";
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/powershell",
    label: "PowerShell",
    description: "Comandos Az PowerShell",
    status: "available",
  },
  {
    href: "/cli",
    label: "Azure CLI",
    description: "Comandos az (Bash)",
    status: "available",
  },
  {
    href: "/arm",
    label: "ARM",
    description: "Plantillas ARM (JSON)",
    status: "soon",
  },
  {
    href: "/bicep",
    label: "Bicep",
    description: "Plantillas Bicep",
    status: "soon",
  },
  {
    href: "/terraform",
    label: "Terraform",
    description: "Plantillas Terraform",
    status: "soon",
  },
  {
    href: "/mis-comandos",
    label: "Mis comandos",
    description: "Tu biblioteca personal",
    status: "available",
  },
];
