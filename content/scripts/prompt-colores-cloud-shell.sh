#!/usr/bin/env bash
# Prompt con colores, alias de listado y autocompletado (ble.sh) para la Bash
# de Azure Cloud Shell. Es efímero: se aplica a la sesión actual.
#
# Cárgalo con `source` (o pega el contenido en la shell). No usa `exit` ni
# `set -e` a propósito: un fallo aquí no debe cerrar tu sesión.

# ---------------------------------------------------------------------------
# PARÁMETROS
# ---------------------------------------------------------------------------
ETIQUETA="<etiqueta>"         # Texto del distintivo del prompt
INSTALAR_BLE="<instalarBle>"  # true = instala ble.sh la primera vez
BLE_HOME="<bleHome>"          # Carpeta donde vive ble.sh

# `bash archivo.sh` abre una subshell y el prompt se perdería al terminar.
INTERACTIVA=0
[[ $- == *i* ]] && INTERACTIVA=1

# ---------------------------------------------------------------------------
# PROMPT
# ---------------------------------------------------------------------------
# Guarda el prompt original una sola vez, aunque recargues el script.
export ORIGINAL_PS1="${ORIGINAL_PS1-$PS1}"

# Etiqueta | usuario | directorio | hora.
PS1='\n\[\e[1;97;44m\] '"$ETIQUETA"' \[\e[0;30;46m\] \u \[\e[0;97;45m\] \w \[\e[0m\] \[\e[90m\]\A\[\e[0m\]\n\[\e[1;32m\]❯\[\e[0m\] '

# Recorta las rutas largas a los últimos tres directorios.
PROMPT_DIRTRIM=3

# Vuelve al prompt anterior sin cerrar la sesión.
restaurar-prompt() { PS1="$ORIGINAL_PS1"; }

# ---------------------------------------------------------------------------
# COLORES DE LISTADOS Y COINCIDENCIAS
# ---------------------------------------------------------------------------
alias ls='ls --color=auto'
alias ll='ls -lah --color=auto'
alias grep='grep --color=auto'

# ---------------------------------------------------------------------------
# ble.sh: resaltado y autocompletado mientras escribes
# ---------------------------------------------------------------------------
BLE_SCRIPT="$BLE_HOME/out/ble.sh"
BLE_LOG="${TMPDIR:-/tmp}/ble-make.log"

# Clona y compila sólo si falta. En Cloud Shell $HOME persiste entre sesiones,
# así que esto ocurre una única vez y las siguientes cargas son inmediatas.
if [[ "$INSTALAR_BLE" == "true" && ! -f "$BLE_SCRIPT" ]]; then
  if ! command -v git >/dev/null || ! command -v make >/dev/null; then
    printf 'Faltan git o make: se omite la instalación de ble.sh.\n' >&2
  else
    if [[ ! -d "$BLE_HOME" ]]; then
      printf 'Descargando ble.sh en %s...\n' "$BLE_HOME"
      git clone --recursive --depth 1 --shallow-submodules \
        https://github.com/akinomyoga/ble.sh.git "$BLE_HOME"
    fi

    if [[ -d "$BLE_HOME" ]]; then
      printf 'Compilando ble.sh (sólo la primera vez)...\n'
      make -C "$BLE_HOME" >"$BLE_LOG" 2>&1 ||
        printf 'Falló la compilación; revisa %s\n' "$BLE_LOG" >&2
    fi
  fi
fi

# Carga ble.sh una sola vez por sesión y deja Enter ejecutando la línea tal
# cual, sin aceptar antes la sugerencia del autocompletado.
if [[ -f "$BLE_SCRIPT" && $INTERACTIVA -eq 1 ]]; then
  [[ -n "${BLE_VERSION-}" ]] || source "$BLE_SCRIPT"

  if declare -F ble-bind >/dev/null; then
    ble-bind -m emacs -f 'C-m' accept-line
    ble-bind -m emacs -f 'RET' accept-line
  fi
elif [[ "$INSTALAR_BLE" == "true" && $INTERACTIVA -eq 1 ]]; then
  printf 'Sin ble.sh: el prompt y los alias sí quedaron activos.\n' >&2
fi

if [[ $INTERACTIVA -eq 0 ]]; then
  printf 'Shell no interactiva: carga el script con "source" para ver el prompt.\n' >&2
fi
