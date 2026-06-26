import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import StockMovement, { type StockMovementDoc } from "@/lib/models/StockMovement";
import InventoryItem from "@/lib/models/InventoryItem";

export const dynamic = "force-dynamic";

const VALID_TYPES = ["stock_in", "stock_out", "production_deduction", "adjustment"];

function normalize(doc: StockMovementDoc) {
  const { _id, createdAt, updatedAt, ...rest } = doc as StockMovementDoc & { __v?: number };
  delete (rest as Record<string, unknown>).__v;
  return { id: _id, ...rest };
}

// Movements created by logging a production batch are tied to that batch's
// mix/cost snapshot — editing or deleting them in isolation would desync
// the batch record, so they can only be changed by editing/deleting the
// batch itself.
function isBatchLinked(doc: { batchId?: string }) {
  return !!doc.batchId;
}

// PATCH /api/inventory/movements/:id — edit a manual movement (stock_in,
// stock_out, or adjustment). Re-applies the stock delta so currentStock
// stays correct: reverses the old signed quantity, then applies the new one.
// Body: { type?, quantity, date?, note? }
// `quantity` follows the same convention as POST /api/inventory/movements:
// unsigned for stock_in/stock_out, signed directly for adjustment.
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    const existing = await StockMovement.findById(params.id);
    if (!existing) {
      return NextResponse.json({ success: false, error: "Movement not found." }, { status: 404 });
    }
    if (isBatchLinked(existing)) {
      return NextResponse.json(
        { success: false, error: "This movement belongs to a production batch — edit the batch instead." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { type, quantity, date, note } = body;

    const newType = type ?? existing.type;
    if (!VALID_TYPES.includes(newType) || newType === "production_deduction") {
      return NextResponse.json(
        { success: false, error: "type must be one of: stock_in, stock_out, adjustment." },
        { status: 400 }
      );
    }

    let newSignedQty = existing.quantity;
    if (quantity !== undefined) {
      const q = Number(quantity);
      if (isNaN(q)) {
        return NextResponse.json({ success: false, error: "quantity must be a number." }, { status: 400 });
      }
      if (newType === "stock_in") newSignedQty = Math.abs(q);
      else if (newType === "stock_out") newSignedQty = -Math.abs(q);
      else newSignedQty = q; // adjustment: caller sends the signed delta directly
    } else if (newType !== existing.type) {
      // Type changed but no new quantity given — re-sign the existing magnitude.
      const magnitude = Math.abs(existing.quantity);
      newSignedQty = newType === "stock_in" ? magnitude : newType === "stock_out" ? -magnitude : existing.quantity;
    }

    const delta = newSignedQty - existing.quantity;
    if (delta !== 0) {
      await InventoryItem.findByIdAndUpdate(existing.itemId, { $inc: { currentStock: delta } });
    }

    existing.type = newType;
    existing.quantity = newSignedQty;
    if (date !== undefined) existing.date = date;
    if (note !== undefined) existing.note = note;
    await existing.save();

    return NextResponse.json({ success: true, data: normalize(existing.toObject()) });
  } catch (err) {
    console.error("PATCH /api/inventory/movements/:id error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/inventory/movements/:id — remove a manual movement and
// reverse its effect on the item's currentStock.
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    const existing = await StockMovement.findById(params.id);
    if (!existing) {
      return NextResponse.json({ success: false, error: "Movement not found." }, { status: 404 });
    }
    if (isBatchLinked(existing)) {
      return NextResponse.json(
        { success: false, error: "This movement belongs to a production batch — delete the batch instead." },
        { status: 400 }
      );
    }

    await InventoryItem.findByIdAndUpdate(existing.itemId, { $inc: { currentStock: -existing.quantity } });
    await StockMovement.findByIdAndDelete(params.id);

    return NextResponse.json({ success: true, data: { id: params.id } });
  } catch (err) {
    console.error("DELETE /api/inventory/movements/:id error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
