import mongoose, { Schema, type Model } from "mongoose";

// ─── STOCK MOVEMENT SCHEMA ───────────────────────────────────────────────────
// Every change to inventory — a delivery, a correction, or material consumed
// by a production batch — is logged as an immutable movement. Current stock
// on InventoryItem is a running total; this collection is the audit trail
// that explains how it got there.
const StockMovementSchema = new Schema(
  {
    _id: { type: String, required: true },
    itemId: { type: String, required: true }, // RawMaterialId
    type: {
      type: String,
      enum: ["stock_in", "stock_out", "production_deduction", "adjustment"],
      required: true,
    },
    // Signed quantity in the item's unit. stock_in is positive,
    // stock_out / production_deduction are negative, adjustment can be
    // either (correcting a miscount up or down).
    quantity: { type: Number, required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    note: { type: String, default: "" },
    // Set only for movements caused by logging a production batch —
    // links every deduction back to the batch that triggered it.
    batchId: { type: String },
  },
  { timestamps: true }
);

StockMovementSchema.index({ itemId: 1, date: 1 });
StockMovementSchema.index({ batchId: 1 });

export interface StockMovementDoc {
  _id: string;
  itemId: string;
  type: "stock_in" | "stock_out" | "production_deduction" | "adjustment";
  quantity: number;
  date: string;
  note: string;
  batchId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export default (mongoose.models.StockMovement as Model<StockMovementDoc>) ||
  mongoose.model<StockMovementDoc>("StockMovement", StockMovementSchema);
