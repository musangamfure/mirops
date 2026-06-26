import type {
  InventoryItem, StockMovement, ProductionBatch, MovementType,
  MixLine, TransportLine,
} from "./inventory";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function parseJson<T>(res: Response): Promise<T> {
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.success) throw new Error(json.error || `Request failed (${res.status})`);
  return json.data as T;
}

export async function apiGetInventoryItems(): Promise<InventoryItem[]> {
  const res = await fetch("/api/inventory/items");
  return parseJson<InventoryItem[]>(res);
}

/** Creates a brand-new raw material (not part of the original seeded set). */
export async function apiCreateInventoryItem(item: {
  label: string;
  unit: string;
  costPerUnit?: number;
  reorderThreshold?: number;
  currentStock?: number;
}): Promise<InventoryItem> {
  const res = await fetch("/api/inventory/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });
  return parseJson<InventoryItem>(res);
}

export async function apiUpdateInventoryItem(
  id: string,
  patch: { reorderThreshold?: number; costPerUnit?: number }
): Promise<InventoryItem> {
  const res = await fetch("/api/inventory/items", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...patch }),
  });
  return parseJson<InventoryItem>(res);
}

export async function apiGetMovements(itemId?: string): Promise<StockMovement[]> {
  const url = itemId ? `/api/inventory/movements?itemId=${itemId}` : "/api/inventory/movements";
  const res = await fetch(url);
  return parseJson<StockMovement[]>(res);
}

/**
 * Records a stock_in, stock_out, or adjustment movement. `quantity` should
 * be the unsigned amount for stock_in/stock_out (the server applies the
 * correct sign); for adjustment, pass the signed delta directly (positive
 * to correct stock upward, negative to correct it downward).
 */
export async function apiAddMovement(movement: {
  id: string;
  itemId: string;
  type: MovementType;
  quantity: number;
  date: string;
  note?: string;
}): Promise<StockMovement> {
  const res = await fetch("/api/inventory/movements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(movement),
  });
  return parseJson<StockMovement>(res);
}

/**
 * Edits a manual movement (stock_in, stock_out, or adjustment). `quantity`
 * follows the same convention as apiAddMovement: unsigned for
 * stock_in/stock_out, signed directly for adjustment. Movements created by
 * a production batch can't be edited here — the server rejects those.
 */
export async function apiUpdateMovement(
  id: string,
  patch: { type?: "stock_in" | "stock_out" | "adjustment"; quantity?: number; date?: string; note?: string }
): Promise<StockMovement> {
  const res = await fetch(`/api/inventory/movements/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return parseJson<StockMovement>(res);
}

/** Deletes a manual movement and reverses its effect on currentStock. */
export async function apiDeleteMovement(id: string): Promise<{ id: string }> {
  const res = await fetch(`/api/inventory/movements/${id}`, { method: "DELETE" });
  return parseJson<{ id: string }>(res);
}

export async function apiGetBatches(): Promise<ProductionBatch[]> {
  const res = await fetch("/api/inventory/batches");
  return parseJson<ProductionBatch[]>(res);
}

export async function apiLogBatch(batch: {
  id: string;
  date: string;
  tubeCount: number;
  note?: string;
  mix: MixLine[];
  costs: {
    transport: TransportLine[];
    baggingCost: number;
    plasticBagCost: number;
    sterilizationCost: number;
  };
}): Promise<{ batch: ProductionBatch; movements: StockMovement[] }> {
  const res = await fetch("/api/inventory/batches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(batch),
  });
  return parseJson<{ batch: ProductionBatch; movements: StockMovement[] }>(res);
}

/** Edits a logged batch — re-derives stock and cost from the new mix/costs given. */
export async function apiUpdateBatch(
  id: string,
  batch: {
    date: string;
    tubeCount: number;
    note?: string;
    mix: MixLine[];
    costs: {
      transport: TransportLine[];
      baggingCost: number;
      plasticBagCost: number;
      sterilizationCost: number;
    };
  }
): Promise<{ batch: ProductionBatch; movements: StockMovement[] }> {
  const res = await fetch(`/api/inventory/batches/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(batch),
  });
  return parseJson<{ batch: ProductionBatch; movements: StockMovement[] }>(res);
}

/** Deletes a logged batch and restores the stock it consumed. */
export async function apiDeleteBatch(id: string): Promise<{ id: string }> {
  const res = await fetch(`/api/inventory/batches/${id}`, { method: "DELETE" });
  return parseJson<{ id: string }>(res);
}
