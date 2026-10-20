import { describe, expect, it } from "vitest";

import {
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
