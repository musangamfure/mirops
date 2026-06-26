import mongoose, { Schema, type Model } from "mongoose";

// ─── INVENTORY ITEM SCHEMA ───────────────────────────────────────────────────
// One document per raw material. `_id` is the material's constant id (e.g.
// "cotton_hulls") from lib/constants.ts RAW_MATERIALS, so there's a single
// canonical row per material — no duplicate-name drift like free-text
// categories can have.
const InventoryItemSchema = new Schema(
  {
    _id: { type: String, required: true }, // RawMaterialId, e.g. "cotton_hulls"
    label: { type: String, required: true },
    unit: { type: String, required: true }, // "kg" | "L"
    currentStock: { type: Number, required: true, default: 0 },
    reorderThreshold: { type: Number, required: true, default: 0 },
    costPerUnit: { type: Number, default: 0 }, // RWF per unit, optional valuation
  },
  { timestamps: true }
);

export interface InventoryItemDoc {
  _id: string;
  label: string;
  unit: string;
  currentStock: number;
  reorderThreshold: number;
  costPerUnit: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export default (mongoose.models.InventoryItem as Model<InventoryItemDoc>) ||
  mongoose.model<InventoryItemDoc>("InventoryItem", InventoryItemSchema);
