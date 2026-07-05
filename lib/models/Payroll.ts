import mongoose, { Schema, type Model } from "mongoose";

// ─── PAYROLL ENTRY SCHEMA ────────────────────────────────────────────────────
// One document per employee per month — mirrors a single row of the old
// "Month YYYY Salaries" spreadsheet tab. Employee details (name, salary,
// RSSB/ID/phone) are snapshotted at generation time so editing or removing
// an employee later never rewrites payroll history.
const PayrollEntrySchema = new Schema(
  {
    _id: { type: String, required: true },
    month: { type: String, required: true }, // YYYY-MM
    employeeId: { type: String, required: true },
    employeeName: { type: String, required: true },
    monthlySalary: { type: Number, required: true },
    basisOfCalculation: { type: String, default: "" },
    wagePerDay: { type: Number, required: true },
    daysToBePaid: { type: Number, required: true, default: 30 },
    ideni: { type: Number, default: 0 }, // deduction / debt owed by the employee
    netSalary: { type: Number, required: true },
    paid: { type: Boolean, default: false },
    paidDate: { type: String }, // YYYY-MM-DD
    rssbNumber: { type: String },
    idNumber: { type: String },
    phone: { type: String },
  },
  { timestamps: true }
);

// One entry per employee per month.
PayrollEntrySchema.index({ month: 1, employeeId: 1 }, { unique: true });

export interface PayrollEntryDoc {
  _id: string;
  month: string;
  employeeId: string;
  employeeName: string;
  monthlySalary: number;
  basisOfCalculation: string;
  wagePerDay: number;
  daysToBePaid: number;
  ideni: number;
  netSalary: number;
  paid: boolean;
  paidDate?: string;
  rssbNumber?: string;
  idNumber?: string;
  phone?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export default (mongoose.models.PayrollEntry as Model<PayrollEntryDoc>) ||
  mongoose.model<PayrollEntryDoc>("PayrollEntry", PayrollEntrySchema);
