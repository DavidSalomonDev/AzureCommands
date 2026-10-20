import { describe, expect, it } from "vitest";

import {
  CATALOG_SECTIONS,
  SHELL_BY_SECTION,
  commandId,
  isCatalogSection,
  scriptId,
  sectionForId,
} from "@/lib/catalog";

/**
 * "Favoritos" decides which catalog files to download from the ids alone, so
 * the id built by the loaders and the section read back from it have to agree.
 * If they drift, favorites silently stop resolving.
 */
describe("ida y vuelta entre id y sección", () => {
  it("devuelve la sección de un comando de cada shell", () => {
    expect(sectionForId(commandId("azurecli", "group-list"))).toBe("cli");
    expect(sectionForId(commandId("powershell", "get-azvm"))).toBe("powershell");
  });

  it("devuelve 'scripts' para un script", () => {
    expect(sectionForId(scriptId("backup-vms"))).toBe("scripts");
  });

  it("cubre todas las secciones declaradas", () => {
    const cubiertas = new Set([
      ...Object.entries(SHELL_BY_SECTION).map(([, shell]) =>
        sectionForId(commandId(shell, "x"))
      ),
      sectionForId(scriptId("x")),
    ]);
    expect([...cubiertas].sort()).toEqual([...CATALOG_SECTIONS].sort());
  });

  it("devuelve null para un comando propio, que vive en localStorage", () => {
    expect(sectionForId("8f14e45f-ceea-467a-9c4e-6b1a0a4f0f1c")).toBeNull();
    expect(sectionForId("")).toBeNull();
  });

  it("no confunde un shell sin sección propia con uno que la tiene", () => {
    expect(sectionForId(commandId("terraform", "algo"))).toBeNull();
    expect(sectionForId(commandId("bash", "algo"))).toBeNull();
  });

  it("no toma por script un id que sólo contiene la palabra", () => {
    expect(sectionForId("mi-script-propio")).toBeNull();
  });
});

describe("isCatalogSection", () => {
  it("acepta las secciones reales y rechaza el resto", () => {
    expect(CATALOG_SECTIONS.every(isCatalogSection)).toBe(true);
    expect(isCatalogSection("inventada")).toBe(false);
    expect(isCatalogSection("../../etc/passwd")).toBe(false);
  });
});
