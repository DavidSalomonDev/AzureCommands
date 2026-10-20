# Azure Commands · Biblia de comandos de Azure

Organizador web de comandos para administrar Azure. Prioriza **Azure CLI** (`az`) —misma
sintaxis en Cloud Shell, Linux, macOS y Windows— y mantiene **PowerShell** (módulo `Az`)
para quien lo prefiera. Permite completar los parámetros con inputs dinámicos y copiar la
línea lista para pegar. Para las tareas que no caben en una sola línea está la sección
**Scripts**, y puedes guardar tus propias líneas en **Mis comandos**, con exportación e
importación para llevártelas entre equipos.

## Características

- **Catálogo curado** de comandos de Azure CLI (`az`) y PowerShell (módulo `Az`),
  organizados por producto de Azure (VMs, Redes, Almacenamiento, AKS, Key Vault,
  Application Gateway, Load Balancer, Front Door, Recovery Services Vault,
  Virtual Network Gateway, etc.).
- **Parámetros dinámicos:** cada comando expone inputs por cada `<token>` de su plantilla;
  al escribir, la sustitución se refleja en vivo en el bloque de código.
- **Copiar al portapapeles** con un clic en cada bloque de código.
- **Menú lateral** con las secciones y sus categorías, colapsable con el botón
  hamburguesa (en escritorio queda como barra de iconos; en móvil se abre como cajón).
  Al elegir una categoría se filtra la sección mediante el parámetro `?cat=`.
- **Subcategorías CRUD** dentro de cada producto: los comandos se agrupan en
  **Consultar → Crear → Actualizar → Eliminar → Otras acciones**, siempre en ese orden
  (consultar primero, que es lo que más se usa). La operación se deduce del propio
  comando (`az … list`, `Get-Az…`, `az … delete`, `Remove-Az…`) y se puede forzar con
  `operation:` en el frontmatter.
- **Favoritos:** marca cualquier comando o script con la estrella y encuéntralos todos en
  la sección **Favoritos**. Se guardan en `localStorage`.
- **Búsqueda** por título, descripción, categoría o etiqueta en cada sección.
- **Scripts** de varias líneas, todos en Azure CLI (Bash): con los mismos inputs
  dinámicos que los comandos —los valores se sustituyen en vivo dentro del código— y
  botones para copiar el script completo o descargarlo ya rellenado.
- **Resaltado de sintaxis** de Bash (comandos `az` y scripts) con un tokenizador propio,
  necesario porque los `<token>` se sustituyen en vivo en el navegador. PowerShell se
  muestra sin colores por ahora, con sus placeholders igualmente resaltados.
- **Mis comandos:** guarda tus propias líneas (Linux o Windows) en `localStorage`, con
  autodetección de parámetros `<token>`, y **exporta/importa** en JSON para migrar entre
  equipos.
- **Tema claro/oscuro** y UI accesible con Tailwind CSS + shadcn/ui.

## Secciones

El orden de las secciones (menú lateral y portada) refleja la prioridad: primero Azure
CLI, después Scripts y luego PowerShell.

| Sección        | Estado        | Contenido                                             |
| -------------- | ------------- | ----------------------------------------------------- |
| Azure CLI      | Disponible    | Comandos `az` (opción recomendada)                    |
| Scripts        | Disponible    | Scripts completos en Azure CLI (Bash)                 |
| PowerShell     | Disponible    | Comandos del módulo `Az`                              |
| Favoritos      | Disponible    | Lo que marcaste con la estrella (localStorage)        |
| Mis comandos   | Disponible    | Comandos propios del usuario (localStorage)           |
| ARM            | Próximamente  | Plantillas ARM                                        |
| Bicep          | Próximamente  | Plantillas Bicep                                      |
| Terraform      | Próximamente  | Configuraciones Terraform                             |

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

