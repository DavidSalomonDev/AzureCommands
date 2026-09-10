"use client";

import { OPERATION_LABELS, compareOperations } from "@/lib/operations";
import type { CrudOperation } from "@/lib/types";

/**
 * Groups items by category (producto) and, inside each one, by CRUD operation
 * in the fixed order consultar → crear → actualizar → eliminar → otras.
 */
export function groupByCategoryAndOperation<T>(
  items: T[],
  getCategory: (item: T) => string,
  getOperation: (item: T) => CrudOperation
): { category: string; groups: { operation: CrudOperation; items: T[] }[] }[] {
  const byCategory = new Map<string, Map<CrudOperation, T[]>>();

  for (const item of items) {
    const category = getCategory(item);
    const operation = getOperation(item);
    const operations = byCategory.get(category) ?? new Map<CrudOperation, T[]>();
    operations.set(operation, [...(operations.get(operation) ?? []), item]);
    byCategory.set(category, operations);
  }

  return Array.from(byCategory.entries()).map(([category, operations]) => ({
    category,
    groups: Array.from(operations.entries())
      .map(([operation, groupItems]) => ({ operation, items: groupItems }))
      .sort((a, b) => compareOperations(a.operation, b.operation)),
  }));
}

export function OperationHeading({
  operation,
  count,
}: {
  operation: CrudOperation;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <h3 className="text-sm font-medium text-foreground">
        {OPERATION_LABELS[operation]}
      </h3>
      <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
