---
title: Prompt con colores y autocompletado en Cloud Shell
description: Personaliza la Bash de Azure Cloud Shell con un prompt de colores, salidas coloreadas (Azure CLI, listados, manuales) y ble.sh para autocompletado y resaltado mientras escribes.
category: Entorno y shell
tags: [cloud-shell, bash, prompt, ble-sh, alias, colores, productividad]
operation: other
language: bash
usage: "source prompt-colores-cloud-shell.sh"
requirements:
  - Bash interactiva (Azure Cloud Shell o cualquier Linux)
  - "`git` y `make` disponibles, sólo para instalar ble.sh"
  - Cargarlo con `source`; con `bash archivo.sh` los cambios se pierden
parameters:
  - name: etiqueta
    label: Etiqueta del prompt
    description: Texto del distintivo de color al inicio de la línea.
    type: string
    required: true
    default: GBM
  - name: colorSalida
    label: Color en las salidas
    description: Añade color a ls, diff, ip, manuales y a las respuestas de Azure CLI.
    type: enum
    required: true
    default: "true"
    options: ["true", "false"]
  - name: instalarBle
    label: Instalar ble.sh
    description: Descarga y compila ble.sh la primera vez; después sólo lo carga.
    type: enum
    required: true
    default: "true"
    options: ["true", "false"]
  - name: bleHome
    label: Carpeta de ble.sh
    description: Dónde se clona el repositorio. En Cloud Shell, $HOME persiste entre sesiones.
    type: string
    required: true
    default: "$HOME/ble.sh"
---

El entorno de Cloud Shell es **efímero**: cada sesión nueva arranca con el prompt por
defecto, así que este script se pensó para copiar y pegar al abrir la shell.

Qué deja activo:

- Prompt en dos líneas con etiqueta, usuario, directorio y hora, y rutas largas
  recortadas a tres niveles (`PROMPT_DIRTRIM`).
- `ls`, `ll` y `grep` con color.
- [ble.sh](https://github.com/akinomyoga/ble.sh): resaltado de sintaxis, sugerencias
  del historial y autocompletado mientras escribes. `Enter` se reasigna a
  `accept-line` para que ejecute la línea tal cual y no acepte antes la sugerencia.

## Color en las salidas

ble.sh sólo colorea **lo que escribes**; la salida la colorea cada herramienta, así
que esa parte va por separado y se activa con *Color en las salidas*:

| Qué | Cómo |
| --- | --- |
| Azure CLI | `azc` y `azy` ejecutan `az` con `--output jsonc` / `--output yamlc` |
| Listados | `LS_COLORS` desde `dircolors` |
| Comparaciones y red | `diff --color=auto`, `ip -color=auto`, `tree -C` |
| Manuales y paginado | `LESS=-R` y `LESS_TERMCAP_*` |

`azc` y `azy` son funciones, no alias de `az`: el formato por defecto sigue siendo
el que esperan tus scripts, y el color se pide sólo cuando lo quieres ver
(`azc vm list -g mi-grupo`). Todo usa `auto`, así que al redirigir a un archivo o a
otro comando la salida vuelve a ser texto limpio y sigue siendo parseable.

Si una herramienta no trae color propio, pásala por `jq -C` (JSON) o instala
`grc`/`bat` en tu `$HOME`; Cloud Shell no los trae de fábrica.

La descarga y compilación de ble.sh ocurren **una sola vez**: como `$HOME` persiste
entre sesiones de Cloud Shell, las siguientes cargas son inmediatas. Si falla, la
salida queda en `/tmp/ble-make.log` y el prompt y los alias se aplican igual.

Para no pegarlo cada vez, guárdalo en tu `$HOME` y añádelo al final de `~/.bashrc`:

```bash
echo 'source "$HOME/prompt-colores-cloud-shell.sh"' >> ~/.bashrc
```

Para volver al prompt original en la sesión actual: `restaurar-prompt`.
