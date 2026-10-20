import { describe, expect, it } from "vitest";

import { slugify } from "@/lib/slugify";

describe("slugify", () => {
  it("pasa a minúsculas y une las palabras con guiones", () => {
    expect(slugify("Listar máquinas virtuales")).toBe("listar-maquinas-virtuales");
  });

  it("quita los acentos y la eñe se vuelve n", () => {
    expect(slugify("Año de creación")).toBe("ano-de-creacion");
  });

  it("colapsa los separadores y recorta los de los extremos", () => {
    expect(slugify("  --Hola___mundo!!  ")).toBe("hola-mundo");
  });

  it("conserva los números", () => {
    expect(slugify("Azure CLI 2.0")).toBe("azure-cli-2-0");
  });

  it("cae en 'comando' cuando no queda nada utilizable", () => {
    expect(slugify("¡!¿?")).toBe("comando");
    expect(slugify("")).toBe("comando");
    expect(slugify("   ")).toBe("comando");
  });

  it("es idempotente: volver a aplicarlo no cambia el resultado", () => {
    const una = slugify("Crear un Recovery Services Vault");
    expect(slugify(una)).toBe(una);
  });
});
