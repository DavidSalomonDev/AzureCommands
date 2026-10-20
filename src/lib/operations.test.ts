import { describe, expect, it } from "vitest";

import {
  OPERATION_ORDER,
  compareOperations,
  inferOperation,
  parseOperationParam,
  resolveOperation,
} from "@/lib/operations";
import type { Command } from "@/lib/types";

function command(extra: Partial<Command>): Command {
  return {
    id: "x",
    slug: "x",
    title: "x",
    description: "",
    shell: "azurecli",
    category: "c",
    template: "az vm list",
    parameters: [],
    source: "library",
    ...extra,
  };
}

describe("inferOperation con Azure CLI", () => {
  it.each([
    ["az vm list --output table", "read"],
    ["az group show --name <rg>", "read"],
    ["az storage account keys list -g <rg>", "read"],
    ["az vm create --name <vm>", "create"],
    ["az storage blob upload --file <f>", "create"],
    ["az vm update --set tags.x=1", "update"],
    ["az vm stop --name <vm>", "update"],
    ["az aks scale --node-count 3", "update"],
    ["az group delete --name <rg> --yes", "delete"],
    ["az keyvault secret purge --name <s>", "delete"],
  ])("%s → %s", (template, expected) => {
    expect(inferOperation(template, "azurecli")).toBe(expected);
  });

  it("toma la última palabra antes de la primera opción", () => {
    expect(inferOperation("az network vnet subnet list --vnet-name <v>", "azurecli")).toBe(
      "read"
    );
  });

  it("cae en 'other' cuando la acción no se reconoce", () => {
    expect(inferOperation("az vm inventar-cosas", "azurecli")).toBe("other");
  });

  it("cae en 'other' si no encuentra un comando az", () => {
    expect(inferOperation("kubectl get pods", "azurecli")).toBe("other");
  });

  it("usa los prefijos cuando no hay coincidencia exacta", () => {
    expect(inferOperation("az account list-locations", "azurecli")).toBe("read");
    expect(inferOperation("az vm create-many", "azurecli")).toBe("create");
  });
});

describe("inferOperation con PowerShell", () => {
  it.each([
    ["Get-AzVM -ResourceGroupName <rg>", "read"],
    ["New-AzResourceGroup -Name <rg>", "create"],
    ["Set-AzVM -Name <vm>", "update"],
    ["Remove-AzResourceGroup -Name <rg>", "delete"],
    ["Invoke-AzVMRunCommand -Name <vm>", "other"],
  ])("%s → %s", (template, expected) => {
    expect(inferOperation(template, "powershell")).toBe(expected);
  });

  it("encuentra el verbo aunque vaya dentro de una expresión", () => {
    expect(inferOperation("(Get-AzResourceGroup).Count", "powershell")).toBe("read");
    expect(inferOperation("$x = Get-AzVM -Name <vm>", "powershell")).toBe("read");
  });

  it("cae en 'other' si no hay un cmdlet Verbo-Az", () => {
    expect(inferOperation("Write-Host hola", "powershell")).toBe("other");
  });
});

describe("resolveOperation", () => {
  it("prefiere la operación declarada sobre la deducida", () => {
    // `az aks get-credentials` parece lectura, pero también escribe kubeconfig.
    const cmd = command({ template: "az aks get-credentials", operation: "update" });
    expect(resolveOperation(cmd)).toBe("update");
  });

  it("deduce cuando no hay operación declarada", () => {
    expect(resolveOperation(command({ template: "az vm list" }))).toBe("read");
  });
});

describe("compareOperations", () => {
  it("ordena consultar primero y 'otras acciones' al final", () => {
    const desordenadas = ["other", "delete", "read", "create", "update"] as const;
    expect([...desordenadas].sort(compareOperations)).toEqual(OPERATION_ORDER);
  });
});

describe("parseOperationParam", () => {
  it("acepta las operaciones conocidas", () => {
    expect(parseOperationParam("read")).toBe("read");
    expect(parseOperationParam("delete")).toBe("delete");
  });

  it("descarta cualquier otra cosa en vez de propagarla a la UI", () => {
    expect(parseOperationParam("inventado")).toBeNull();
    expect(parseOperationParam("")).toBeNull();
    expect(parseOperationParam(null)).toBeNull();
    expect(parseOperationParam("READ")).toBeNull();
  });
});