| Script              | Descripción                                       |
| ------------------- | ------------------------------------------------- |
| `npm run dev`       | Servidor de desarrollo (Turbopack)                |
| `npm run build`     | Build de producción (también valida el catálogo)  |
| `npm start`         | Sirve el build de producción                      |
| `npm run lint`      | Linter (ESLint)                                   |
| `npm run typecheck` | Comprobación de tipos (`tsc --noEmit`)            |
| `npm test`          | Tests unitarios (Vitest)                          |
| `npm run test:watch`| Tests en modo watch                               |
| `npm run check`     | lint + typecheck + test, lo mismo que corre la CI |

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
operation: read            # opcional; si falta se deduce del comando
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

Reglas (todas se comprueban al cargar el catálogo, así que un error hace fallar
`npm run build` indicando el archivo):

- Cada `<token>` de `template` debe tener un `parameters[].name` que coincida, y al revés:
  un parámetro declarado que no aparezca en la plantilla también es error. Un token sin
  declarar se mostraría como un hueco que nadie puede rellenar, y al copiar saldría tal cual.
- El `id` de cada comando (`lib-<shell>-<slug>`) tiene que ser único. Como el slug sale del
  nombre del archivo, dos archivos con el mismo nombre bajo el mismo shell chocan: renombra
  uno o fija un `slug` distinto en su frontmatter.
- `operation` solo hace falta cuando la deducción falla (por ejemplo
  `az aks get-credentials`, que parece lectura y también escribe el kubeconfig).
- Los valores numéricos de `default` van entre comillas (`default: "2"`), ya que el
  frontmatter se valida con Zod.

## Cómo añadir un script

Los scripts viven en `content/scripts/` como archivos reales `.sh` (o `.ps1`), tal cual
los ejecutas. Junto a cada uno puedes dejar un `.md` **con el mismo nombre base** que
aporta el frontmatter y las notas:

```
content/scripts/backup-vms.sh      # el script, con <tokens> donde van los valores
content/scripts/backup-vms.md      # metadatos + notas (opcional)
```

```md
---
title: Respaldo masivo de VMs
description: Lanza un backup on-demand para varias VMs y monitorea el snapshot.
category: Respaldo y snapshots
tags: [backup, vm]
operation: create           # consulta/creación/… para agrupar y ordenar
language: bash              # opcional; por defecto se deduce de la extensión
usage: "bash backup-vms.sh"
requirements:
  - Azure CLI (`az`) con sesión iniciada
parameters:                 # mismos campos que los comandos MDX
  - name: vmNames           # debe coincidir con el <token> usado en el script
    label: VMs a respaldar
    type: string
    required: true
    placeholder: vm-app01,vm-sql01
---

Notas en Markdown: qué hace, parámetros, advertencias…
```

Los `<token>` del script se convierten en inputs sobre el bloque de código y se
sustituyen en vivo; copiar y descargar usan siempre el script ya rellenado. Evita usar
`<` y `>` en el código para otra cosa que no sean parámetros —incluso dentro de un
comentario—: el build falla si encuentra un `<token>` sin su parámetro declarado. Si
necesitas documentar un formato de Azure que lleva marcadores, escríbelo sin los signos
(`VM;iaasvmcontainerv2;GRUPO_RECURSOS;NOMBRE_VM`).

Sin sidecar el script igual aparece: toma el nombre del archivo como título y la carpeta
que lo contiene como categoría (`content/scripts/<categoría>/<script>.ps1`).

## Arquitectura

- **Next.js 16** (App Router, React 19, Turbopack). Las páginas de sección son Server
  Components `async` que leen el catálogo en el servidor.
- **Capa de contenido** (`src/lib/content/`): `loader.ts` para los comandos MDX,
  `scripts-loader.ts` para `content/scripts/` y `nav-tree.ts` para armar el menú lateral
  (secciones + categorías con su conteo). Usa `fs` + `gray-matter` para el frontmatter,
  `remark` (+ `remark-gfm`) para convertir las notas Markdown a HTML, y **Zod** para
  validar el frontmatter.
- **Mis comandos** usa un patrón de repositorio (`src/lib/repositories/`) con una
  implementación sobre `localStorage`, pensado para poder cambiar a un backend después sin
  tocar la UI.
