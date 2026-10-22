#!/usr/bin/env bash
# Prompt con colores, color en las salidas y autocompletado (ble.sh) para la
# Bash de Azure Cloud Shell. Es efímero: se aplica a la sesión actual.
#
# Cárgalo con `source` (o pega el contenido en la shell). No usa `exit` ni
# `set -e` a propósito: un fallo aquí no debe cerrar tu sesión.

# ---------------------------------------------------------------------------
# PARÁMETROS
# ---------------------------------------------------------------------------
ETIQUETA="<etiqueta>"         # Texto del distintivo del prompt
COLOR_SALIDA="<colorSalida>"  # true = colorea también la salida de los comandos
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
# COLOR EN LAS SALIDAS
# ---------------------------------------------------------------------------
# ble.sh sólo colorea lo que escribes; la salida la colorea cada herramienta.
# Todo lo de aquí usa "auto": si rediriges a un archivo o a otro comando, la
# salida sigue siendo texto limpio.
if [[ "$COLOR_SALIDA" == "true" ]]; then
  # Paleta de LS_COLORS acorde a la terminal.
  command -v dircolors >/dev/null && eval "$(dircolors -b)"

  alias diff='diff --color=auto'
  alias ip='ip -color=auto'
  alias tree='tree -C'

  # Azure CLI: jsonc y yamlc colorean la respuesta. Van como funciones para no
  # cambiar el formato por defecto que esperan tus scripts: `azc vm list`.
  azc() { az "$@" --output jsonc; }
  azy() { az "$@" --output yamlc; }

  # Conserva los colores al paginar: `azc vm list | less`, `jq -C . | less`.
  export LESS='-R'

  # Páginas de manual con color.
  export LESS_TERMCAP_md=$'\e[1;36m'   # negritas: títulos
  export LESS_TERMCAP_us=$'\e[1;32m'   # subrayado: opciones
  export LESS_TERMCAP_so=$'\e[30;43m'  # barra de estado
  export LESS_TERMCAP_me=$'\e[0m'
  export LESS_TERMCAP_ue=$'\e[0m'
  export LESS_TERMCAP_se=$'\e[0m'
fi

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
