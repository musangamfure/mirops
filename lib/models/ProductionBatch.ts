import mongoose, { Schema, type Model } from "mongoose";

// ─── PRODUCTION BATCH SCHEMA ─────────────────────────────────────────────────
// One document per "I made N tubes today" log. Because the mix formula
// changes from batch to batch, each batch stores its own free-form list of
// materials + quantities used (`mix`) — there's no fixed per-tube ratio
// anymore. Logging a batch deducts each mix line from inventory (see
// app/api/inventory/batches/route.ts) and snapshots each material's label,
// unit, and costPerUnit *at the time of the batch* so historical cost
// breakdowns stay accurate even if those values change later.
const ProductionBatchSchema = new Schema(
  {
    _id: { type: String, required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    tubeCount: { type: Number, required: true },
    note: { type: String, default: "" },

    // Free-form mix used for this batch — any material, any quantity.
    mix: {
      type: [
        {
          _id: false,
          itemId: { type: String, required: true },
          label: { type: String, required: true },
          unit: { type: String, required: true },
          quantity: { type: Number, required: true }, // amount used (in item's unit)
          costPerUnit: { type: Number, default: 0 },   // snapshot from InventoryItem
          materialCost: { type: Number, default: 0 },  // quantity * costPerUnit
        },
      ],
      default: [],
    },

    // Cost breakdown for this batch (RWF).
    costs: {
      type: {
        _id: false,
        // Transport is itemized per material (e.g. hulls transport vs spawn transport).
        transport: {
          type: [
            {
              _id: false,
              itemId: { type: String, required: true },
              label: { type: String, required: true },
              amount: { type: Number, default: 0 },
            },
          ],
          default: [],
        },
        baggingCost: { type: Number, default: 0 },
        plasticBagCost: { type: Number, default: 0 },
        sterilizationCost: { type: Number, default: 0 }, // manual estimate (wood-fired steam)
      },
      default: {},
    },

    // Computed + stored for fast reads / history display.
    totalCost: { type: Number, default: 0 },
    costPerTube: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ProductionBatchSchema.index({ date: 1 });

export interface ProductionBatchMixLine {
  itemId: string;
  label: string;
  unit: string;
  quantity: number;
  costPerUnit: number;
  materialCost: number;
}

export interface ProductionBatchTransportLine {
  itemId: string;
  label: string;
  amount: number;
}

export interface ProductionBatchCosts {
  transport: ProductionBatchTransportLine[];
  baggingCost: number;
  plasticBagCost: number;
  sterilizationCost: number;
}

export interface ProductionBatchDoc {
  _id: string;
  date: string;
  tubeCount: number;
  note: string;
  mix: ProductionBatchMixLine[];
  costs: ProductionBatchCosts;
  totalCost: number;
  costPerTube: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export default (mongoose.models.ProductionBatch as Model<ProductionBatchDoc>) ||
  mongoose.model<ProductionBatchDoc>("ProductionBatch", ProductionBatchSchema);
