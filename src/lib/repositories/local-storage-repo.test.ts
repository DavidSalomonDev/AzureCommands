// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LocalStorageUserCommandsRepository,
  StorageWriteError,
} from "@/lib/repositories/local-storage-repo";
import type { NewCommandInput } from "@/lib/repositories/types";

const STORAGE_KEY = "azure-commands:user-commands:v1";

function input(extra: Partial<NewCommandInput> = {}): NewCommandInput {
  return {
    slug: "reiniciar-nginx",
    title: "Reiniciar nginx",
    description: "",
    shell: "bash",
    category: "Servidores",
    template: "systemctl restart <servicio>",
    parameters: [],
    ...extra,
  };
}

let repo: LocalStorageUserCommandsRepository;

beforeEach(() => {
  window.localStorage.clear();
  repo = new LocalStorageUserCommandsRepository();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ciclo de vida de un comando", () => {
  it("crea, lee, actualiza y borra", () => {
    const created = repo.create(input());
    expect(created.id).toBeTruthy();
    expect(created.source).toBe("user");
    expect(repo.list()).toHaveLength(1);

    const updated = repo.update(created.id, { title: "Otro título" });
    expect(updated?.title).toBe("Otro título");
    expect(repo.get(created.id)?.title).toBe("Otro título");

    repo.remove(created.id);
    expect(repo.list()).toEqual([]);
  });

  it("da un id distinto a cada comando", () => {
    const ids = [repo.create(input()).id, repo.create(input()).id];
    expect(new Set(ids).size).toBe(2);
  });

  it("devuelve undefined al actualizar algo que no existe", () => {
    expect(repo.update("no-existe", { title: "x" })).toBeUndefined();
  });

  it("ignora un contenido corrupto en localStorage en vez de reventar", () => {
    window.localStorage.setItem(STORAGE_KEY, "{no es json");
    expect(repo.list()).toEqual([]);

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([{ falta: "todo" }]));
    expect(repo.list()).toEqual([]);
  });
});

describe("cuando el navegador rechaza la escritura", () => {
  function refuseWrites() {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("cuota agotada", "QuotaExceededError");
    });
  }

  it("lanza StorageWriteError al crear, con un mensaje para la UI", () => {
    refuseWrites();
    expect(() => repo.create(input())).toThrow(StorageWriteError);
    expect(() => repo.create(input())).toThrow(/almacenamiento/i);
  });

  it("lo devuelve como error de importación, no como excepción", () => {
    const bundle = { app: "azure-commands", version: 1, exportedAt: "", commands: [] };
    refuseWrites();
    const result = repo.importAll(bundle, "replace");
    expect(result.imported).toBe(0);
    expect(result.errors[0]).toMatch(/almacenamiento/i);
  });
});

describe("exportar e importar", () => {
  it("exporta un paquete que se puede volver a importar", () => {
    repo.create(input({ title: "Uno" }));
    repo.create(input({ title: "Dos" }));
    const bundle = repo.exportAll();

    repo.clear();
    expect(repo.importAll(bundle, "merge").imported).toBe(2);
    expect(repo.list().map((c) => c.title)).toEqual(["Uno", "Dos"]);
  });

  it("'merge' conserva lo que ya había", () => {
    repo.create(input({ title: "Existente" }));
    const bundle = { ...repo.exportAll(), commands: [] };
    const otro = new LocalStorageUserCommandsRepository();
    otro.importAll({ ...bundle, commands: [repo.list()[0]] }, "merge");

    expect(repo.list()).toHaveLength(2);
  });

  it("'merge' renumera los ids que chocan en vez de pisarlos", () => {
    const existente = repo.create(input({ title: "Existente" }));
    repo.importAll([{ ...existente, title: "Entrante" }], "merge");

    const titulos = repo.list().map((c) => c.title);
    expect(titulos).toEqual(["Existente", "Entrante"]);
    expect(new Set(repo.list().map((c) => c.id)).size).toBe(2);
  });

  it("'replace' sustituye todo el contenido", () => {
    repo.create(input({ title: "Viejo" }));
    const entrante = { ...repo.list()[0], id: "otro", title: "Nuevo" };
    repo.importAll([entrante], "replace");

    expect(repo.list().map((c) => c.title)).toEqual(["Nuevo"]);
  });

  it("acepta un array pelado de comandos, no sólo el paquete completo", () => {
    expect(repo.importAll([{ ...repo.create(input()) }], "replace").imported).toBe(1);
  });

  it("acepta comandos escritos a mano sin id ni source", () => {
    const aMano = [
      {
        slug: "x",
        title: "A mano",
        description: "",
        shell: "bash",
        category: "c",
        template: "echo hola",
      },
    ];
    expect(repo.importAll(aMano, "replace").imported).toBe(1);
    expect(repo.list()[0].id).toBeTruthy();
  });

  it("rechaza lo que no tiene forma de comandos", () => {
    for (const basura of [null, 42, "texto", { cualquier: "cosa" }]) {
      const result = repo.importAll(basura, "merge");
      expect(result.imported).toBe(0);
      expect(result.errors).toHaveLength(1);
    }
  });

  it("marca como 'user' lo importado aunque venga como 'library'", () => {
    const comando = { ...repo.create(input()), source: "library" as const };
    repo.importAll([comando], "replace");
    expect(repo.list()[0].source).toBe("user");
  });
});

/**
 * Las notas de la biblioteca se pintan con dangerouslySetInnerHTML, así que
 * un archivo importado no puede traer `notesHtml`: el esquema descarta las
 * claves que no declara. Si alguien cambiase eso, esta prueba lo avisa.
 */
describe("un archivo importado no puede inyectar HTML", () => {
  it("descarta notesHtml del comando entrante", () => {
    const malicioso = {
      ...repo.create(input()),
      notesHtml: "<img src=x onerror=alert(1)>",
    };
    repo.importAll([malicioso], "replace");

    const guardado = repo.list()[0] as unknown as Record<string, unknown>;
    expect(guardado.notesHtml).toBeUndefined();
    expect(JSON.stringify(repo.list())).not.toContain("onerror");
  });

  it("conserva notes como texto plano, que la UI no interpreta", () => {
    repo.importAll([{ ...repo.create(input()), notes: "<b>negrita</b>" }], "replace");
    expect(repo.list()[0].notes).toBe("<b>negrita</b>");
  });
});
