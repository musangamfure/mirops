import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Float, { type FloatDoc } from "@/lib/models/Float";

export const dynamic = "force-dynamic";


// GET /api/floats — returns { "YYYY-MM-DD": amount, ... }
export async function GET() {
  try {
    await connectDB();
    const floats = await Float.find().lean<FloatDoc[]>();
    const data: Record<string, number> = {};
    floats.forEach((f) => {
      data[f._id] = f.amount;
    });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("GET /api/floats error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PUT /api/floats — upsert the opening float for a date
// Body: { date: "YYYY-MM-DD", amount: number }
export async function PUT(req: Request) {
  try {
    await connectDB();
    const { date, amount } = await req.json();

    if (!date) {
      return NextResponse.json({ success: false, error: "date is required." }, { status: 400 });
    }
    const num = Number(amount);
    if (isNaN(num) || num < 0) {
      return NextResponse.json(
        { success: false, error: "amount must be a non-negative number." },
        { status: 400 }
      );
    }

    await Float.findByIdAndUpdate(
      date,
      { _id: date, amount: num },
      { upsert: true, new: true }
    );
    return NextResponse.json({ success: true, data: { date, amount: num } });
  } catch (err) {
    console.error("PUT /api/floats error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
