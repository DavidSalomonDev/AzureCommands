#!/usr/bin/env bash
# Exporta la configuración de todas las políticas WAF de una suscripción de Azure:
# reglas personalizadas, reglas gestionadas modificadas, exclusiones y excepciones.
set -uo pipefail

# ---------------------------------------------------------------------------
# PARÁMETROS
# ---------------------------------------------------------------------------
SUBSCRIPTION_ID="<subscriptionId>"   # ID o nombre de la suscripción de trabajo
OUT_DIR="<outDir>"                   # Carpeta de salida para los JSON y los CSV
TIPO="<tipo>"                        # ambos | appgw | frontdoor
CSV_RESUMEN="<csvResumen>"           # true = genera además los CSV de resumen

APPGW_TYPE="Microsoft.Network/ApplicationGatewayWebApplicationFirewallPolicies"
FD_TYPE="Microsoft.Network/FrontDoorWebApplicationFirewallPolicies"

# ---------------------------------------------------------------------------
# SUSCRIPCIÓN DE TRABAJO
# ---------------------------------------------------------------------------
az account set --subscription "$SUBSCRIPTION_ID" || {
  echo "No se pudo seleccionar la suscripción '${SUBSCRIPTION_ID}'."
  exit 1
}

echo "Suscripción: $(az account show --query name -o tsv | tr -d '\r')"
mkdir -p "$OUT_DIR"

# ---------------------------------------------------------------------------
# 1. LOCALIZAR LAS POLÍTICAS WAF
# ---------------------------------------------------------------------------
# az resource list es suficiente: no hace falta la extensión de Resource Graph
# ni la de Front Door, y los dos tipos de política salen con el mismo comando.
IDS=$(mktemp)

if [ "$TIPO" != "frontdoor" ]; then
  az resource list --resource-type "$APPGW_TYPE" --query "[].id" -o tsv \
    | tr -d '\r' >> "$IDS"
fi
if [ "$TIPO" != "appgw" ]; then
  az resource list --resource-type "$FD_TYPE" --query "[].id" -o tsv \
    | tr -d '\r' >> "$IDS"
fi

TOTAL=$(grep -c . "$IDS" || true)
if [ "$TOTAL" -eq 0 ]; then
  echo "No se encontraron políticas WAF en esta suscripción."
  rm -f "$IDS"
  exit 0
fi
echo "Políticas WAF encontradas: $TOTAL"

# ---------------------------------------------------------------------------
# 2. CABECERAS DE LOS CSV DE RESUMEN
# ---------------------------------------------------------------------------
POLITICAS_CSV="$OUT_DIR/politicas.csv"
CUSTOM_CSV="$OUT_DIR/reglas-personalizadas.csv"
EXCL_CSV="$OUT_DIR/exclusiones.csv"
EXCEP_CSV="$OUT_DIR/excepciones.csv"
OVER_CSV="$OUT_DIR/reglas-modificadas.csv"

if [ "$CSV_RESUMEN" = "true" ]; then
  echo "Politica;Plataforma;GrupoRecursos;Modo;Estado;ReglasCustom;Exclusiones;Excepciones;ReglasModificadas" > "$POLITICAS_CSV"
  echo "Politica;Regla;Prioridad;Tipo;Accion;Estado" > "$CUSTOM_CSV"
  echo "Politica;Ambito;Contexto;Variable;Operador;Selector" > "$EXCL_CSV"
  echo "Politica;Variable;Operador;Selector;Valores" > "$EXCEP_CSV"
  echo "Politica;ReglaId;Estado;Accion" > "$OVER_CSV"
fi

# Consulta la política actual y devuelve filas limpias, sin líneas vacías.
consultar() {
  az resource show --ids "$ID" --query "$1" -o tsv 2>/dev/null \
    | tr -d '\r' | grep -v '^[[:space:]]*$'
}

# Añade filas a un CSV sólo si hay alguna.
agregar() {
  [ -n "$2" ] && printf '%s\n' "$2" >> "$1"
  return 0
}

contar() {
  printf '%s' "$1" | grep -c . || true
}

