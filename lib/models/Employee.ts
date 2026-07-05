import mongoose, { Schema, type Model } from "mongoose";

// ─── EMPLOYEE SCHEMA ─────────────────────────────────────────────────────────
// The staff roster, previously a plain string list in localStorage
// (miru_employees_v1). Now a real collection so the team list — and the
// monthly salary each payroll run is generated from — is shared across
// devices/browsers instead of living only on whoever's machine added it.
const EmployeeSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    monthlySalary: { type: Number, required: true, default: 0 },
    rssbNumber: { type: String },
    idNumber: { type: String },
    phone: { type: String },
    site: { type: String },
    // Inactive employees are kept (their name/history stays intact on past
    // payroll entries) but are skipped when generating future payroll runs.
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export interface EmployeeDoc {
  _id: string;
  name: string;
  monthlySalary: number;
  rssbNumber?: string;
  idNumber?: string;
  phone?: string;
  site?: string;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export default (mongoose.models.Employee as Model<EmployeeDoc>) ||
  mongoose.model<EmployeeDoc>("Employee", EmployeeSchema);
