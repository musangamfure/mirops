import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Employee, { type EmployeeDoc } from "@/lib/models/Employee";

export const dynamic = "force-dynamic";

function normalize(doc: EmployeeDoc) {
  const { _id, createdAt, updatedAt, ...rest } = doc as EmployeeDoc & { __v?: number };
  delete (rest as Record<string, unknown>).__v;
  return { id: _id, ...rest };
}

// Seeded once, from the June 2026 payroll workbook, so the roster starts
// populated with the real team instead of empty. Only runs while the
// Employee collection is completely empty, so it never overwrites edits —
// though if every employee is later deleted, the next load reseeds this
// same starting list (same behavior as the raw-material seed in
// /api/inventory/items).
const JUNE_2026_SEED: Array<Omit<EmployeeDoc, "_id" | "createdAt" | "updatedAt">> = [
  { name: "Musangamfura Emmanuel", monthlySalary: 500000, rssbNumber: "20856339J", idNumber: "1199080046044090", active: true },
  { name: "Joshua NKUNDIMANA", monthlySalary: 30000, active: true },
  { name: "Niyogisubizo Jean Claude", monthlySalary: 50000, active: true },
  { name: "KWIZERA John (Mager)", monthlySalary: 40000, phone: "794352270", site: "mageragere", active: true },
  { name: "MUCYO GASPARD (Mager)", monthlySalary: 50000, phone: "796672110", site: "mageragere", active: true },
  { name: "Isimbi Liliane", monthlySalary: 200000, active: true },
  { name: "DIEUDONNE", monthlySalary: 30000, active: true },
];

async function ensureSeeded() {
  const count = await Employee.countDocuments();
  if (count > 0) return;
  await Employee.insertMany(
    JUNE_2026_SEED.map((e, i) => ({ _id: `emp-seed-${i + 1}`, ...e }))
  );
}

// GET /api/employees — list the full roster
export async function GET() {
  try {
    await connectDB();
    await ensureSeeded();
    const employees = await Employee.find({}).sort({ name: 1 }).lean();
    return NextResponse.json({ success: true, data: employees.map(normalize) });
  } catch (err) {
    console.error("GET /api/employees error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/employees — add a new employee
// Body: { name, monthlySalary, rssbNumber?, idNumber?, phone?, site? }
export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const { name, monthlySalary, rssbNumber, idNumber, phone, site } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ success: false, error: "name is required." }, { status: 400 });
    }
    const salary = Number(monthlySalary);
    if (isNaN(salary) || salary < 0) {
      return NextResponse.json(
        { success: false, error: "monthlySalary must be a non-negative number." },
        { status: 400 }
      );
    }

    const id = `emp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const created = await Employee.create({
      _id: id,
      name: name.trim(),
      monthlySalary: salary,
      rssbNumber: rssbNumber?.trim() || undefined,
      idNumber: idNumber?.trim() || undefined,
      phone: phone?.trim() || undefined,
      site: site || undefined,
      active: true,
    });

    return NextResponse.json({ success: true, data: normalize(created.toObject()) }, { status: 201 });
  } catch (err) {
    console.error("POST /api/employees error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
