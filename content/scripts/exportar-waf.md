---
title: Exportar reglas, exclusiones y excepciones de WAF
description: Recorre las políticas WAF de una suscripción (Application Gateway y Front Door), guarda el JSON completo de cada una y genera CSV de reglas personalizadas, reglas modificadas, exclusiones y excepciones.
category: Seguridad y WAF
tags: [waf, application-gateway, front-door, exclusiones, excepciones, auditoria, csv, exportar]
operation: read
language: bash
usage: "bash exportar-waf.sh"
requirements:
  - Azure CLI (`az`) con sesión iniciada (`az login`)
  - Permisos de lectura (*Reader*) sobre las políticas WAF a exportar
parameters:
  - name: subscriptionId
    label: Suscripción
    description: ID o nombre de la suscripción a recorrer.
    type: string
    required: true
    placeholder: 00000000-0000-0000-0000-000000000000
  - name: outDir
    label: Carpeta de salida
    description: Se crea si no existe. En Cloud Shell queda en tu almacenamiento persistente.
    type: string
    required: true
    default: waf-export
    placeholder: waf-export
  - name: tipo
    label: Plataformas a incluir
    description: Application Gateway, Front Door o las dos.
    type: enum
    required: true
    default: ambos
    options: [ambos, appgw, frontdoor]
  - name: csvResumen
    label: Generar CSV de resumen
    description: Además del JSON completo, escribe cinco CSV listos para Excel.
    type: enum
    required: true
    default: "true"
    options: ["true", "false"]
---

Pensado para auditorías: llegas a una suscripción que no conoces y necesitas saber qué
protege el WAF y, sobre todo, qué dejó de proteger alguien con una exclusión o una
excepción.

Localiza las políticas con `az resource list`, no con las extensiones de la CLI. Eso es
deliberado: el mismo comando devuelve los dos tipos de política y el script funciona en
cualquier Cloud Shell sin instalar `front-door` ni `resource-graph`.

De cada política guarda el JSON íntegro (`properties` completo, con todo el anidamiento)
y, si lo pides, cinco CSV separados por punto y coma:

- `politicas.csv`: una fila por política con plataforma, modo (*Prevention* / *Detection*),
  estado y el conteo de reglas, exclusiones y excepciones. Es la hoja para la foto general.
- `reglas-personalizadas.csv`: reglas propias con prioridad, tipo, acción y estado.
- `exclusiones.csv`: variable, operador, selector, **ámbito** y **contexto** de cada exclusión.
- `excepciones.csv`: variable, operador y los valores concretos (rangos de IP, URIs).
- `reglas-modificadas.csv`: reglas gestionadas deshabilitadas o con la acción cambiada.

Las columnas `Ambito` y `Contexto` de las exclusiones son las que suelen decidir una
auditoría. En Application Gateway el ámbito es `politica` y el contexto distingue entre
`global` (afecta a todas las reglas gestionadas) y acotada a un conjunto concreto. En
Front Door las exclusiones viven en tres niveles —conjunto, grupo y regla— y el script
recorre los tres, porque consultando un nivel no se ven las de los otros: es la razón
habitual por la que una exclusión "no aparece" aunque exista. Ahí el contexto dice de qué
conjunto, de qué grupo de reglas o de qué `ruleId` sale cada una.

Recuperar ese contexto tiene truco. Una proyección aplanada como
`managedRuleSets[].ruleGroupOverrides[].exclusions[]` devuelve las exclusiones sin decir
de qué grupo venía cada una, y en una política con decenas de exclusiones de ámbito grupo
eso es justo lo que hace falta. El script pide aparte cada contenedor con el número de
exclusiones que declara y repite su nombre esas veces: las dos consultas recorren el
documento en el mismo orden, así que las secuencias se emparejan fila a fila. Los
contenedores sin exclusiones declaran cero y no desplazan el emparejamiento.

Dos diferencias de esquema entre plataformas que el script resuelve solo: en Application
Gateway `customRules` es un arreglo y el estado de la política está en `state`, mientras
que en Front Door las reglas van dentro de `customRules.rules` y el estado es
`enabledState`. Por eso una misma consulta no sirve para las dos.

Sobre `reglas-modificadas.csv` hay que tener claro qué no dice: sólo lista las reglas que
alguien tocó. Las que siguen con su comportamiento por defecto están activas y no
aparecen, así que un CSV vacío significa "ninguna regla modificada", no "ninguna regla
activa". Para el estado real de cada regla hay que cruzarlo con el catálogo del conjunto
(`az network application-gateway waf-config list-rule-sets`).

Hace del orden de seis a ocho lecturas REST por política, así que en entornos con muchas
políticas tarda un poco; va imprimiendo el avance. Si una política no se puede leer lo
informa y sigue con las demás, y al cerrar dice cuántas quedaron fuera.

Los CSV usan punto y coma como separador para que Excel en español los abra en columnas
sin pasar por el asistente de importación.
