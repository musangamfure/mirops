import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import PayrollEntry, { type PayrollEntryDoc } from "@/lib/models/Payroll";
import { computeNetSalary } from "@/lib/payroll";

export const dynamic = "force-dynamic";

function normalize(doc: PayrollEntryDoc) {
  const { _id, createdAt, updatedAt, ...rest } = doc as PayrollEntryDoc & { __v?: number };
  delete (rest as Record<string, unknown>).__v;
  return { id: _id, ...rest };
}

// PATCH /api/payroll/:id — edit days paid / deduction (Ideni) / net salary /
// paid status for a single employee's entry.
//
// netSalary is normally re-derived from monthlySalary/30 × daysToBePaid −
// ideni whenever days or ideni change. But it can also be set directly —
// e.g. to correct a historical entry, or to hand-adjust a one-off amount —
// in which case that exact value wins and is NOT recomputed. Toggling paid
// status alone never touches netSalary either way.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();
    const existing = await PayrollEntry.findById(params.id);
    if (!existing) {
      return NextResponse.json({ success: false, error: "Payroll entry not found." }, { status: 404 });
    }

    const body = await req.json();
    let shouldRecompute = false;

    if (body.daysToBePaid !== undefined) {
      const days = Number(body.daysToBePaid);
      if (isNaN(days) || days < 0) {
        return NextResponse.json(
          { success: false, error: "daysToBePaid must be a non-negative number." },
          { status: 400 }
        );
      }
      existing.daysToBePaid = days;
      shouldRecompute = true;
    }
    if (body.ideni !== undefined) {
      const ideni = Number(body.ideni);
      if (isNaN(ideni) || ideni < 0) {
        return NextResponse.json(
          { success: false, error: "ideni must be a non-negative number." },
          { status: 400 }
        );
      }
      existing.ideni = ideni;
      shouldRecompute = true;
    }
    if (body.basisOfCalculation !== undefined) {
      existing.basisOfCalculation = String(body.basisOfCalculation);
    }
    if (body.paid !== undefined) {
      existing.paid = Boolean(body.paid);
      existing.paidDate = existing.paid
        ? (body.paidDate || new Date().toISOString().slice(0, 10))
        : undefined;
    }

    if (body.netSalary !== undefined) {
      const net = Number(body.netSalary);
      if (isNaN(net) || net < 0) {
        return NextResponse.json(
          { success: false, error: "netSalary must be a non-negative number." },
          { status: 400 }
        );
      }
      existing.netSalary = net; // explicit override — wins over the formula
    } else if (shouldRecompute) {
      existing.netSalary = computeNetSalary(existing.monthlySalary, existing.daysToBePaid, existing.ideni);
    }

    await existing.save();

    return NextResponse.json({ success: true, data: normalize(existing.toObject()) });
  } catch (err) {
    console.error("PATCH /api/payroll/:id error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/payroll/:id — remove a single payroll entry (e.g. an
// employee who shouldn't have been included in that month's run).
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();
    const deleted = await PayrollEntry.findByIdAndDelete(params.id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: "Payroll entry not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: { id: params.id } });
  } catch (err) {
    console.error("DELETE /api/payroll/:id error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
