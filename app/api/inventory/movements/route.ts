import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import StockMovement, { type StockMovementDoc } from "@/lib/models/StockMovement";
import InventoryItem from "@/lib/models/InventoryItem";

export const dynamic = "force-dynamic";

function normalize(doc: StockMovementDoc) {
  const { _id, createdAt, updatedAt, ...rest } = doc as StockMovementDoc & { __v?: number };
  delete (rest as Record<string, unknown>).__v;
  return { id: _id, ...rest };
}

const VALID_TYPES = ["stock_in", "stock_out", "production_deduction", "adjustment"];

// GET /api/inventory/movements — full movement history, most recent first
// Optional ?itemId=xxx to filter to one material's history.
export async function GET(req: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("itemId");
    const filter = itemId ? { itemId } : {};
    const movements = await StockMovement.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .limit(500)
      .lean();
    return NextResponse.json({ success: true, data: movements.map(normalize) });
  } catch (err) {
    console.error("GET /api/inventory/movements error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/inventory/movements — record a movement and update the item's
// running stock total atomically via $inc (avoids a read-then-write race
// if two movements are submitted close together).
// Body: { id, itemId, type, quantity, date, note?, batchId? }
// `quantity` is the raw, unsigned amount the user entered; this route
// applies the correct sign based on `type` before storing and applying it.
export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const { id, itemId, type, quantity, date, note, batchId } = body;

    if (!id || !itemId || !type || quantity === undefined || !date) {
      return NextResponse.json(
        { success: false, error: "id, itemId, type, quantity, and date are required." },
        { status: 400 }
      );
    }
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { success: false, error: `type must be one of: ${VALID_TYPES.join(", ")}.` },
        { status: 400 }
      );
    }
    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json(
        { success: false, error: "quantity must be a positive number." },
        { status: 400 }
      );
    }

    // stock_out and production_deduction reduce stock; stock_in adds;
    // adjustment can go either way, so its sign is taken as-given by the
    // caller via a negative quantity passed through `note`-less convention —
    // simplest, explicit approach: adjustment direction is encoded by the
    // caller sending a negative `quantity` directly. Other types are
    // unsigned from the client and signed here.
    let signedQty = qty;
    if (type === "stock_out" || type === "production_deduction") {
      signedQty = -qty;
    } else if (type === "adjustment") {
      signedQty = Number(quantity); // caller sends signed value directly
    }

    const item = await InventoryItem.findById(itemId);
    if (!item) {
      return NextResponse.json({ success: false, error: "Inventory item not found." }, { status: 404 });
    }

    await InventoryItem.findByIdAndUpdate(itemId, { $inc: { currentStock: signedQty } });

    const movement = await StockMovement.create({
      _id: id,
      itemId,
      type,
      quantity: signedQty,
      date,
      note: note ?? "",
      batchId,
    });

    return NextResponse.json({ success: true, data: normalize(movement.toObject()) }, { status: 201 });
  } catch (err) {
    console.error("POST /api/inventory/movements error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
