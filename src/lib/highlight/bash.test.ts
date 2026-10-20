import { promises as fs } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { tokenizeBash, type CodeToken } from "@/lib/highlight/bash";

/**
 * The tokenizer only adds colour, so it must never change the code: putting
 * the tokens back together has to give the exact input again, with each
 * `<param>` rewrapped in its angle brackets.
 */
function reconstruct(tokens: CodeToken[]): string {
  return tokens.map((t) => (t.type === "param" ? `<${t.value}>` : t.value)).join("");
}

function expectRoundTrip(code: string) {
  expect(reconstruct(tokenizeBash(code))).toBe(code);
}

/** The coloured tokens, dropping the plain text in between. */
function coloured(code: string): [string, string][] {
  return tokenizeBash(code)
    .filter((t) => t.type !== "plain")
    .map((t) => [t.type, t.value]);
}

function find(code: string, value: string): string | undefined {
  return tokenizeBash(code).find((t) => t.value === value)?.type;
}

describe("tokenizeBash: no pierde ni altera el código", () => {
  const snippets: [string, string][] = [
    ["vacío", ""],
    ["comando simple", "az vm list --output table"],
    ["comentario", "# un comentario con <signos> y $cosas\naz vm list"],
    ["comillas simples", "echo 'texto $sin expandir'"],
    ["comillas dobles", 'echo "hola $USER y ${OTRA}"'],
    ["sustitución de comando", "VMS=$(az vm list --query '[].name' -o tsv)"],
    ["aritmética", "TOTAL=$(( COUNT + 1 ))"],
    ["continuación de línea", "az vm list \\\n  --output table"],
    ["heredoc expandido", "cat <<EOF\nvalor: $HOME\nEOF\n"],
    ["heredoc literal", "cat <<'EOF'\nvalor: $HOME sin expandir\nEOF\n"],
    ["redirección y proceso", "while read -r l; do echo $l; done < <(az vm list)"],
    ["rutas y archivos", "bash ./scripts/mana-vms.sh --out /tmp/a.csv"],
    ["función", "mifunc() {\n  echo hola\n}\nmifunc"],
    ["placeholders sueltos", "az vm start --name <vm> --resource-group <rg>"],
    ["placeholder en cadena", 'SUB="<subscriptionId>"'],
    ["escapes", 'echo "comilla \\" dentro"'],
    ["comilla sin cerrar", "echo 'sin cerrar"],
    ["heredoc sin cerrar", "cat <<EOF\nnunca termina"],
    ["unicode y acentos", '# Año de creación\necho "configuración"'],
    ["CRLF ya normalizado", "a=1\nb=2\n"],
  ];

  it.each(snippets)("%s", (_name, code) => {
    expectRoundTrip(code);
  });

  it("también con cada script real del catálogo", async () => {
    const dir = path.join(process.cwd(), "content", "scripts");
    const names = (await fs.readdir(dir)).filter((n) => n.endsWith(".sh"));

    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      const code = (await fs.readFile(path.join(dir, name), "utf8")).replace(
        /\r\n/g,
        "\n"
      );
      expect(reconstruct(tokenizeBash(code)), `round-trip de ${name}`).toBe(code);
    }
  });
});

describe("tokenizeBash: clasificación", () => {
  it("colorea el comando, sus flags y deja los subcomandos en plano", () => {
    expect(coloured("az vm list --output table")).toEqual([
      ["command", "az"],
      ["flag", "--output"],
    ]);
  });

  it("distingue builtins de comandos externos", () => {
    expect(find("echo hola", "echo")).toBe("builtin");
    expect(find("curl https://example.com", "curl")).toBe("command");
  });

  it("reconoce palabras clave de control de flujo", () => {
    expect(find("if [ -z \"$x\" ]; then", "if")).toBe("keyword");
    expect(find("for i in 1 2 3; do", "for")).toBe("keyword");
  });

  it("marca el comentario completo hasta el fin de línea", () => {
    const tokens = tokenizeBash("az vm list # lista las VMs\naz vm show");
    expect(tokens.find((t) => t.type === "comment")?.value).toBe("# lista las VMs");
  });

  it("no toma por comentario una almohadilla dentro de una palabra", () => {
    expect(tokenizeBash("echo a#b").some((t) => t.type === "comment")).toBe(false);
  });

  it("saca las variables de dentro de las comillas dobles", () => {
    expect(coloured('echo "hola $USER"')).toEqual([
      ["builtin", "echo"],
      ["string", '"hola '],
      ["variable", "$USER"],
      ["string", '"'],
    ]);
  });

  it("no expande nada dentro de comillas simples", () => {
    expect(coloured("echo '$USER'")).toEqual([
      ["builtin", "echo"],
      ["string", "'$USER'"],
    ]);
  });

  it("entiende ${...} y $(...) anidados", () => {
    expect(find("echo ${VAR:-por-defecto}", "${VAR:-por-defecto}")).toBe("variable");
    expect(coloured("X=$(az vm list)").map(([type]) => type)).toContain("command");
  });

  it("colorea la declaración de una función y también sus llamadas", () => {
    const code = "respaldar() {\n  echo hola\n}\n\nrespaldar";
    const funciones = tokenizeBash(code).filter((t) => t.type === "function");
    expect(funciones.map((t) => t.value)).toEqual(["respaldar", "respaldar"]);
  });

  it("trata VAR= como variable, pero no el argumento de otro comando", () => {
    expect(find("RETENTION=30", "RETENTION")).toBe("variable");
    expect(find("local X=1", "X")).toBe("variable");
    expect(find("alias ls=ls", "ls")).not.toBe("variable");
  });

  it("emite los placeholders como piezas propias, con sólo su nombre", () => {
    const params = tokenizeBash('az vm start --name <vm> --subscription "<subId>"')
      .filter((t) => t.type === "param")
      .map((t) => t.value);
    expect(params).toEqual(["vm", "subId"]);
  });

  it("no confunde una redirección con un placeholder", () => {
    const params = tokenizeBash("sort < entrada.txt > salida.txt").filter(
      (t) => t.type === "param"
    );
    expect(params).toEqual([]);
  });

  it("no expande el cuerpo de un heredoc con delimitador citado", () => {
    const tokens = tokenizeBash("cat <<'EOF'\n$HOME\nEOF\n");
    expect(tokens.some((t) => t.type === "variable")).toBe(false);
  });

  it("sí lo expande cuando el delimitador va sin comillas", () => {
    const tokens = tokenizeBash("cat <<EOF\n$HOME\nEOF\n");
    expect(tokens.some((t) => t.type === "variable" && t.value === "$HOME")).toBe(true);
  });
});
