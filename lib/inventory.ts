import { RAW_MATERIALS, type RawMaterialId } from "./constants";

// ─── TYPES ────────────────────────────────────────────────────────────────────
export interface InventoryItem {
  id: string;
  label: string;
  unit: string;
  currentStock: number;
  reorderThreshold: number;
  costPerUnit: number;
}

export type MovementType = "stock_in" | "stock_out" | "production_deduction" | "adjustment";

export interface StockMovement {
  id: string;
  itemId: string;
  type: MovementType;
  /** Signed quantity in the item's unit (positive = stock added). */
  quantity: number;
  date: string; // YYYY-MM-DD
  note: string;
  batchId?: string;
}

// A single line of a batch's free-form mix, as entered by the user
// (no fixed list — any inventory item, any quantity).
export interface MixLine {
  itemId: string;
  quantity: number;
}

// Same line after being resolved against inventory + snapshotted for
// storage (label/unit/costPerUnit captured at the time of the batch).
export interface ResolvedMixLine extends MixLine {
  label: string;
  unit: string;
  costPerUnit: number;
  materialCost: number; // quantity * costPerUnit
}

export interface TransportLine {
  itemId: string;
  amount: number;
}

export interface ResolvedTransportLine extends TransportLine {
  label: string;
}

export interface BatchCostsInput {
  transport: TransportLine[];
  baggingCost: number;
  plasticBagCost: number;
  sterilizationCost: number;
}

export interface ProductionBatch {
  id: string;
  date: string; // YYYY-MM-DD
  tubeCount: number;
  note: string;
  mix: ResolvedMixLine[];
  costs: {
    transport: ResolvedTransportLine[];
    baggingCost: number;
    plasticBagCost: number;
    sterilizationCost: number;
  };
  totalCost: number;
  costPerTube: number;
}

// ─── FREE-FORM MIX HELPERS ────────────────────────────────────────────────────
/**
 * Given the free-form mix lines a user entered for a batch and the current
 * inventory snapshot, reports which materials don't have enough stock to
 * cover the batch — used to warn before logging a batch that would push
 * stock negative.
 */
export function checkMixFeasibility(
  mix: MixLine[],
  items: InventoryItem[]
): { itemId: string; shortfall: number }[] {
  const shortfalls: { itemId: string; shortfall: number }[] = [];
  for (const line of mix) {
    if (line.quantity <= 0) continue;
    const item = items.find((i) => i.id === line.itemId);
    const available = item?.currentStock ?? 0;
    if (available < line.quantity) {
      shortfalls.push({ itemId: line.itemId, shortfall: line.quantity - available });
    }
  }
  return shortfalls;
}

/** quantity * item.costPerUnit for a single mix line, using current inventory data. */
export function lineMaterialCost(line: MixLine, items: InventoryItem[]): number {
  const item = items.find((i) => i.id === line.itemId);
  return Math.round((line.quantity * (item?.costPerUnit ?? 0)) * 100) / 100;
}

/** Sum of materialCost across all mix lines (raw material cost for the batch). */
export function totalMaterialCost(mix: { materialCost: number }[]): number {
  return Math.round(mix.reduce((sum, m) => sum + m.materialCost, 0) * 100) / 100;
}

/** Full cost breakdown total: raw materials + transport + bagging + plastic bag + sterilization. */
export function computeBatchTotalCost(
  mix: { materialCost: number }[],
  costs: BatchCostsInput
): number {
  const materials = totalMaterialCost(mix);
  const transport = costs.transport.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  return (
    Math.round(
      (materials + transport + (Number(costs.baggingCost) || 0) +
        (Number(costs.plasticBagCost) || 0) + (Number(costs.sterilizationCost) || 0)) * 100
    ) / 100
  );
}

export function computeCostPerTube(totalCost: number, tubeCount: number): number {
  if (!tubeCount || tubeCount <= 0) return 0;
  return Math.round((totalCost / tubeCount) * 100) / 100;
}

// ─── DERIVED STATE ────────────────────────────────────────────────────────────
export function isLowStock(item: InventoryItem): boolean {
  return item.reorderThreshold > 0 && item.currentStock <= item.reorderThreshold;
}

export function isOutOfStock(item: InventoryItem): boolean {
  return item.currentStock <= 0;
}

export function materialLabel(id: RawMaterialId): string {
  return RAW_MATERIALS.find((m) => m.id === id)?.label ?? id;
}

export function materialUnit(id: RawMaterialId): string {
  return RAW_MATERIALS.find((m) => m.id === id)?.unit ?? "";
}

export function materialEmoji(id: RawMaterialId): string {
  return RAW_MATERIALS.find((m) => m.id === id)?.emoji ?? "📦";
}
