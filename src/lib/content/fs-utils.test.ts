import { describe, expect, it } from "vitest";

import { markdownToHtml } from "@/lib/content/fs-utils";

describe("markdownToHtml", () => {
  it("convierte el Markdown que usan las notas", async () => {
    const html = await markdownToHtml(
      "Texto con **negrita**, `código` y un [enlace](https://learn.microsoft.com)."
    );
    expect(html).toContain("<strong>negrita</strong>");
    expect(html).toContain("<code>código</code>");
    expect(html).toContain('href="https://learn.microsoft.com"');
  });

  it("admite listas y tablas de GFM", async () => {
    expect(await markdownToHtml("- uno\n- dos")).toContain("<li>uno</li>");
    expect(await markdownToHtml("| a | b |\n| - | - |\n| 1 | 2 |")).toContain("<table>");
  });

  it("devuelve cadena vacía cuando no hay cuerpo", async () => {
    expect(await markdownToHtml("")).toBe("");
    expect(await markdownToHtml("   \n  ")).toBe("");
  });

  /**
   * Las notas se pintan con dangerouslySetInnerHTML. El contenido es del
   * propio repositorio, pero saneamos igual para que tener commit en
   * `content/` no implique poder ejecutar scripts en la app.
   */
  describe("sanea el HTML crudo", () => {
    it("quita las etiquetas script", async () => {
      const html = await markdownToHtml("Antes\n\n<script>alert(1)</script>\n\nDespués");
      expect(html).not.toContain("<script");
      expect(html).not.toContain("alert(1)");
    });

    it("quita los manejadores de eventos en línea", async () => {
      const html = await markdownToHtml('<img src="x" onerror="alert(1)">');
      expect(html).not.toContain("onerror");
    });

    it("quita los iframes", async () => {
      const html = await markdownToHtml('<iframe src="https://example.com"></iframe>');
      expect(html).not.toContain("<iframe");
    });

    it("no deja pasar un enlace javascript:", async () => {
      const html = await markdownToHtml("[pulsa](javascript:alert(1))");
      expect(html).not.toContain("javascript:");
    });
  });
});