- **Favoritos** son ids en `localStorage`, así que el servidor no sabe cuáles son. En vez
  de mandar el catálogo entero con la página, cada sección se publica como JSON estático
  en `/catalog/<sección>` (`src/app/catalog/[section]/route.ts`, prerenderizado en el
  build) y el navegador baja solo las secciones en las que hay favoritos —ninguna si no
  hay. El id lleva su sección dentro y se construye en `src/lib/catalog.ts`, de modo que
  loaders y cliente usan la misma definición.
- **UI:** Tailwind CSS v4 + shadcn/ui (Base UI), `next-themes` (tema), `sonner` (toasts),
  `lucide-react` (iconos).

### Estructura del proyecto

```
content/
  cli/  powershell/          # Catálogo MDX por servicio
  scripts/                   # Scripts .sh + sidecar .md con sus metadatos
  _powershell-originales/    # Versiones PowerShell previas, fuera del catálogo
src/
  app/                       # Rutas: /, /cli, /scripts, /powershell, /favoritos, /mis-comandos, (arm|bicep|terraform)
    catalog/[section]/       # JSON estático del catálogo, para la página de favoritos
  components/
    app-shell.tsx            # Cabecera + menú lateral colapsable (estado del sidebar)
    app-sidebar.tsx          # Secciones, productos y operaciones del menú lateral
    catalog-list.tsx         # Buscador + filtros + agrupado, compartido por ambas secciones
    favorite-button.tsx      # Estrella de favoritos (comandos y scripts)
    markdown-notes.tsx       # Notas en Markdown ya convertidas a HTML
    code/                    # CodeBlock (marco + copiar) y CodeView (resaltado)
    command/                 # CommandCard, CommandList, formulario, import/export
    script/                  # ScriptCard, ScriptList
    ui/                      # Componentes shadcn/ui
  lib/
    operations.ts            # Subcategorías CRUD: orden, etiquetas y deducción
    content/                 # Loaders + esquemas de frontmatter + validaciones (server-only)
    repositories/            # Repositorio de "Mis comandos" (localStorage)
    params/                  # Motor de plantillas (<token> → valores)
    catalog.ts               # Secciones del catálogo y construcción de ids
    highlight/               # Tokenizador de Bash y lenguajes resaltables
    download.ts              # Descarga de archivos generados en el navegador
    store/                   # Hooks useUserCommands, useFavorites y useFavoriteCatalog
    types.ts, schema.ts, ...
```

## Tests

Los tests cubren la lógica pura, que es donde se concentra el riesgo: el
tokenizador de Bash (`src/lib/highlight/bash.ts`), el motor de plantillas, la
deducción CRUD, los slugs, la construcción de ids del catálogo, el repositorio
de "Mis comandos" y las validaciones de contenido. Viven junto al código que
prueban, como `<archivo>.test.ts`.

```bash
npm test
```

Corren en Node; el único que necesita navegador (el repositorio sobre
`localStorage`) pide jsdom con un comentario `@vitest-environment` al principio
del archivo. No hay tests de componentes todavía: harían falta
`@testing-library/react` y `@vitejs/plugin-react`.

Dos cosas que conviene no romper y que los tests fijan:

- El tokenizador sólo pone color, así que **nunca** debe alterar el código:
  rearmar sus tokens tiene que devolver la entrada exacta. Se comprueba contra
  fragmentos difíciles (heredocs, comillas, `$(...)`) y contra cada script real
  del catálogo.
- Un archivo importado en "Mis comandos" **no puede traer `notesHtml`**, porque
  las notas se pintan con `dangerouslySetInnerHTML`. Hoy lo impide Zod, que
  descarta las claves que no declara; hay un test que avisa si eso cambia.

La CI (`.github/workflows/ci.yml`) corre lint, typecheck, tests y build en cada
push a `main` y en cada pull request.

## Notas de desarrollo

- El proyecto usa una versión de Next.js con cambios respecto a lo habitual; consulta
  `node_modules/next/dist/docs/` y `AGENTS.md` antes de modificar la configuración.
- Evita alternar `next build` y `next dev` sobre el mismo `.next`: puede dejar artefactos
  incompatibles y provocar 404 en todas las rutas. Si ocurre, borra `.next` y reinicia.
