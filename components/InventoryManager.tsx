"use client";

import { useState, useEffect, useCallback } from "react";
import { RAW_MATERIALS, type RawMaterialId } from "@/lib/constants";
import type { InventoryItem, StockMovement, ProductionBatch, MixLine, TransportLine } from "@/lib/inventory";
import { isLowStock, isOutOfStock, checkMixFeasibility } from "@/lib/inventory";
import {
  apiGetInventoryItems, apiUpdateInventoryItem,
  apiGetMovements, apiAddMovement, apiUpdateMovement, apiDeleteMovement,
  apiGetBatches, apiLogBatch, apiUpdateBatch, apiDeleteBatch, apiCreateInventoryItem,
} from "@/lib/inventoryApi";
import { todayStr, makeId, fmt as fmtMoney } from "@/lib/store";

// ── Shared style tokens (matches the rest of the app) ────────────
const labelSt: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#9ab89a",
  textTransform: "uppercase", letterSpacing: 0.9,
  marginBottom: 6, display: "block",
};

const selStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", background: "#162214",
  border: "1px solid #2d4a2d", borderRadius: 8, color: "#c8e6c9",
  fontSize: 13, fontFamily: "Georgia, serif", cursor: "pointer",
  appearance: "none" as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236a9c6a' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", paddingRight: 32,
};

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "#111e0f", borderRadius: 14, padding: "18px 20px",
      border: "1px solid #1e3320", ...style,
    }}>{children}</div>
  );
}

