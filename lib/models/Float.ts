import mongoose, { Schema, type Model } from "mongoose";

// ─── FLOAT SCHEMA ────────────────────────────────────────────────────────────
// Mirrors lib/types.ts -> AppState.floats[date] = amount.
// The date string (YYYY-MM-DD) is used directly as the Mongo _id, so setting
// the opening float for a date is a simple upsert keyed by date.
const FloatSchema = new Schema(
  {
    _id: { type: String, required: true }, // YYYY-MM-DD
    amount: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

export interface FloatDoc {
  _id: string;
  amount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export default (mongoose.models.Float as Model<FloatDoc>) ||
  mongoose.model<FloatDoc>("Float", FloatSchema);