# Exclusiones de un nivel anidado, recuperando el contexto que el aplanado pierde.
#
# Una proyección como managedRuleSets[].ruleGroupOverrides[].exclusions[] devuelve
# las exclusiones sin decir de qué grupo salió cada una, y en una política con
# decenas de exclusiones de ámbito grupo eso es justo el dato que hace falta. La
# solución: pedir aparte cada contenedor con el número de exclusiones que declara
# y repetir su nombre esas veces. Las dos consultas recorren el documento en el
# mismo orden, así que las secuencias se emparejan fila a fila.
#
#   $1 = etiqueta del ámbito   $2 = consulta de contenedores   $3 = consulta de filas
exclusiones_anidadas() {
  local contenedores filas
  contenedores=$(consultar "$2")
  filas=$(consultar "$3")
  [ -z "$filas" ] && return 0
  awk -F'\t' -v p="$NAME" -v a="$1" 'BEGIN{OFS=";"}
    NR==FNR { n=$NF+0; for (i=0;i<n;i++) ctx[++c]=$1; next }
    { print p,a,ctx[FNR],$1,$2,$3 }' \
    <(printf '%s\n' "$contenedores") <(printf '%s\n' "$filas")
}

# ---------------------------------------------------------------------------
# 3. RECORRER LAS POLÍTICAS
# ---------------------------------------------------------------------------
OK_COUNT=0
ERR_COUNT=0

