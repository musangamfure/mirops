import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Transaction, { type TransactionDoc } from "@/lib/models/Transaction";
import { appendTransactionToSheet } from "@/lib/googleSheets";
import type { Transaction as TxShape } from "@/lib/types";

// Always fetch live data — never statically cache or pre-render this route.
export const dynamic = "force-dynamic";


// Legacy department ids (pre-Product rework) mapped to their closest
// current product id. "spawn" had no direct successor in the new 5-product
// lineup, so it folds into "fresh" (Fresh Mushrooms).
const LEGACY_DEPT_TO_PRODUCT: Record<string, string> = {
  tubes: "tubes",
  training: "trainings",
  spawn: "fresh",
  fresh: "fresh",
  cotton: "cotton",
  kitchen: "kitchen",
};

function normalize(doc: TransactionDoc) {
  const { _id, createdAt, updatedAt, ...rest } = doc as TransactionDoc & {
    __v?: number;
    dept?: string;
    mealSite?: string;
  };
  // Strip any Mongoose internals (e.g. __v) that may be present via .lean()
  delete (rest as Record<string, unknown>).__v;
  // Migrate legacy `dept` documents (recorded before the Product rework) so
  // they still appear in product-based charts and totals.
  if (!rest.product && rest.dept) {
    rest.product = LEGACY_DEPT_TO_PRODUCT[rest.dept] ?? undefined;
  }
  // Migrate legacy `mealSite` (meals-only field) into the general `site`
  // field, which now applies to every transaction kind.
  if (!rest.site && rest.mealSite) {
    rest.site = rest.mealSite;
  }
  delete (rest as { dept?: string }).dept;
  delete (rest as { mealSite?: string }).mealSite;
  return { id: _id, ...rest };
}

// GET /api/transactions — all transactions, most recent first
export async function GET() {
  try {
    await connectDB();
    const txs = await Transaction.find()
      .sort({ date: -1, createdAt: -1 })
      .lean<TransactionDoc[]>();
    return NextResponse.json({ success: true, data: txs.map(normalize) });
  } catch (err) {
    console.error("GET /api/transactions error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/transactions — create a new transaction
// Body: { id, kind, date, amount, note?, product?, site?, category?, mealSession? }
// `id` is the client-generated id (also used as the Mongo _id) so the
// reducer's optimistic local state and the database stay in sync.
export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const { id, kind, date, amount, note, product, site, category, mealSession } = body;

    if (!id || !kind || !date || amount === undefined || amount === null) {
      return NextResponse.json(
        { success: false, error: "id, kind, date, and amount are required." },
        { status: 400 }
      );
    }
    if (!["revenue", "expense", "float_topup"].includes(kind)) {
      return NextResponse.json(
        { success: false, error: "kind must be 'revenue', 'expense', or 'float_topup'." },
        { status: 400 }
      );
    }
    const num = Number(amount);
    if (isNaN(num) || num <= 0) {
      return NextResponse.json(
        { success: false, error: "amount must be a positive number." },
        { status: 400 }
      );
    }

    const tx = await Transaction.create({
      _id: id,
      kind,
      date,
      amount: num,
      note: note ?? "",
      product,
      site,
      category,
      mealSession,
    });
    const normalized = normalize(tx.toObject());

    // Mirror to Google Sheets — best-effort, never blocks or fails the
    // response. The function itself swallows its own errors, but this
    // extra guard protects against any unexpected throw.
    appendTransactionToSheet(normalized as unknown as TxShape).catch(() => {});

    return NextResponse.json({ success: true, data: normalized }, { status: 201 });
  } catch (err) {
    console.error("POST /api/transactions error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
