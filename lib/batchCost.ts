import InventoryItem from "./models/InventoryItem";
import type { ProductionBatchDoc } from "./models/ProductionBatch";
import type { StockMovementDoc } from "./models/StockMovement";

export function normalizeBatch(doc: ProductionBatchDoc) {
  const { _id, createdAt, updatedAt, ...rest } = doc as ProductionBatchDoc & { __v?: number };
  delete (rest as Record<string, unknown>).__v;
  return { id: _id, ...rest };
}

export function normalizeMovement(doc: StockMovementDoc) {
  const { _id, createdAt, updatedAt, ...rest } = doc as StockMovementDoc & { __v?: number };
  delete (rest as Record<string, unknown>).__v;
  return { id: _id, ...rest };
}

// Shared by app/api/inventory/batches/route.ts (create) and
// app/api/inventory/batches/[id]/route.ts (edit/delete) so both keep
// inventory stock and cost math in sync the same way.

export interface ResolvedMixLine {
  itemId: string;
  label: string;
  unit: string;
  quantity: number;
  costPerUnit: number;
  materialCost: number;
}

export interface ResolvedTransportLine {
  itemId: string;
  label: string;
  amount: number;
}

/**
 * Deducts each mix line's quantity from inventory and returns the resolved
 * (snapshotted) lines. Throws if a referenced material doesn't exist.
 */
export async function deductMix(
  mixInput: { itemId: string; quantity: number }[]
): Promise<ResolvedMixLine[]> {
  const resolvedMix: ResolvedMixLine[] = [];
  for (const line of mixInput) {
    const qty = Number(line.quantity);
    const item = await InventoryItem.findByIdAndUpdate(
      line.itemId,
      { $inc: { currentStock: -qty } },
      { new: false } // pre-update doc, so we snapshot costPerUnit/label as they were
    ).lean();
    if (!item) {
      throw new Error(`Unknown material: ${line.itemId}`);
    }
    const costPerUnit = Number((item as { costPerUnit?: number }).costPerUnit ?? 0);
    resolvedMix.push({
      itemId: line.itemId,
      label: (item as { label: string }).label,
      unit: (item as { unit: string }).unit,
      quantity: qty,
      costPerUnit,
      materialCost: Math.round(qty * costPerUnit * 100) / 100,
    });
  }
  return resolvedMix;
}

/** Reverses a previously-deducted mix (adds each line's quantity back). */
export async function restoreMix(mix: { itemId: string; quantity: number }[]): Promise<void> {
  for (const line of mix) {
    await InventoryItem.findByIdAndUpdate(line.itemId, { $inc: { currentStock: line.quantity } });
  }
}

/** Resolves transport line labels against an already-resolved mix. */
export function resolveTransport(
  transportInput: { itemId: string; amount: number }[],
  resolvedMix: ResolvedMixLine[]
): ResolvedTransportLine[] {
  const resolved: ResolvedTransportLine[] = [];
  for (const t of transportInput ?? []) {
    if (!t || !t.itemId) continue;
    const amount = Number(t.amount) || 0;
    if (amount <= 0) continue;
    const matched = resolvedMix.find((m) => m.itemId === t.itemId);
    resolved.push({ itemId: t.itemId, label: matched?.label ?? t.itemId, amount });
  }
  return resolved;
}

/** Total cost + cost/tube for a batch given its resolved mix/transport + flat costs. */
export function computeTotals(
  resolvedMix: ResolvedMixLine[],
  resolvedTransport: ResolvedTransportLine[],
  baggingCost: number,
  plasticBagCost: number,
  sterilizationCost: number,
  tubeCount: number
) {
  const materialsTotal = resolvedMix.reduce((s, m) => s + m.materialCost, 0);
  const transportTotal = resolvedTransport.reduce((s, t) => s + t.amount, 0);
  const totalCost =
    Math.round((materialsTotal + transportTotal + baggingCost + plasticBagCost + sterilizationCost) * 100) / 100;
  const costPerTube = tubeCount > 0 ? Math.round((totalCost / tubeCount) * 100) / 100 : 0;
  return { totalCost, costPerTube };
}