while read -r ID; do
  [ -z "$ID" ] && continue
  NAME=$(basename "$ID")

  case "$ID" in
    *rontDoorWebApplicationFirewallPolicies*) PLATAFORMA="frontdoor" ;;
    *) PLATAFORMA="appgw" ;;
  esac

  echo "- $NAME ($PLATAFORMA)"

  # 3.1 JSON completo: el respaldo fiel, con todo el anidamiento intacto.
  if ! az resource show --ids "$ID" -o json > "$OUT_DIR/${NAME}.json" 2>/dev/null; then
    echo "    [!] no se pudo leer la política (revisa permisos)"
    rm -f "$OUT_DIR/${NAME}.json"
    ERR_COUNT=$((ERR_COUNT + 1))
    continue
  fi
  OK_COUNT=$((OK_COUNT + 1))
  [ "$CSV_RESUMEN" != "true" ] && continue

  # 3.2 Reglas personalizadas. En Application Gateway customRules es un arreglo;
  # en Front Door es un objeto que lleva las reglas dentro de .rules.
  if [ "$PLATAFORMA" = "appgw" ]; then
    RUTA_CUSTOM="properties.customRules[]"
  else
    RUTA_CUSTOM="properties.customRules.rules[]"
  fi
  ROWS_CUSTOM=$(consultar "${RUTA_CUSTOM}.[name, priority, ruleType, action, state, enabledState]" \
    | awk -F'\t' -v p="$NAME" 'BEGIN{OFS=";"} {estado=($5!="")?$5:$6; print p,$1,$2,$3,$4,estado}')
  agregar "$CUSTOM_CSV" "$ROWS_CUSTOM"

  # 3.3 Exclusiones. Las de Application Gateway cuelgan de managedRules y llevan
  # dentro el conjunto al que se acotan. Las de Front Door viven en tres niveles
  # (conjunto, grupo y regla) y una no se ve consultando el ámbito de otra.
  ROWS_EXCL=$(consultar "properties.managedRules.exclusions[].[matchVariable, selectorMatchOperator, selector, to_string(exclusionManagedRuleSets[].ruleSetType)]" \
    | awk -F'\t' -v p="$NAME" 'BEGIN{OFS=";"}
        { ctx="global";
          if ($4 != "" && $4 != "null") { gsub(/[]["]/, "", $4); ctx="acotada a " $4 }
          print p,"politica",ctx,$1,$2,$3 }')
  agregar "$EXCL_CSV" "$ROWS_EXCL"
  N_EXCL=$(contar "$ROWS_EXCL")

  ROWS_NIVEL=$(exclusiones_anidadas "conjunto" \
    'properties.managedRules.managedRuleSets[].[ruleSetType, length(not_null(exclusions, `[]`))]' \
    'properties.managedRules.managedRuleSets[].exclusions[].[matchVariable, selectorMatchOperator, selector]')
  agregar "$EXCL_CSV" "$ROWS_NIVEL"
  N_EXCL=$((N_EXCL + $(contar "$ROWS_NIVEL")))

  ROWS_NIVEL=$(exclusiones_anidadas "grupo" \
    'properties.managedRules.managedRuleSets[].ruleGroupOverrides[].[ruleGroupName, length(not_null(exclusions, `[]`))]' \
    'properties.managedRules.managedRuleSets[].ruleGroupOverrides[].exclusions[].[matchVariable, selectorMatchOperator, selector]')
  agregar "$EXCL_CSV" "$ROWS_NIVEL"
  N_EXCL=$((N_EXCL + $(contar "$ROWS_NIVEL")))

  ROWS_NIVEL=$(exclusiones_anidadas "regla" \
    'properties.managedRules.managedRuleSets[].ruleGroupOverrides[].rules[].[ruleId, length(not_null(exclusions, `[]`))]' \
    'properties.managedRules.managedRuleSets[].ruleGroupOverrides[].rules[].exclusions[].[matchVariable, selectorMatchOperator, selector]')
  agregar "$EXCL_CSV" "$ROWS_NIVEL"
  N_EXCL=$((N_EXCL + $(contar "$ROWS_NIVEL")))

  # 3.4 Excepciones: dejan pasar la petición completa sin evaluar las reglas
  # gestionadas, así que los valores importan tanto como la variable.
  ROWS_EXCEP=$(consultar "properties.managedRules.exceptions[].[matchVariable, valueMatchOperator, selector, to_string(values)]" \
    | awk -F'\t' -v p="$NAME" 'BEGIN{OFS=";"} {gsub(/[]["]/, "", $4); print p,$1,$2,$3,$4}')
  agregar "$EXCEP_CSV" "$ROWS_EXCEP"

  # 3.5 Reglas gestionadas modificadas. Sólo las que alguien tocó: las que siguen
  # con su comportamiento por defecto están activas y no aparecen en esta lista.
  ROWS_OVER=$(consultar "properties.managedRules.managedRuleSets[].ruleGroupOverrides[].rules[].[ruleId, state, enabledState, action]" \
    | awk -F'\t' -v p="$NAME" 'BEGIN{OFS=";"} {estado=($2!="")?$2:$3; print p,$1,estado,$4}')
  agregar "$OVER_CSV" "$ROWS_OVER"

  # 3.6 Fila de resumen. El estado se llama state en Application Gateway y
  # enabledState en Front Door, así que se toma el primero que venga con valor.
  AJUSTES=$(consultar "[properties.policySettings.mode, properties.policySettings.state, properties.policySettings.enabledState]")
  MODO=$(printf '%s\n' "$AJUSTES" | sed -n '1p')
  ESTADO=$(printf '%s\n' "$AJUSTES" | sed -n '2p')
  [ -z "$ESTADO" ] && ESTADO=$(printf '%s\n' "$AJUSTES" | sed -n '3p')
  GRUPO=$(printf '%s\n' "$ID" | awk -F'/' '{print $5}')

  printf '%s;%s;%s;%s;%s;%s;%s;%s;%s\n' \
    "$NAME" "$PLATAFORMA" "$GRUPO" "${MODO:-n/d}" "${ESTADO:-n/d}" \
    "$(contar "$ROWS_CUSTOM")" "$N_EXCL" \
    "$(contar "$ROWS_EXCEP")" "$(contar "$ROWS_OVER")" >> "$POLITICAS_CSV"

  echo "    custom: $(contar "$ROWS_CUSTOM") | exclusiones: $N_EXCL | excepciones: $(contar "$ROWS_EXCEP") | modificadas: $(contar "$ROWS_OVER")"
done < "$IDS"

rm -f "$IDS"

# ---------------------------------------------------------------------------
# 4. CIERRE
# ---------------------------------------------------------------------------
echo
echo "Políticas exportadas: $OK_COUNT de $TOTAL"
[ "$ERR_COUNT" -gt 0 ] && echo "Políticas que no se pudieron leer: $ERR_COUNT"
echo "JSON completos en: $OUT_DIR"
if [ "$CSV_RESUMEN" = "true" ]; then
  echo "Resúmenes: politicas.csv, reglas-personalizadas.csv, exclusiones.csv, excepciones.csv, reglas-modificadas.csv"
fi
