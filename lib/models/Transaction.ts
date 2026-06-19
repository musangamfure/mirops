import mongoose, { Schema, type Model } from "mongoose";

// ─── TRANSACTION SCHEMA ──────────────────────────────────────────────────────
// Mirrors lib/types.ts -> Transaction. We use the client-generated id
// (same format used by the localStorage version: `${Date.now()}-${random}`)
// as the Mongo _id so the reducer's optimistic-update flow needs no
// id-remapping between the local state and the database.
const TransactionSchema = new Schema(
  {
    _id: { type: String, required: true },
    kind: {
      type: String,
      enum: ["revenue", "expense", "float_topup"],
      required: true,
    },
    date: { type: String, required: true }, // YYYY-MM-DD
    amount: { type: Number, required: true },
    note: { type: String, default: "" },
    product: { type: String },
    site: { type: String },
    category: { type: String },
    mealSession: { type: String },
    // Legacy field — no longer written. Kept in the schema so existing
    // documents from before the Site rework still load without error;
    // the API layer migrates it into `site` on read.
    mealSite: { type: String },
  },
  { timestamps: true }
);

TransactionSchema.index({ date: 1 });

export interface TransactionDoc {
  _id: string;
  kind: "revenue" | "expense" | "float_topup";
  date: string;
  amount: number;
  note: string;
  product?: string;
  site?: string;
  category?: string;
  mealSession?: string;
  /** @deprecated legacy field, migrated into `site` on read */
  mealSite?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export default (mongoose.models.Transaction as Model<TransactionDoc>) ||
  mongoose.model<TransactionDoc>("Transaction", TransactionSchema);
