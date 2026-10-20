import { describe, expect, it } from "vitest";

import {
  assertOperationIsResolvable,
  assertParametersMatchTemplate,
  assertUniqueIds,
} from "@/lib/content/validate";
import type { CommandParameter } from "@/lib/types";

function param(name: string): CommandParameter {
  return { name, label: name, type: "string", required: false };
}

describe("assertParametersMatchTemplate", () => {
  it("acepta una plantilla cuyos tokens están todos declarados", () => {
    expect(() =>
      assertParametersMatchTemplate(
        "az vm show --name <vm> -g <rg>",
        [param("vm"), param("rg")],
        "content/x.mdx"
      )
    ).not.toThrow();
  });

  it("acepta una plantilla sin tokens ni parámetros", () => {
    expect(() =>
      assertParametersMatchTemplate("az vm list", [], "content/x.mdx")
    ).not.toThrow();
  });

  it("falla si un token no tiene parámetro, y lo dice con el archivo", () => {
    expect(() =>
      assertParametersMatchTemplate("az vm show --name <vm>", [], "content/x.mdx")
    ).toThrow(/content\/x\.mdx[\s\S]*<vm>/);
  });

  it("falla si un parámetro declarado no aparece en la plantilla", () => {
    expect(() =>
      assertParametersMatchTemplate("az vm list", [param("sobrante")], "content/x.mdx")
    ).toThrow(/sobrante/);
  });

  // El caso real que motivó la comprobación: `<rg>` y `<vm>` dentro de un
  // comentario de backup-vms.sh salían como huecos imposibles de rellenar.
  it("detecta tokens escondidos en un comentario del script", () => {
    const code = [
      "#!/usr/bin/env bash",
      "# Nombre del elemento: VM;iaasvmcontainerv2;<rg>;<vm>",
      'az backup item list --vault-name "<vault>"',
    ].join("\n");

    expect(() =>
      assertParametersMatchTemplate(code, [param("vault")], "content/scripts/x.sh")
    ).toThrow(/<rg>, <vm>/);
  });

  it("sugiere evitar los signos cuando sobran tokens", () => {
    expect(() => assertParametersMatchTemplate("<x>", [], "f")).toThrow(/< >/);
  });
});

describe("assertOperationIsResolvable", () => {
  it("acepta un comando az cuya acción se deduce", () => {
    expect(() =>
      assertOperationIsResolvable(
        { template: "az vm list --output table", shell: "azurecli" },
        "content/x.mdx"
      )
    ).not.toThrow();
  });

  it("acepta un cmdlet Verbo-Az", () => {
    expect(() =>
      assertOperationIsResolvable(
        { template: "Get-AzVM -ResourceGroupName <rg>", shell: "powershell" },
        "content/x.mdx"
      )
    ).not.toThrow();
  });

  it("acepta cualquier plantilla si la operación va declarada", () => {
    for (const shell of ["bash", "cmd"] as const) {
      expect(() =>
        assertOperationIsResolvable(
          { operation: "read", template: "df -h", shell },
          "content/x.mdx"
        )
      ).not.toThrow();
    }
  });

  it("acepta 'other' declarado a propósito", () => {
    expect(() =>
      assertOperationIsResolvable(
        { operation: "other", template: "az login", shell: "azurecli" },
        "content/x.mdx"
      )
    ).not.toThrow();
  });

  // Es lo que motivó la comprobación: en Linux y Windows la deducción nunca
  // acierta, así que sin declararla todo caería en "Otras acciones".
  it.each([
    ["bash", "df -h"],
    ["bash", "systemctl status <servicio>"],
    ["cmd", "Get-HotFix | Sort-Object InstalledOn"],
    ["cmd", "Remove-Item <ruta>"],
  ])("falla sin declarar: %s | %s", (shell, template) => {
    expect(() =>
      assertOperationIsResolvable(
        { template, shell: shell as "bash" | "cmd" },
        "content/linux/x.mdx"
      )
    ).toThrow(/content\/linux\/x\.mdx[\s\S]*operation/);
  });

  it("falla también con un comando az cuya acción no reconoce", () => {
    expect(() =>
      assertOperationIsResolvable(
        { template: "az vm inventar-cosas", shell: "azurecli" },
        "content/x.mdx"
      )
    ).toThrow(/operation/);
  });
});

describe("assertUniqueIds", () => {
  it("acepta ids distintos", () => {
    expect(() =>
      assertUniqueIds([{ id: "a" }, { id: "b" }], "Catálogo")
    ).not.toThrow();
  });

  it("acepta una lista vacía", () => {
    expect(() => assertUniqueIds([], "Catálogo")).not.toThrow();
  });

  it("falla y nombra el id repetido", () => {
    expect(() =>
      assertUniqueIds([{ id: "a" }, { id: "b" }, { id: "a" }], "Catálogo")
    ).toThrow(/Catálogo[\s\S]*a/);
  });

  it("nombra cada duplicado una sola vez", () => {
    try {
      assertUniqueIds([{ id: "a" }, { id: "a" }, { id: "a" }], "Catálogo");
      expect.unreachable("debería haber fallado");
    } catch (error) {
      const message = (error as Error).message;
      expect(message.match(/\ba\b/g)).toHaveLength(1);
    }
  });
});
