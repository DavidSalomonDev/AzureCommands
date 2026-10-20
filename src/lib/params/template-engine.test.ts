import { describe, expect, it } from "vitest";

import {
  autoDetectParameters,
  buildDefaultValues,
  extractPlaceholders,
  isTemplateFullyFilled,
  parseTemplateSegments,
  renderTemplate,
} from "@/lib/params/template-engine";
import type { CommandParameter } from "@/lib/types";

function param(name: string, extra: Partial<CommandParameter> = {}): CommandParameter {
  return { name, label: name, type: "string", required: false, ...extra };
}

describe("parseTemplateSegments", () => {
  it("separa texto y tokens conservando el orden", () => {
    expect(parseTemplateSegments("az vm show --name <vm> -g <rg>")).toEqual([
      { type: "text", value: "az vm show --name " },
      { type: "token", value: "vm" },
      { type: "text", value: " -g " },
      { type: "token", value: "rg" },
    ]);
  });

  it("devuelve un único segmento de texto cuando no hay tokens", () => {
    expect(parseTemplateSegments("az vm list")).toEqual([
      { type: "text", value: "az vm list" },
    ]);
  });

  it("no toma por token una redirección ni una sustitución de proceso", () => {
    const code = "done < <(az vm list)";
    expect(parseTemplateSegments(code).every((s) => s.type === "text")).toBe(true);
  });

  it("acepta puntos, guiones y guiones bajos en el nombre", () => {
    expect(extractPlaceholders("<mi_param> <otro-param> <con.punto>")).toEqual([
      "mi_param",
      "otro-param",
      "con.punto",
    ]);
  });

  it("rechaza nombres que no empiezan por letra o guión bajo", () => {
    expect(extractPlaceholders("<1param> <-x> < espacio>")).toEqual([]);
  });
});

describe("extractPlaceholders", () => {
  it("quita duplicados y respeta el orden de aparición", () => {
    expect(extractPlaceholders("<b> y <a> y otra vez <b>")).toEqual(["b", "a"]);
  });
});

describe("renderTemplate", () => {
  it("sustituye los valores dados", () => {
    expect(renderTemplate("az vm show --name <vm>", { vm: "web01" })).toBe(
      "az vm show --name web01"
    );
  });

  it("deja el token visible cuando falta el valor o está en blanco", () => {
    expect(renderTemplate("<a> <b>", { a: "x", b: "   " })).toBe("x <b>");
    expect(renderTemplate("<a>", {})).toBe("<a>");
  });

  it("repite el valor en cada aparición del mismo token", () => {
    expect(renderTemplate("<n> y <n>", { n: "5" })).toBe("5 y 5");
  });

  it("no reinterpreta un valor que contiene otro token", () => {
    expect(renderTemplate("<a>", { a: "<b>" })).toBe("<b>");
  });
});

describe("isTemplateFullyFilled", () => {
  const parameters = [param("obligatorio", { required: true }), param("opcional")];

  it("sólo exige los parámetros obligatorios", () => {
    expect(isTemplateFullyFilled(parameters, { obligatorio: "x" })).toBe(true);
  });

  it("no da por relleno un valor en blanco", () => {
    expect(isTemplateFullyFilled(parameters, { obligatorio: "  " })).toBe(false);
  });

  it("es cierto cuando no hay parámetros obligatorios", () => {
    expect(isTemplateFullyFilled([param("a")], {})).toBe(true);
  });
});

describe("buildDefaultValues", () => {
  it("siembra sólo los parámetros que declaran un valor por defecto", () => {
    const parameters = [param("conDefecto", { default: "table" }), param("sinDefecto")];
    expect(buildDefaultValues(parameters)).toEqual({ conDefecto: "table" });
  });

  it("conserva una cadena vacía declarada a propósito", () => {
    expect(buildDefaultValues([param("vacio", { default: "" })])).toEqual({ vacio: "" });
  });
});

describe("autoDetectParameters", () => {
  it("convierte cada token en un parámetro de texto opcional", () => {
    expect(autoDetectParameters("systemctl restart <servicio>")).toEqual([
      { name: "servicio", label: "servicio", type: "string", required: false },
    ]);
  });

  it("no duplica un token repetido", () => {
    expect(autoDetectParameters("<x> <x>")).toHaveLength(1);
  });
});
