import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Employee, { type EmployeeDoc } from "@/lib/models/Employee";

export const dynamic = "force-dynamic";

function normalize(doc: EmployeeDoc) {
  const { _id, createdAt, updatedAt, ...rest } = doc as EmployeeDoc & { __v?: number };
  delete (rest as Record<string, unknown>).__v;
  return { id: _id, ...rest };
}

// PATCH /api/employees/:id — edit name, salary, contact details, or
// active status. Editing an employee never rewrites past payroll entries;
// those keep the name/salary that was current when each entry was generated.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();
    const body = await req.json();
    const update: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (!String(body.name).trim()) {
        return NextResponse.json({ success: false, error: "name cannot be empty." }, { status: 400 });
      }
      update.name = String(body.name).trim();
    }
    if (body.monthlySalary !== undefined) {
      const salary = Number(body.monthlySalary);
      if (isNaN(salary) || salary < 0) {
        return NextResponse.json(
          { success: false, error: "monthlySalary must be a non-negative number." },
          { status: 400 }
        );
      }
      update.monthlySalary = salary;
    }
    if (body.rssbNumber !== undefined) update.rssbNumber = body.rssbNumber || undefined;
    if (body.idNumber !== undefined) update.idNumber = body.idNumber || undefined;
    if (body.phone !== undefined) update.phone = body.phone || undefined;
    if (body.site !== undefined) update.site = body.site || undefined;
    if (body.active !== undefined) update.active = Boolean(body.active);

    const updated = await Employee.findByIdAndUpdate(params.id, update, { new: true }).lean();
    if (!updated) {
      return NextResponse.json({ success: false, error: "Employee not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: normalize(updated) });
  } catch (err) {
    console.error("PATCH /api/employees/:id error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/employees/:id — remove an employee from the roster.
// Past payroll entries for this employee are left untouched (they're a
// historical record — the name/salary is already snapshotted on them).
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();
    const deleted = await Employee.findByIdAndDelete(params.id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: "Employee not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: { id: params.id } });
  } catch (err) {
    console.error("DELETE /api/employees/:id error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
