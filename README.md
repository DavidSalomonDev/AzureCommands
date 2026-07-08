# Azure Commands · Biblia de comandos de Azure

Organizador web de comandos para administrar Azure. Reúne los comandos más usados de
**PowerShell** y **Azure CLI**, permite completar sus parámetros con inputs dinámicos y
copiar la línea lista para pegar en Cloud Shell o en tu terminal. Además puedes guardar
tus propios comandos en **Mis comandos**, con exportación e importación para llevártelos
entre equipos.

## Características

- **Catálogo curado** de comandos de PowerShell (módulo `Az`) y Azure CLI (`az`),
  organizados por producto de Azure (VMs, Redes, Almacenamiento, AKS, Key Vault,
  Application Gateway, Load Balancer, Front Door, Recovery Services Vault, etc.).
- **Parámetros dinámicos:** cada comando expone inputs por cada `<token>` de su plantilla;
  al escribir, la sustitución se refleja en vivo en el bloque de código.
- **Copiar al portapapeles** con un clic en cada bloque de código.
- **Filtro por categoría** (dropdown) y búsqueda por título, descripción, categoría o
  etiqueta en cada sección.
- **Mis comandos:** guarda tus propias líneas (Linux o Windows) en `localStorage`, con
  autodetección de parámetros `<token>`, y **exporta/importa** en JSON para migrar entre
  equipos.
- **Tema claro/oscuro** y UI accesible con Tailwind CSS + shadcn/ui.

## Secciones

| Sección        | Estado        | Contenido                                             |
| -------------- | ------------- | ----------------------------------------------------- |
| PowerShell     | Disponible    | Comandos del módulo `Az`                               |
| Azure CLI      | Disponible    | Comandos `az` en Bash                                  |
| ARM            | Próximamente  | Plantillas ARM                                        |
| Bicep          | Próximamente  | Plantillas Bicep                                      |
| Terraform      | Próximamente  | Configuraciones Terraform                             |
| Mis comandos   | Disponible    | Comandos propios del usuario (localStorage)           |

## Requisitos

- Node.js 18.18+ (recomendado 20+)
- npm

## Puesta en marcha

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

### Scripts

| Script          | Descripción                              |
| --------------- | ---------------------------------------- |
| `npm run dev`   | Servidor de desarrollo (Turbopack)       |
| `npm run build` | Build de producción                      |
| `npm start`     | Sirve el build de producción             |
| `npm run lint`  | Linter (ESLint)                          |

## Cómo añadir un comando a la biblioteca

Los comandos de la biblioteca son archivos **MDX** dentro de `content/`, organizados por
shell y producto: `content/<cli|powershell>/<servicio>/<nombre>.mdx`. No hace falta tocar
código: crea un `.mdx` con frontmatter y el catálogo lo recoge en el siguiente build.

```mdx
---
title: Listar máquinas virtuales
description: Muestra todas las VMs de un grupo de recursos.
shell: azurecli            # powershell | azurecli | arm | bicep | terraform | bash | cmd | other
category: Máquinas virtuales
tags: [vm, listar, consulta]
template: "az vm list --resource-group <resourceGroup> --output <output>"
parameters:
  - name: resourceGroup     # debe coincidir con el <token> de la plantilla
    label: Grupo de recursos
    type: string            # string | number | boolean | enum
    required: true
    placeholder: mi-grupo-recursos
  - name: output
    label: Formato de salida
    type: enum
    required: false
    default: table
    options: [table, json, jsonc, tsv, yaml]
---

El cuerpo Markdown se renderiza como **notas** debajo del comando (admite `código`,
enlaces y listas).
```

Reglas:

- Cada `<token>` de `template` debe tener un `parameters[].name` que coincida.
- Los valores numéricos de `default` van entre comillas (`default: "2"`), ya que el
  frontmatter se valida con Zod.
- El frontmatter se valida al cargar; un archivo mal formado hace fallar el build con un
  mensaje indicando el problema.

## Arquitectura

- **Next.js 16** (App Router, React 19, Turbopack). Las páginas de sección son Server
  Components `async` que leen el catálogo en el servidor.
- **Capa de contenido** (`src/lib/content/`): `fs` + `gray-matter` para el frontmatter,
  `remark` (+ `remark-gfm`) para convertir las notas Markdown a HTML, y **Zod** para
  validar el frontmatter.
- **Mis comandos** usa un patrón de repositorio (`src/lib/repositories/`) con una
  implementación sobre `localStorage`, pensado para poder cambiar a un backend después sin
  tocar la UI.
- **UI:** Tailwind CSS v4 + shadcn/ui (Base UI), `next-themes` (tema), `sonner` (toasts),
  `lucide-react` (iconos).

### Estructura del proyecto

```
content/                     # Catálogo MDX (cli/ y powershell/ por servicio)
src/
  app/                       # Rutas: /, /powershell, /cli, /mis-comandos, (arm|bicep|terraform)
  components/
    command/                 # CommandCard, CommandList, CodeBlock, formulario, import/export
    ui/                      # Componentes shadcn/ui
  lib/
    content/                 # Loader MDX + esquema de frontmatter (server-only)
    repositories/            # Repositorio de "Mis comandos" (localStorage)
    params/                  # Motor de plantillas (<token> → valores)
    store/                   # Hook useUserCommands
    types.ts, schema.ts, ...
```

## Notas de desarrollo

- El proyecto usa una versión de Next.js con cambios respecto a lo habitual; consulta
  `node_modules/next/dist/docs/` y `AGENTS.md` antes de modificar la configuración.
- Evita alternar `next build` y `next dev` sobre el mismo `.next`: puede dejar artefactos
  incompatibles y provocar 404 en todas las rutas. Si ocurre, borra `.next` y reinicia.