function fmt(n: number, unit: string): string {
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${unit}`;
}

// ── Small "⋮" actions menu (used to wrap edit/delete for a row) ────
function DotsMenu({
  open, onToggle, onClose, items,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  items: { label: string; onClick: () => void; danger?: boolean; disabled?: boolean }[];
}) {
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={onToggle}
        style={{
          width: 26, height: 26, borderRadius: 7, border: "1px solid #2d4a2d",
          background: "#162214", color: "#9ab89a", fontSize: 14, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >⋮</button>
      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 998 }}
            onClick={onClose}
          />
          <div style={{
            position: "absolute", right: 0, top: 30, zIndex: 999,
            background: "#162214", border: "1px solid #2d4a2d", borderRadius: 10,
            minWidth: 140, boxShadow: "0 12px 30px rgba(0,0,0,0.5)", overflow: "hidden",
          }}>
            {items.map((it) => (
              <button
                key={it.label}
                onClick={() => { if (!it.disabled) { it.onClick(); onClose(); } }}
                disabled={it.disabled}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "9px 14px", border: "none", background: "transparent",
                  color: it.disabled ? "#3a5c3a" : it.danger ? "#f87171" : "#c8e6c9",
                  fontSize: 12, fontWeight: 600, cursor: it.disabled ? "default" : "pointer",
                  fontFamily: "Georgia, serif",
                }}
              >{it.label}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
// ── Stock Movement Modal (Stock In / Stock Out / Adjustment) ────
function MovementModal({
  item, onSave, onCancel,
}: {
  item: InventoryItem;
  onSave: (movement: { type: "stock_in" | "stock_out" | "adjustment"; quantity: number; date: string; note: string }) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<"stock_in" | "stock_out" | "adjustment">("stock_in");
  const [quantity, setQuantity] = useState("");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  function handleSave() {
    const q = Number(quantity);
    if (!quantity || isNaN(q) || q <= 0) {
      setError("Enter a valid quantity greater than 0");
      return;
    }
    if (type === "stock_out" && q > item.currentStock) {
      setError(`Only ${fmt(item.currentStock, item.unit)} available — cannot remove more than that`);
      return;
    }
    onSave({ type, quantity: q, date, note: note.trim() });
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)",
      zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div style={{
        background: "#111e0f", border: "1px solid #2d4a2d",
        borderRadius: 16, maxWidth: 420, width: "100%",
        padding: 28, boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: "bold", color: "#c8e6c9" }}>📦 Stock Movement</div>
            <div style={{ fontSize: 12, color: "#6a9c6a", marginTop: 2 }}>{item.label}</div>
          </div>
          <button onClick={onCancel} style={{
            width: 30, height: 30, borderRadius: "50%", border: "none",
            background: "#1e3320", color: "#c8e6c9", fontSize: 18, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelSt}>Movement Type</label>
          <select
            value={type}
            onChange={(e) => { setType(e.target.value as typeof type); setError(""); }}
            style={selStyle}
          >
            <option value="stock_in">📥 Stock In (delivery / purchase)</option>
            <option value="stock_out">📤 Stock Out (used outside production)</option>
            <option value="adjustment">⚖️ Adjustment (correct a miscount)</option>
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelSt}>
            {type === "adjustment" ? `New count (currently ${fmt(item.currentStock, item.unit)})` : `Quantity (${item.unit})`}
          </label>
          <input
            type="number" min="0" step="0.01" placeholder="0"
            value={quantity}
            onChange={(e) => { setQuantity(e.target.value); setError(""); }}
            style={{ fontSize: 18, fontWeight: 700, color: "#c8e6c9" }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelSt}>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelSt}>Note (optional)</label>
          <input
            type="text" placeholder="e.g. Delivery from Kigali Cotton Co."
            value={note} onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {error && (
          <div style={{
            background: "#2a0a0a", color: "#f87171", borderRadius: 10,
            padding: "10px 14px", fontSize: 13, fontWeight: 600,
            marginBottom: 16, border: "1px solid #7f1d1d",
          }}>⚠ {error}</div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: 12, borderRadius: 10,
            border: "1px solid #2d4a2d", background: "transparent",
            color: "#9ab89a", fontSize: 14, cursor: "pointer", fontFamily: "Georgia, serif",
          }}>Cancel</button>
          <button onClick={handleSave} style={{
            flex: 2, padding: 12, borderRadius: 10, border: "none",
            background: "#4a7c59", color: "white", fontSize: 14,
            fontWeight: "bold", cursor: "pointer", fontFamily: "Georgia, serif",
          }}>Save Movement</button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Stock Movement Modal ─────────────────────────────────────
// Used for editing an existing manual movement (stock_in, stock_out, or
// adjustment). Movements created by a production batch can't reach this
// modal — the dots menu disables Edit/Delete for those.
function EditMovementModal({
  movement, itemLabel, itemUnit, onSave, onCancel,
}: {
  movement: StockMovement;
  itemLabel: string;
  itemUnit: string;
  onSave: (patch: { type: "stock_in" | "stock_out" | "adjustment"; quantity: number; date: string; note: string }) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<"stock_in" | "stock_out" | "adjustment">(
    movement.type === "production_deduction" ? "adjustment" : movement.type
  );
  // For stock_in/out the field holds an unsigned amount; for adjustment it
  // holds the signed delta directly (matching how it's stored).
  const [quantity, setQuantity] = useState(
    type === "adjustment" ? String(movement.quantity) : String(Math.abs(movement.quantity))
  );
  const [date, setDate] = useState(movement.date);
  const [note, setNote] = useState(movement.note ?? "");
  const [error, setError] = useState("");

  function handleSave() {
    const q = Number(quantity);
    if (quantity === "" || isNaN(q)) {
      setError("Enter a valid quantity");
      return;
    }
    if (type !== "adjustment" && q <= 0) {
      setError("Enter a quantity greater than 0");
      return;
    }
    onSave({ type, quantity: q, date, note: note.trim() });
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)",
      zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div style={{
        background: "#111e0f", border: "1px solid #2d4a2d",
        borderRadius: 16, maxWidth: 420, width: "100%",
        padding: 28, boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: "bold", color: "#c8e6c9" }}>✎ Edit Movement</div>
            <div style={{ fontSize: 12, color: "#6a9c6a", marginTop: 2 }}>{itemLabel}</div>
          </div>
          <button onClick={onCancel} style={{
            width: 30, height: 30, borderRadius: "50%", border: "none",
            background: "#1e3320", color: "#c8e6c9", fontSize: 18, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelSt}>Movement Type</label>
          <select
            value={type}
            onChange={(e) => { setType(e.target.value as typeof type); setError(""); }}
            style={selStyle}
          >
            <option value="stock_in">📥 Stock In (delivery / purchase)</option>
            <option value="stock_out">📤 Stock Out (used outside production)</option>
            <option value="adjustment">⚖️ Adjustment (signed correction)</option>
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelSt}>
            {type === "adjustment" ? `Adjustment amount (${itemUnit}, use − for a downward correction)` : `Quantity (${itemUnit})`}
          </label>
          <input
            type="number" step="0.01" placeholder="0"
            value={quantity}
            onChange={(e) => { setQuantity(e.target.value); setError(""); }}
            style={{ fontSize: 18, fontWeight: 700, color: "#c8e6c9" }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelSt}>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelSt}>Note (optional)</label>
          <input
            type="text" placeholder="e.g. Delivery from Kigali Cotton Co."
            value={note} onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {error && (
          <div style={{
            background: "#2a0a0a", color: "#f87171", borderRadius: 10,
            padding: "10px 14px", fontSize: 13, fontWeight: 600,
            marginBottom: 16, border: "1px solid #7f1d1d",
          }}>⚠ {error}</div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: 12, borderRadius: 10,
            border: "1px solid #2d4a2d", background: "transparent",
            color: "#9ab89a", fontSize: 14, cursor: "pointer", fontFamily: "Georgia, serif",
          }}>Cancel</button>
          <button onClick={handleSave} style={{
            flex: 2, padding: 12, borderRadius: 10, border: "none",
            background: "#4a7c59", color: "white", fontSize: 14,
            fontWeight: "bold", cursor: "pointer", fontFamily: "Georgia, serif",
          }}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm Delete Modal (generic) ────────────────────────────────
function ConfirmModal({
  title, message, onConfirm, onCancel,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)",
      zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div style={{
        background: "#111e0f", border: "1px solid #2d4a2d",
        borderRadius: 16, maxWidth: 380, width: "100%",
        padding: 28, boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
      }}>
        <div style={{ fontSize: 16, fontWeight: "bold", color: "#c8e6c9", marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 13, color: "#9ab89a", marginBottom: 22 }}>{message}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: 12, borderRadius: 10,
            border: "1px solid #2d4a2d", background: "transparent",
            color: "#9ab89a", fontSize: 14, cursor: "pointer", fontFamily: "Georgia, serif",
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: 12, borderRadius: 10, border: "none",
            background: "#b91c1c", color: "white", fontSize: 14,
            fontWeight: "bold", cursor: "pointer", fontFamily: "Georgia, serif",
          }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── New Raw Material Modal ───────────────────────────────────────
function NewMaterialModal({
  onSave, onCancel,
}: {
  onSave: (item: { label: string; unit: string; costPerUnit: number; reorderThreshold: number }) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState("");
  const [unit, setUnit] = useState("kg");
  const [costPerUnit, setCostPerUnit] = useState("");
  const [reorderThreshold, setReorderThreshold] = useState("");
  const [error, setError] = useState("");

  function handleSave() {
    if (!label.trim()) {
      setError("Enter a material name");
      return;
    }
    if (!unit.trim()) {
      setError("Enter a unit (e.g. kg, L, pcs)");
      return;
    }
    onSave({
      label: label.trim(),
      unit: unit.trim(),
      costPerUnit: Number(costPerUnit) || 0,
      reorderThreshold: Number(reorderThreshold) || 0,
    });
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)",
      zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div style={{
        background: "#111e0f", border: "1px solid #2d4a2d",
        borderRadius: 16, maxWidth: 380, width: "100%",
        padding: 28, boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
      }}>
        <div style={{ fontSize: 16, fontWeight: "bold", color: "#c8e6c9", marginBottom: 6 }}>
          🌱 New Raw Material
        </div>
        <div style={{ fontSize: 12, color: "#6a9c6a", marginBottom: 20 }}>
          Add a material that isn&rsquo;t already tracked in inventory.
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>Material name</label>
          <input
            type="text" placeholder="e.g. Wheat Bran"
            value={label}
            onChange={(e) => { setLabel(e.target.value); setError(""); }}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>Unit</label>
          <input
            type="text" placeholder="kg, L, pcs…"
            value={unit}
            onChange={(e) => { setUnit(e.target.value); setError(""); }}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>Cost per unit (RWF, optional)</label>
          <input
            type="number" min="0" placeholder="0"
            value={costPerUnit}
            onChange={(e) => setCostPerUnit(e.target.value)}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelSt}>Low-stock alert threshold (optional)</label>
          <input
            type="number" min="0" placeholder="0"
            value={reorderThreshold}
            onChange={(e) => setReorderThreshold(e.target.value)}
          />
        </div>

        {error && (
          <div style={{
            background: "#2a0a0a", color: "#f87171", borderRadius: 10,
            padding: "10px 14px", fontSize: 13, fontWeight: 600,
            marginBottom: 16, border: "1px solid #7f1d1d",
          }}>⚠ {error}</div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: 12, borderRadius: 10,
            border: "1px solid #2d4a2d", background: "transparent",
            color: "#9ab89a", fontSize: 14, cursor: "pointer", fontFamily: "Georgia, serif",
          }}>Cancel</button>
          <button onClick={handleSave} style={{
            flex: 2, padding: 12, borderRadius: 10, border: "none",
            background: "#4a7c59", color: "white", fontSize: 14,
            fontWeight: "bold", cursor: "pointer", fontFamily: "Georgia, serif",
          }}>Add Material</button>
        </div>
      </div>
    </div>
  );
}

// ── Log Production Batch Modal ───────────────────────────────────
// The mix is free-form: the user adds rows for whichever materials this
// batch's formula actually uses, in whatever quantities — there's no fixed
// list and no need to zero-out unused materials. Costs are entered per
// batch too: raw material cost is pulled automatically from each item's
// stored costPerUnit, transport is itemized per material, and bagging /
// plastic bag / sterilization are flat amounts for the whole batch.
type MixRow = { rowId: string; itemId: string; quantity: string };

const inputSt: React.CSSProperties = {
  width: "100%", padding: "9px 12px", background: "#162214",
  border: "1px solid #2d4a2d", borderRadius: 8, color: "#c8e6c9",
  fontSize: 13, fontFamily: "Georgia, serif",
};

function BatchModal({
  items, initial, onSave, onCancel, onCreateMaterial,
}: {
  items: InventoryItem[];
  initial?: ProductionBatch;
  onSave: (batch: {
    tubeCount: number; date: string; note: string;
    mix: MixLine[];
    costs: { transport: TransportLine[]; baggingCost: number; plasticBagCost: number; sterilizationCost: number };
  }) => void;
  onCancel: () => void;
  onCreateMaterial: (item: { label: string; unit: string; costPerUnit: number; reorderThreshold: number }) => Promise<InventoryItem>;
}) {
  const isEdit = !!initial;
  const initialMix = initial?.mix ?? [];
  const initialCosts = initial?.costs ?? { transport: [], baggingCost: 0, plasticBagCost: 0, sterilizationCost: 0 };
  const [tubeCount, setTubeCount] = useState(initial ? String(initial.tubeCount) : "");
  const [date, setDate] = useState(initial?.date ?? todayStr());
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState("");

  // Local copy so a newly-created material can appear in the dropdowns
  // immediately, without waiting on the parent's next inventory reload.
  const [localItems, setLocalItems] = useState<InventoryItem[]>(items);
  useEffect(() => { setLocalItems(items); }, [items]);

  // When editing, the original mix's quantities have already been
  // deducted from stock — saving will restore them before deducting the
  // (possibly different) new mix. So for the purposes of warning about
  // shortfalls, treat stock as if the original mix were still on hand.
  const originalQtyByItem: Record<string, number> = {};
  for (const m of initialMix) originalQtyByItem[m.itemId] = (originalQtyByItem[m.itemId] ?? 0) + m.quantity;
  const feasibilityItems = localItems.map((i) =>
    originalQtyByItem[i.id] ? { ...i, currentStock: i.currentStock + originalQtyByItem[i.id] } : i
  );

  const [mixRows, setMixRows] = useState<MixRow[]>(
    initialMix.length > 0
      ? initialMix.map((m) => ({ rowId: makeId(), itemId: m.itemId, quantity: String(m.quantity) }))
      : [{ rowId: makeId(), itemId: items[0]?.id ?? "", quantity: "" }]
  );
  const [baggingCost, setBaggingCost] = useState(initial ? String(initialCosts.baggingCost || "") : "");
  const [plasticBagCost, setPlasticBagCost] = useState(initial ? String(initialCosts.plasticBagCost || "") : "");
  const [sterilizationCost, setSterilizationCost] = useState(initial ? String(initialCosts.sterilizationCost || "") : "");
  const [newMaterialForRow, setNewMaterialForRow] = useState<string | null>(null);

  const count = Number(tubeCount) || 0;

  const validMixLines: MixLine[] = mixRows
    .filter((r) => r.itemId && Number(r.quantity) > 0)
    .map((r) => ({ itemId: r.itemId, quantity: Number(r.quantity) }));

  const shortfalls = checkMixFeasibility(validMixLines, feasibilityItems);

  // Materials actually used (qty > 0) get a transport row each.
  const usedItemIds = validMixLines.map((l) => l.itemId);
  const [transportByItem, setTransportByItem] = useState<Record<string, string>>(
    Object.fromEntries((initialCosts.transport ?? []).map((t) => [t.itemId, String(t.amount)]))
  );

  function addMixRow() {
    const usedIds = new Set(mixRows.map((r) => r.itemId));
    const next = localItems.find((i) => !usedIds.has(i.id)) ?? localItems[0];
    setMixRows((rows) => [...rows, { rowId: makeId(), itemId: next?.id ?? "", quantity: "" }]);
  }
  function removeMixRow(rowId: string) {
    setMixRows((rows) => rows.length > 1 ? rows.filter((r) => r.rowId !== rowId) : rows);
  }
  function updateMixRow(rowId: string, patch: Partial<MixRow>) {
    setMixRows((rows) => rows.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
    setError("");
  }
  function handleSelectChange(rowId: string, value: string) {
    if (value === "__new__") {
      setNewMaterialForRow(rowId);
      return;
    }
    updateMixRow(rowId, { itemId: value });
  }
  async function handleCreateMaterialForRow(input: { label: string; unit: string; costPerUnit: number; reorderThreshold: number }) {
    try {
      const created = await onCreateMaterial(input);
      setLocalItems((prev) => [...prev, created]);
      if (newMaterialForRow) {
        updateMixRow(newMaterialForRow, { itemId: created.id });
      }
      setNewMaterialForRow(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add material");
      setNewMaterialForRow(null);
    }
  }

  // Live cost breakdown
  const materialLines = validMixLines.map((l) => {
    const item = localItems.find((i) => i.id === l.itemId);
    const materialCost = Math.round(l.quantity * (item?.costPerUnit ?? 0) * 100) / 100;
    return { item, line: l, materialCost };
  });
  const materialsTotal = materialLines.reduce((s, m) => s + m.materialCost, 0);
  const transportTotal = usedItemIds.reduce((s, id) => s + (Number(transportByItem[id]) || 0), 0);
  const bagging = Number(baggingCost) || 0;
  const plastic = Number(plasticBagCost) || 0;
  const steril = Number(sterilizationCost) || 0;
  const totalCost = Math.round((materialsTotal + transportTotal + bagging + plastic + steril) * 100) / 100;
  const costPerTube = count > 0 ? Math.round((totalCost / count) * 100) / 100 : 0;

  function handleSave() {
    if (!tubeCount || isNaN(count) || count <= 0) {
      setError("Enter a valid tube count greater than 0");
      return;
    }
    if (validMixLines.length === 0) {
      setError("Add at least one mix material with a quantity greater than 0");
      return;
    }
    const transport: TransportLine[] = usedItemIds
      .map((itemId) => ({ itemId, amount: Number(transportByItem[itemId]) || 0 }))
      .filter((t) => t.amount > 0);
    onSave({
      tubeCount: count, date, note: note.trim(),
      mix: validMixLines,
      costs: { transport, baggingCost: bagging, plasticBagCost: plastic, sterilizationCost: steril },
    });
  }

  return (
    <>
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)",
      zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div style={{
        background: "#111e0f", border: "1px solid #2d4a2d",
        borderRadius: 16, maxWidth: 540, width: "100%",
        padding: 28, boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: "bold", color: "#c8e6c9" }}>
            {isEdit ? "✎ Edit Production Batch" : "🧫 Log Production Batch"}
          </div>
          <button onClick={onCancel} style={{
            width: 30, height: 30, borderRadius: "50%", border: "none",
            background: "#1e3320", color: "#c8e6c9", fontSize: 18, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelSt}>Tubes Produced (1 kg each)</label>
          <input
            type="number" min="0" placeholder="0"
            value={tubeCount}
            onChange={(e) => { setTubeCount(e.target.value); setError(""); }}
            style={{ fontSize: 18, fontWeight: 700, color: "#c8e6c9" }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelSt}>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        {/* ── Mix (free-form, no fixed formula) ──────────────────────── */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <label style={{ ...labelSt, marginBottom: 0 }}>Mix used this batch</label>
            <button onClick={addMixRow} style={{
              padding: "4px 10px", borderRadius: 7, border: "1px solid #2d4a2d",
              background: "#162214", color: "#4ade80", fontSize: 11, fontWeight: 700,
              cursor: "pointer", fontFamily: "Georgia, serif",
            }}>+ Add material</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {mixRows.map((row) => {
              const item = localItems.find((i) => i.id === row.itemId);
              const qty = Number(row.quantity) || 0;
              const short = item && qty > item.currentStock;
              return (
                <div key={row.rowId} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select
                    value={row.itemId}
                    onChange={(e) => handleSelectChange(row.rowId, e.target.value)}
                    style={{ ...selStyle, flex: 2 }}
                  >
                    {localItems.map((i) => (
                      <option key={i.id} value={i.id}>{i.label} ({i.unit})</option>
                    ))}
                    <option value="__new__">+ Add new material…</option>
                  </select>
                  <input
                    type="number" min="0" step="0.01" placeholder="Qty"
                    value={row.quantity}
                    onChange={(e) => updateMixRow(row.rowId, { quantity: e.target.value })}
                    style={{ ...inputSt, flex: 1, color: short ? "#f87171" : "#c8e6c9" }}
                  />
                  <button
                    onClick={() => removeMixRow(row.rowId)}
                    disabled={mixRows.length === 1}
                    style={{
                      width: 30, height: 30, borderRadius: 7, border: "1px solid #2d4a2d",
                      background: "#162214", color: mixRows.length === 1 ? "#3a5c3a" : "#f87171",
                      fontSize: 14, cursor: mixRows.length === 1 ? "default" : "pointer", flexShrink: 0,
                    }}
                  >×</button>
                </div>
              );
            })}
          </div>
          {shortfalls.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#f59e0b", fontWeight: 600 }}>
              ⚠ Not enough stock for {shortfalls.length === 1 ? "1 material" : `${shortfalls.length} materials`} — saving will take stock negative.
            </div>
          )}
        </div>

        {/* ── Cost breakdown ──────────────────────────────────────────── */}
        {validMixLines.length > 0 && (
          <div style={{
            background: "#0f1a0f", border: "1px solid #1e3320",
            borderRadius: 10, padding: "14px 16px", marginBottom: 16,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9ab89a", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>
              Cost breakdown (RWF)
            </div>

            {/* Raw material cost (auto) + transport (manual, per material) */}
            {materialLines.map(({ item, line, materialCost }) => (
              <div key={line.itemId} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#c8e6c9", marginBottom: 4 }}>
                  <span>{item?.label}</span>
                  <span style={{ color: "#6a9c6a" }}>
                    {line.quantity} {item?.unit} × {(item?.costPerUnit ?? 0).toLocaleString()} = <b style={{ color: "#c8e6c9" }}>{materialCost.toLocaleString()}</b>
                  </span>
                </div>
                <input
                  type="number" min="0" placeholder={`Transport cost for ${item?.label ?? "this material"}`}
                  value={transportByItem[line.itemId] ?? ""}
                  onChange={(e) => setTransportByItem((t) => ({ ...t, [line.itemId]: e.target.value }))}
                  style={inputSt}
                />
              </div>
            ))}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
              <div>
                <label style={labelSt}>Bagging cost</label>
                <input type="number" min="0" placeholder="0" value={baggingCost}
                  onChange={(e) => setBaggingCost(e.target.value)} style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>Plastic bag cost</label>
                <input type="number" min="0" placeholder="0" value={plasticBagCost}
                  onChange={(e) => setPlasticBagCost(e.target.value)} style={inputSt} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelSt}>Sterilization cost (estimate — wood-fired steam)</label>
                <input type="number" min="0" placeholder="0" value={sterilizationCost}
                  onChange={(e) => setSterilizationCost(e.target.value)} style={inputSt} />
              </div>
            </div>

            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginTop: 14, paddingTop: 12, borderTop: "1px solid #1e3320",
            }}>
              <div>
                <div style={{ fontSize: 11, color: "#6a9c6a" }}>Total batch cost</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#c8e6c9" }}>{fmtMoney(totalCost)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "#6a9c6a" }}>Cost / tube</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#4ade80" }}>
                  {count > 0 ? fmtMoney(costPerTube) : "—"}
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={labelSt}>Note (optional)</label>
          <input
            type="text" placeholder="e.g. Morning batch, Mageragere"
            value={note} onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {error && (
          <div style={{
            background: "#2a0a0a", color: "#f87171", borderRadius: 10,
            padding: "10px 14px", fontSize: 13, fontWeight: 600,
            marginBottom: 16, border: "1px solid #7f1d1d",
          }}>⚠ {error}</div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: 12, borderRadius: 10,
            border: "1px solid #2d4a2d", background: "transparent",
            color: "#9ab89a", fontSize: 14, cursor: "pointer", fontFamily: "Georgia, serif",
          }}>Cancel</button>
          <button onClick={handleSave} style={{
            flex: 2, padding: 12, borderRadius: 10, border: "none",
            background: shortfalls.length > 0 ? "#b45309" : "#4a7c59", color: "white", fontSize: 14,
            fontWeight: "bold", cursor: "pointer", fontFamily: "Georgia, serif",
          }}>{shortfalls.length > 0 ? "Save Anyway" : isEdit ? "Save Changes" : "Log Batch"}</button>
        </div>
      </div>
    </div>
    {newMaterialForRow && (
      <NewMaterialModal
        onSave={handleCreateMaterialForRow}
        onCancel={() => setNewMaterialForRow(null)}
      />
    )}
    </>
  );
}

// ── Reorder Threshold Modal ───────────────────────────────────────
function ThresholdModal({
  item, onSave, onCancel,
}: {
  item: InventoryItem;
  onSave: (reorderThreshold: number) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(String(item.reorderThreshold));

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)",
      zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div style={{
        background: "#111e0f", border: "1px solid #2d4a2d",
        borderRadius: 16, maxWidth: 380, width: "100%",
        padding: 28, boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
      }}>
        <div style={{ fontSize: 16, fontWeight: "bold", color: "#c8e6c9", marginBottom: 6 }}>
          ⚠️ Low-Stock Alert
        </div>
        <div style={{ fontSize: 12, color: "#6a9c6a", marginBottom: 20 }}>
          Get warned when {item.label} drops to or below this level.
        </div>
        <label style={labelSt}>Reorder Threshold ({item.unit})</label>
        <input
          type="number" min="0" value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{ marginBottom: 20 }}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: 12, borderRadius: 10,
            border: "1px solid #2d4a2d", background: "transparent",
            color: "#9ab89a", fontSize: 14, cursor: "pointer", fontFamily: "Georgia, serif",
          }}>Cancel</button>
          <button onClick={() => onSave(Number(value) || 0)} style={{
            flex: 2, padding: 12, borderRadius: 10, border: "none",
            background: "#4a7c59", color: "white", fontSize: 14,
            fontWeight: "bold", cursor: "pointer", fontFamily: "Georgia, serif",
          }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Material Stock Card ───────────────────────────────────────────
function MaterialCard({
  item, onStockMove, onSetThreshold, isMobile,
}: {
  item: InventoryItem;
  onStockMove: () => void;
  onSetThreshold: () => void;
  isMobile: boolean;
}) {
  const material = RAW_MATERIALS.find((m) => m.id === item.id);
  const low = isLowStock(item);
  const out = isOutOfStock(item);
  const formulaLinked = material?.kgPerTube !== null && material?.kgPerTube !== undefined;

  return (
    <div style={{
      background: out ? "#1a0a0a" : low ? "#160e00" : "#111e0f",
      border: `1px solid ${out ? "#7f1d1d" : low ? "#78460a44" : "#1e3320"}`,
      borderRadius: 14, padding: "16px 18px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#c8e6c9", display: "flex", alignItems: "center", gap: 6 }}>
            <span>{material?.emoji}</span> {item.label}
            {(low || out) && <span>{out ? "⛔" : "⚠️"}</span>}
          </div>
          {formulaLinked && (
            <div style={{ fontSize: 10, color: "#6a9c6a", marginTop: 2 }}>
              {material.kgPerTube} {item.unit}/tube
            </div>
          )}
        </div>
        <button
          onClick={onSetThreshold}
          title="Set low-stock alert threshold"
          style={{
            width: 26, height: 26, borderRadius: 7, border: "1px solid #2d4a2d",
            background: "#162214", color: "#9ab89a", fontSize: 12, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}
        >⚙</button>
      </div>

      <div style={{
        fontSize: isMobile ? 22 : 26, fontWeight: 800,
        color: out ? "#f87171" : low ? "#f59e0b" : "#4ade80",
        marginBottom: 4,
      }}>
        {fmt(item.currentStock, item.unit)}
      </div>

      {item.reorderThreshold > 0 && (
        <div style={{ fontSize: 11, color: "#6a9c6a", marginBottom: 12 }}>
          Reorder at {fmt(item.reorderThreshold, item.unit)}
          {low && <span style={{ color: "#f59e0b", fontWeight: 700 }}> — running low</span>}
          {out && <span style={{ color: "#f87171", fontWeight: 700 }}> — out of stock</span>}
        </div>
      )}

      <button
        onClick={onStockMove}
        style={{
          width: "100%", padding: "8px", borderRadius: 8,
          border: "1px solid #2d4a2d", background: "#162214",
          color: "#4ade80", fontSize: 12, fontWeight: 700, cursor: "pointer",
          fontFamily: "Georgia, serif", marginTop: 8,
        }}
      >+ Stock Movement</button>
    </div>
  );
}

// ── Main Inventory Manager ────────────────────────────────────────
export function InventoryManager({ isMobile, onFlash }: {
  isMobile: boolean;
  onFlash: (msg: string, type?: string) => void;
}) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [movementTarget, setMovementTarget] = useState<InventoryItem | null>(null);
  const [thresholdTarget, setThresholdTarget] = useState<InventoryItem | null>(null);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [newMaterialModalOpen, setNewMaterialModalOpen] = useState(false);
  const [historyView, setHistoryView] = useState<"movements" | "batches">("movements");

  const [openMovementMenu, setOpenMovementMenu] = useState<string | null>(null);
  const [editMovementTarget, setEditMovementTarget] = useState<StockMovement | null>(null);
  const [deleteMovementTarget, setDeleteMovementTarget] = useState<StockMovement | null>(null);

  const [openBatchMenu, setOpenBatchMenu] = useState<string | null>(null);
  const [editBatchTarget, setEditBatchTarget] = useState<ProductionBatch | null>(null);
  const [deleteBatchTarget, setDeleteBatchTarget] = useState<ProductionBatch | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [itemsData, movementsData, batchesData] = await Promise.all([
        apiGetInventoryItems(), apiGetMovements(), apiGetBatches(),
      ]);
      setItems(itemsData);
      setMovements(movementsData);
      setBatches(batchesData);
      setLoadError("");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load inventory data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function handleStockMove(movement: { type: "stock_in" | "stock_out" | "adjustment"; quantity: number; date: string; note: string }) {
    if (!movementTarget) return;
    try {
      // For adjustment, treat the entered value as the new absolute count,
      // converting it to a signed delta the API applies directly.
      const signedQty = movement.type === "adjustment"
        ? movement.quantity - movementTarget.currentStock
        : movement.quantity;

      await apiAddMovement({
        id: makeId(),
        itemId: movementTarget.id,
        type: movement.type,
        quantity: signedQty,
        date: movement.date,
        note: movement.note,
      });
      setMovementTarget(null);
      onFlash("Stock movement saved ✓");
      loadAll();
    } catch (err) {
      onFlash(err instanceof Error ? err.message : "Could not save movement", "error");
    }
  }

  async function handleEditMovement(patch: { type: "stock_in" | "stock_out" | "adjustment"; quantity: number; date: string; note: string }) {
    if (!editMovementTarget) return;
    try {
      await apiUpdateMovement(editMovementTarget.id, patch);
      setEditMovementTarget(null);
      onFlash("Movement updated ✓");
      loadAll();
    } catch (err) {
      onFlash(err instanceof Error ? err.message : "Could not update movement", "error");
    }
  }

  async function handleDeleteMovement() {
    if (!deleteMovementTarget) return;
    try {
      await apiDeleteMovement(deleteMovementTarget.id);
      setDeleteMovementTarget(null);
      onFlash("Movement deleted ✓");
      loadAll();
    } catch (err) {
      onFlash(err instanceof Error ? err.message : "Could not delete movement", "error");
    }
  }

  async function handleThresholdSave(reorderThreshold: number) {
    if (!thresholdTarget) return;
    try {
      await apiUpdateInventoryItem(thresholdTarget.id, { reorderThreshold });
      setThresholdTarget(null);
      onFlash("Alert threshold updated ✓");
      loadAll();
    } catch (err) {
      onFlash(err instanceof Error ? err.message : "Could not update threshold", "error");
    }
  }

  async function handleLogBatch(batch: {
    tubeCount: number; date: string; note: string;
    mix: MixLine[];
    costs: { transport: TransportLine[]; baggingCost: number; plasticBagCost: number; sterilizationCost: number };
  }) {
    try {
      await apiLogBatch({ id: makeId(), ...batch });
      setBatchModalOpen(false);
      onFlash(`Batch of ${batch.tubeCount.toLocaleString()} tubes logged ✓`);
      loadAll();
    } catch (err) {
      onFlash(err instanceof Error ? err.message : "Could not log batch", "error");
    }
  }

  async function handleEditBatch(batch: {
    tubeCount: number; date: string; note: string;
    mix: MixLine[];
    costs: { transport: TransportLine[]; baggingCost: number; plasticBagCost: number; sterilizationCost: number };
  }) {
    if (!editBatchTarget) return;
    try {
      await apiUpdateBatch(editBatchTarget.id, batch);
      setEditBatchTarget(null);
      onFlash("Batch updated ✓");
      loadAll();
    } catch (err) {
      onFlash(err instanceof Error ? err.message : "Could not update batch", "error");
    }
  }

  async function handleDeleteBatch() {
    if (!deleteBatchTarget) return;
    try {
      await apiDeleteBatch(deleteBatchTarget.id);
      setDeleteBatchTarget(null);
      onFlash("Batch deleted — stock it consumed has been restored ✓");
      loadAll();
    } catch (err) {
      onFlash(err instanceof Error ? err.message : "Could not delete batch", "error");
    }
  }

  async function handleCreateMaterial(input: {
    label: string; unit: string; costPerUnit: number; reorderThreshold: number;
  }) {
    const created = await apiCreateInventoryItem(input);
    onFlash(`${created.label} added to inventory ✓`);
    loadAll();
    return created;
  }

  async function handleCreateMaterialStandalone(input: {
    label: string; unit: string; costPerUnit: number; reorderThreshold: number;
  }) {
    try {
      await handleCreateMaterial(input);
      setNewMaterialModalOpen(false);
    } catch (err) {
      onFlash(err instanceof Error ? err.message : "Could not add material", "error");
    }
  }

  const lowStockItems = items.filter((i) => isLowStock(i) && i.currentStock > 0);
  const outOfStockItems = items.filter((i) => isOutOfStock(i));

  if (loading) {
    return (
      <div style={{ textAlign: "center", color: "#6a9c6a", padding: "48px 0" }}>
        Loading inventory…
      </div>
    );
  }

  if (loadError) {
    return (
      <Card style={{ textAlign: "center", padding: "32px 20px" }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>⚠️</div>
        <div style={{ color: "#f87171", fontWeight: 700, marginBottom: 6 }}>Couldn&rsquo;t load inventory</div>
        <div style={{ color: "#6a9c6a", fontSize: 13, marginBottom: 16 }}>{loadError}</div>
        <button onClick={loadAll} style={{
          padding: "8px 16px", borderRadius: 8, border: "1px solid #2d4a2d",
          background: "#162214", color: "#4ade80", fontSize: 13, fontWeight: 700,
          cursor: "pointer", fontFamily: "Georgia, serif",
        }}>Retry</button>
      </Card>
    );
  }

  return (
    <div>
      {movementTarget && (
        <MovementModal item={movementTarget} onSave={handleStockMove} onCancel={() => setMovementTarget(null)} />
      )}
      {thresholdTarget && (
        <ThresholdModal item={thresholdTarget} onSave={handleThresholdSave} onCancel={() => setThresholdTarget(null)} />
      )}
      {batchModalOpen && (
        <BatchModal
          items={items} onSave={handleLogBatch} onCancel={() => setBatchModalOpen(false)}
          onCreateMaterial={handleCreateMaterial}
        />
      )}
      {editBatchTarget && (
        <BatchModal
          items={items} initial={editBatchTarget} onSave={handleEditBatch}
          onCancel={() => setEditBatchTarget(null)}
          onCreateMaterial={handleCreateMaterial}
        />
      )}
      {deleteBatchTarget && (
        <ConfirmModal
          title="Delete this batch?"
          message={`This restores the ${deleteBatchTarget.tubeCount.toLocaleString()} tubes' worth of materials it consumed back into stock. This can't be undone.`}
          onConfirm={handleDeleteBatch}
          onCancel={() => setDeleteBatchTarget(null)}
        />
      )}
      {newMaterialModalOpen && (
        <NewMaterialModal
          onSave={handleCreateMaterialStandalone}
          onCancel={() => setNewMaterialModalOpen(false)}
        />
      )}
      {editMovementTarget && (
        <EditMovementModal
          movement={editMovementTarget}
          itemLabel={items.find((i) => i.id === editMovementTarget.itemId)?.label ?? editMovementTarget.itemId}
          itemUnit={items.find((i) => i.id === editMovementTarget.itemId)?.unit ?? ""}
          onSave={handleEditMovement}
          onCancel={() => setEditMovementTarget(null)}
        />
      )}
      {deleteMovementTarget && (
        <ConfirmModal
          title="Delete this movement?"
          message="This will reverse its effect on current stock. This can't be undone."
          onConfirm={handleDeleteMovement}
          onCancel={() => setDeleteMovementTarget(null)}
        />
      )}

      {/* Title + Log Batch action */}
      <div style={{
        marginBottom: 20, display: "flex", alignItems: isMobile ? "flex-start" : "center",
        justifyContent: "space-between", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 0,
      }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 20 : 26, fontWeight: "bold", color: "#c8e6c9", margin: 0 }}>
            Inventory
          </h1>
          <p style={{ color: "#6a9c6a", marginTop: 4, fontSize: 13 }}>
            Raw materials for mushroom tube production
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, width: isMobile ? "100%" : "auto", flexDirection: isMobile ? "column" : "row" }}>
          <button
            onClick={() => setNewMaterialModalOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "10px 18px", borderRadius: 10, border: "1px solid #2d4a2d",
              background: "#162214", color: "#4ade80", fontSize: 13, fontWeight: 700,
              cursor: "pointer", fontFamily: "Georgia, serif", width: isMobile ? "100%" : "auto",
              justifyContent: "center",
            }}
          >🌱 Add Material</button>
          <button
            onClick={() => setBatchModalOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "10px 18px", borderRadius: 10, border: "none",
              background: "#4a7c59", color: "white", fontSize: 13, fontWeight: 700,
              cursor: "pointer", fontFamily: "Georgia, serif", width: isMobile ? "100%" : "auto",
              justifyContent: "center",
            }}
          >🧫 Log Production Batch</button>
        </div>
      </div>

      {/* Alerts banner */}
      {(outOfStockItems.length > 0 || lowStockItems.length > 0) && (
        <div style={{
          background: outOfStockItems.length > 0 ? "#1a0a0a" : "#160e00",
          border: `1px solid ${outOfStockItems.length > 0 ? "#7f1d1d" : "#78460a44"}`,
          borderRadius: 12, padding: "12px 16px", marginBottom: 16,
          fontSize: 13, color: outOfStockItems.length > 0 ? "#f87171" : "#f59e0b",
        }}>
          {outOfStockItems.length > 0 && (
            <div>⛔ Out of stock: {outOfStockItems.map((i) => i.label).join(", ")}</div>
          )}
          {lowStockItems.length > 0 && (
            <div>⚠️ Running low: {lowStockItems.map((i) => i.label).join(", ")}</div>
          )}
        </div>
      )}

      {/* Material grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
        gap: 12, marginBottom: 20,
      }}>
        {items.map((item) => (
          <MaterialCard
            key={item.id} item={item}
            onStockMove={() => setMovementTarget(item)}
            onSetThreshold={() => setThresholdTarget(item)}
            isMobile={isMobile}
          />
        ))}
      </div>

      {/* History tabs */}
      <Card>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(["movements", "batches"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setHistoryView(v)}
              style={{
                padding: "6px 14px", borderRadius: 8, border: "1px solid #2d4a2d",
                background: historyView === v ? "#1e3320" : "transparent",
                color: historyView === v ? "#4ade80" : "#9ab89a",
                fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Georgia, serif",
              }}
            >{v === "movements" ? "Stock Movements" : "Production Batches"}</button>
          ))}
        </div>

        {historyView === "movements" ? (
          movements.length === 0 ? (
            <div style={{ color: "#3a5c3a", fontSize: 13, textAlign: "center", padding: "24px 0", fontStyle: "italic" }}>
              No stock movements yet.
            </div>
          ) : (
            movements.slice(0, 30).map((m) => {
              const item = items.find((i) => i.id === m.itemId);
              const material = RAW_MATERIALS.find((mt) => mt.id === m.itemId);
              const label = item?.label ?? material?.label ?? m.itemId;
              const unit = item?.unit ?? material?.unit ?? "";
              const emoji = material?.emoji ?? "📦";
              const positive = m.quantity > 0;
              const typeLabel = {
                stock_in: "Stock In", stock_out: "Stock Out",
                production_deduction: "Production", adjustment: "Adjustment",
              }[m.type];
              const linkedToBatch = !!m.batchId;
              return (
                <div key={m.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "9px 0", borderBottom: "1px solid #1e3320", gap: 10,
                }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#c8e6c9" }}>
                      {emoji} {label}
                      <span style={{
                        marginLeft: 8, fontSize: 10, fontWeight: 700, padding: "1px 7px",
                        borderRadius: 6, background: "#1e3320", color: "#9ab89a",
                      }}>{typeLabel}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#6a9c6a", marginTop: 1 }}>
                      {m.date}{m.note ? ` · ${m.note}` : ""}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: positive ? "#4ade80" : "#f87171", flexShrink: 0 }}>
                    {positive ? "+" : ""}{fmt(m.quantity, unit)}
                  </div>
                  <DotsMenu
                    open={openMovementMenu === m.id}
                    onToggle={() => setOpenMovementMenu((cur) => (cur === m.id ? null : m.id))}
                    onClose={() => setOpenMovementMenu(null)}
                    items={[
                      {
                        label: linkedToBatch ? "Edit (linked to batch)" : "Edit",
                        onClick: () => setEditMovementTarget(m),
                        disabled: linkedToBatch,
                      },
                      {
                        label: linkedToBatch ? "Delete (linked to batch)" : "Delete",
                        onClick: () => setDeleteMovementTarget(m),
                        disabled: linkedToBatch,
                        danger: true,
                      },
                    ]}
                  />
                </div>
              );
            })
          )
        ) : (
          batches.length === 0 ? (
            <div style={{ color: "#3a5c3a", fontSize: 13, textAlign: "center", padding: "24px 0", fontStyle: "italic" }}>
              No production batches logged yet.
            </div>
          ) : (
            batches.slice(0, 30).map((b) => (
              <div key={b.id} style={{
                padding: "9px 0", borderBottom: "1px solid #1e3320",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#c8e6c9" }}>
                      🧫 {b.tubeCount.toLocaleString()} tubes
                    </div>
                    <div style={{ fontSize: 11, color: "#6a9c6a", marginTop: 1 }}>
                      {b.date}{b.note ? ` · ${b.note}` : ""}
                    </div>
                    {b.mix && b.mix.length > 0 && (
                      <div style={{ fontSize: 11, color: "#6a9c6a", marginTop: 3 }}>
                        {b.mix.map((m) => `${m.label} ${m.quantity}${m.unit}`).join(" · ")}
                      </div>
                    )}
                  </div>
                  {b.totalCost > 0 && (
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#4ade80" }}>
                        {fmtMoney(b.costPerTube)}/tube
                      </div>
                      <div style={{ fontSize: 10, color: "#6a9c6a" }}>
                        total {fmtMoney(b.totalCost)}
                      </div>
                    </div>
                  )}
                  <DotsMenu
                    open={openBatchMenu === b.id}
                    onToggle={() => setOpenBatchMenu((cur) => (cur === b.id ? null : b.id))}
                    onClose={() => setOpenBatchMenu(null)}
                    items={[
                      { label: "Edit", onClick: () => setEditBatchTarget(b) },
                      { label: "Delete", onClick: () => setDeleteBatchTarget(b), danger: true },
                    ]}
                  />
                </div>
              </div>
            ))
          )
        )}
      </Card>
    </div>
  );
}
