import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Employee from "@/lib/models/Employee";
import PayrollEntry, { type PayrollEntryDoc } from "@/lib/models/Payroll";
import { basisOfCalculationForMonth, computeWagePerDay, computeNetSalary } from "@/lib/payroll";

export const dynamic = "force-dynamic";

function normalize(doc: PayrollEntryDoc) {
  const { _id, createdAt, updatedAt, ...rest } = doc as PayrollEntryDoc & { __v?: number };
  delete (rest as Record<string, unknown>).__v;
  return { id: _id, ...rest };
}

// Exact figures from the original June 2026 payroll workbook. Used only to
// seed that specific month's entries so the historical record matches what
// was actually paid, rather than the generic 30-day formula every other
// month is generated from.
const JUNE_2026_ACTUALS: Record<
  string,
  { daysToBePaid: number; ideni: number; netSalary: number; basisOfCalculation: string }
> = {
  "Musangamfura Emmanuel": { daysToBePaid: 30, ideni: 0, netSalary: 500000, basisOfCalculation: "1-30 June 2026" },
  "Joshua NKUNDIMANA": { daysToBePaid: 30, ideni: 0, netSalary: 30000, basisOfCalculation: "1-30 June 2026" },
  "Niyogisubizo Jean Claude": { daysToBePaid: 30, ideni: 0, netSalary: 50000, basisOfCalculation: "1-30 June 2026" },
  "KWIZERA John (Mager)": { daysToBePaid: 30, ideni: 0, netSalary: 40000, basisOfCalculation: "1-30 June 2026" },
  "MUCYO GASPARD (Mager)": { daysToBePaid: 30, ideni: 0, netSalary: 50000, basisOfCalculation: "1-30 June 2026" },
  "Isimbi Liliane": { daysToBePaid: 30, ideni: 0, netSalary: 200000, basisOfCalculation: "1st-30th June 2026" },
  "DIEUDONNE": { daysToBePaid: 30, ideni: 0, netSalary: 30000, basisOfCalculation: "1-30 June 2026" },
};

/**
 * Ensures every active employee has a payroll entry for `month`. Only ever
 * inserts entries that are missing — never touches one that already
 * exists, so edited days/deductions/paid-status always survive. For
 * "2026-06" specifically, new entries use the exact figures from the
 * original workbook; every other month is generated from the employee's
 * current monthly salary using the standard 30-day formula.
 */
async function ensureSeeded(month: string) {
  const employees = await Employee.find({ active: true }).lean();
  if (employees.length === 0) return;

  const existing = await PayrollEntry.find({ month }, { employeeId: 1 }).lean();
  const existingIds = new Set(existing.map((e) => e.employeeId));
  const missing = employees.filter((e) => !existingIds.has(e._id));
  if (missing.length === 0) return;

  const docs = missing.map((emp) => {
    const wagePerDay = computeWagePerDay(emp.monthlySalary);
    const actual = month === "2026-06" ? JUNE_2026_ACTUALS[emp.name] : undefined;
    const daysToBePaid = actual?.daysToBePaid ?? 30;
    const ideni = actual?.ideni ?? 0;
    const netSalary = actual?.netSalary ?? computeNetSalary(emp.monthlySalary, daysToBePaid, ideni);
    const basisOfCalculation = actual?.basisOfCalculation ?? basisOfCalculationForMonth(month);

    return {
      _id: `pr-${month}-${emp._id}`,
      month,
      employeeId: emp._id,
      employeeName: emp.name,
      monthlySalary: emp.monthlySalary,
      basisOfCalculation,
      wagePerDay,
      daysToBePaid,
      ideni,
      netSalary,
      paid: false,
      rssbNumber: emp.rssbNumber,
      idNumber: emp.idNumber,
      phone: emp.phone,
    };
  });

  await PayrollEntry.insertMany(docs);
}

// GET /api/payroll?month=YYYY-MM — returns (and auto-generates missing
// entries for) that month's payroll run.
export async function GET(req: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month");
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { success: false, error: "A valid month (YYYY-MM) query param is required." },
        { status: 400 }
      );
    }

    await ensureSeeded(month);
    const entries = await PayrollEntry.find({ month }).sort({ employeeName: 1 }).lean();
    return NextResponse.json({ success: true, data: entries.map(normalize) });
  } catch (err) {
    console.error("GET /api/payroll error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
