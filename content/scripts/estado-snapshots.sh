#!/usr/bin/env bash
# Estado de los snapshots de los respaldos de VM ya disparados (Azure CLI).
# Solo lectura: no dispara ni cancela nada.
set -uo pipefail

# ---------------------------------------------------------------------------
# PARÁMETROS
# ---------------------------------------------------------------------------
SUBSCRIPTION_ID="<subscriptionId>"   # Vacío = usa la suscripción activa
VM_NAMES="<vmNames>"                 # Vacío = todas las VMs
SINCE_HOURS="<sinceHours>"           # Horas hacia atrás que se revisan

# ---------------------------------------------------------------------------
# FORMATO DE DURACIÓN -> HH:MM:SS
# ---------------------------------------------------------------------------
# Azure CLI devuelve la duración en dos formas segun la version:
#   ISO 8601        -> PT7M36.5940899S, PT2H3M3.7S, PT45S
#   timedelta       -> 0:07:37.825563, 2:03:03.746747
fmt_duration() {
  local v="$1" d=0 h=0 m=0 s=0 t=""

  case "$v" in
    -|"") printf '%s' "-"; return ;;
    P*)
      t="${v#P}"
      case "$t" in *D*) d="${t%%D*}"; t="${t#*D}" ;; esac
      t="${t#T}"
      case "$t" in *H*) h="${t%%H*}"; t="${t#*H}" ;; esac
      case "$t" in *M*) m="${t%%M*}"; t="${t#*M}" ;; esac
      case "$t" in *S*) s="${t%%S*}" ;; esac
      ;;
    *:*:*)
      IFS=':' read -r h m s <<< "$v"
      ;;
    *)
      printf '%s' "$v"; return ;;
  esac

  # Se descarta la fraccion de segundo y se fuerza base 10: un "08" sin el
  # prefijo 10# lo leeria bash como octal y reventaria la aritmetica.
  d="${d%%.*}"; h="${h%%.*}"; m="${m%%.*}"; s="${s%%.*}"
  local total=$(( (10#${d:-0} * 86400) + (10#${h:-0} * 3600) + (10#${m:-0} * 60) + 10#${s:-0} ))

  printf '%02d:%02d:%02d' "$(( total / 3600 ))" "$(( total % 3600 / 60 ))" "$(( total % 60 ))"
}

# ---------------------------------------------------------------------------
# SUSCRIPCIÓN DE TRABAJO
# ---------------------------------------------------------------------------
if [ -n "$SUBSCRIPTION_ID" ]; then
  az account set --subscription "$SUBSCRIPTION_ID" || {
    echo "No se pudo seleccionar la suscripción '${SUBSCRIPTION_ID}'."
    exit 1
  }
fi

# --start-date exige dd-MM-yyyy-HH:mm:ss (o dd-MM-yyyy suelto); un ISO 8601 se
# rechaza. Azure CLI lo parsea como fecha naive y lo manda sin convertir, así
# que el servicio lo lee en UTC: por eso el corte se calcula con date -u.
START_UTC=$(date -u -d "-${SINCE_HOURS} hours" '+%d-%m-%Y-%H:%M:%S' 2>/dev/null \
  || date -u -v-"${SINCE_HOURS}"H '+%d-%m-%Y-%H:%M:%S')

# Azure CLI en Windows emite CRLF; el \r ensucia cualquier comparación
SUB_NAME=$(az account show --query name -o tsv </dev/null | tr -d '\r')

echo "=========================================================="
echo " ESTADO DE SNAPSHOTS DE RESPALDO"
echo " Suscripción: ${SUB_NAME}"
echo " Jobs de VM desde: ${START_UTC} UTC (${SINCE_HOURS} h atrás)"
[ -n "$VM_NAMES" ] && echo " Filtro de VMs: ${VM_NAMES}"
echo "=========================================================="

VM_FILTER=",$(printf '%s' "${VM_NAMES// /}" | tr '[:upper:]' '[:lower:]'),"

VAULTS=$(az backup vault list --query "[].[name, resourceGroup]" -o tsv </dev/null | tr -d '\r')

if [ -z "$VAULTS" ]; then
  echo "No se encontraron Recovery Services Vaults en la suscripción activa."
  exit 1
fi

printf '%-16s %-16s %-12s %-10s %-14s %s\n' \
  VM VAULT SNAPSHOT DURACION TRANSFERENCIA "INICIO (UTC)"
printf '%s\n' "-----------------------------------------------------------------------------------------"

# Las filas se acumulan con la fecha de inicio cruda por delante para ordenarlas
# al final: los vaults y sus jobs no llegan en orden cronologico.
ROWS=$(mktemp)
trap 'rm -f "$ROWS"' EXIT

while IFS=$'\t' read -r VAULT RG; do
  [ -z "$VAULT" ] && continue

  # operation=='Backup' deja fuera los "Backup (Full)" de SQL dentro de la VM,
  # que son otro tipo de job y no tienen subtarea de snapshot.
  # La proyección es una LISTA, no un diccionario: con -o tsv, Azure CLI ordena
  # las claves de un diccionario alfabéticamente y los valores se intercambian.
  JOBS=$(az backup job list \
    --vault-name "$VAULT" \
    --resource-group "$RG" \
    --start-date "$START_UTC" \
    --query "[?properties.operation=='Backup'].[name, properties.entityFriendlyName, properties.startTime]" \
    -o tsv </dev/null | tr -d '\r')

  while IFS=$'\t' read -r JOB VM START; do
    [ -z "$JOB" ] && continue

    if [ -n "$VM_NAMES" ]; then
      VM_LOWER=$(printf '%s' "$VM" | tr '[:upper:]' '[:lower:]')
      case "$VM_FILTER" in
        *",${VM_LOWER},"*) ;;
        *) continue ;;
      esac
    fi

    # La subtarea del snapshot vive en properties.extendedInfo.tasksList y se
    # identifica por su taskId ("Take Snapshot"). job list no trae extendedInfo,
    # por eso hace falta un job show por cada job.
    DETAIL=$(az backup job show \
      --name "$JOB" \
      --vault-name "$VAULT" \
      --resource-group "$RG" \
      --query "[properties.extendedInfo.tasksList[?taskId != null && contains(taskId, 'Snapshot')].status | [0], properties.extendedInfo.tasksList[?taskId != null && contains(taskId, 'Snapshot')].duration | [0], properties.extendedInfo.tasksList[?taskId != null && contains(taskId, 'Transfer')].status | [0]]" \
      -o tsv </dev/null | tr -d '\r')

    SNAPSHOT=$(sed -n 1p <<< "$DETAIL")
    SNAP_DUR=$(sed -n 2p <<< "$DETAIL")
    TRANSFER=$(sed -n 3p <<< "$DETAIL")

    # El TSV de Azure CLI imprime los nulos como el literal "None"
    case "$SNAPSHOT" in None|"") SNAPSHOT="-" ;; esac
    case "$SNAP_DUR" in None|"") SNAP_DUR="-" ;; esac
    case "$TRANSFER" in None|"") TRANSFER="-" ;; esac

    {
      printf '%s\t' "$START"
      printf '%-16s %-16s %-12s %-10s %-14s %s\n' \
        "$VM" "${VAULT:0:16}" "$SNAPSHOT" "$(fmt_duration "$SNAP_DUR")" "$TRANSFER" \
        "${START:0:10} ${START:11:5}"
    } >> "$ROWS"
  done <<< "$JOBS"
done <<< "$VAULTS"

if [ -s "$ROWS" ]; then
  # La marca de tiempo es ISO 8601 en UTC, asi que el orden lexicografico
  # coincide con el cronologico.
  sort -t$'\t' -k1,1 "$ROWS" | cut -f2-
else
  echo "(sin jobs de respaldo de VM en el rango; sube SINCE_HOURS o revisa la suscripción)"
fi

echo "=========================================================="
echo " SNAPSHOT en 'Completed' = la VM ya se puede intervenir"
echo "=========================================================="
