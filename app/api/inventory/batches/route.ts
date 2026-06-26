import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import ProductionBatch from "@/lib/models/ProductionBatch";
import StockMovement from "@/lib/models/StockMovement";
import { deductMix, resolveTransport, computeTotals, normalizeBatch, normalizeMovement } from "@/lib/batchCost";

export const dynamic = "force-dynamic";

// GET /api/inventory/batches — production batch history, most recent first
export async function GET() {
  try {
    await connectDB();
    const batches = await ProductionBatch.find({}).sort({ date: -1, createdAt: -1 }).lean();
    return NextResponse.json({ success: true, data: batches.map(normalizeBatch) });
  } catch (err) {
    console.error("GET /api/inventory/batches error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/inventory/batches — log a production batch with a free-form mix
// (any inventory material + any quantity, no fixed formula) and a full cost
// breakdown. Steps:
//   1. Resolve each mix line against InventoryItem to snapshot label/unit/
//      costPerUnit and compute materialCost (qty * costPerUnit), deducting
//      stock as we go.
//   2. Write a StockMovement (production_deduction) per mix line, tagged
//      with this batch.
//   3. Resolve transport line labels the same way.
//   4. Compute totalCost (materials + transport + bagging + plastic bag +
//      sterilization) and costPerTube, and store both on the batch.
// Body: {
//   id, date, tubeCount, note?,
//   mix: [{ itemId, quantity }],
//   costs: { transport: [{ itemId, amount }], baggingCost, plasticBagCost, sterilizationCost }
// }
export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const { id, date, tubeCount, note, mix, costs } = body;

    if (!id || !date || tubeCount === undefined) {
      return NextResponse.json(
        { success: false, error: "id, date, and tubeCount are required." },
        { status: 400 }
      );
    }
    const count = Number(tubeCount);
    if (isNaN(count) || count <= 0) {
      return NextResponse.json(
        { success: false, error: "tubeCount must be a positive number." },
        { status: 400 }
      );
    }

    const mixInput: { itemId: string; quantity: number }[] = Array.isArray(mix) ? mix : [];
    const validMixInput = mixInput.filter((m) => m && m.itemId && Number(m.quantity) > 0);
    if (validMixInput.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one mix material with a quantity > 0 is required." },
        { status: 400 }
      );
    }

    let resolvedMix;
    try {
      resolvedMix = await deductMix(validMixInput);
    } catch (e) {
      return NextResponse.json({ success: false, error: (e as Error).message }, { status: 400 });
    }

    const movements = [];
    for (const line of resolvedMix) {
      const mv = await StockMovement.create({
        _id: `${id}-${line.itemId}`,
        itemId: line.itemId,
        type: "production_deduction",
        quantity: -line.quantity,
        date,
        note: `Used in batch of ${count} tubes`,
        batchId: id,
      });
      movements.push(normalizeMovement(mv.toObject()));
    }

    const transportInput: { itemId: string; amount: number }[] =
      Array.isArray(costs?.transport) ? costs.transport : [];
    const resolvedTransport = resolveTransport(transportInput, resolvedMix);

    const baggingCost = Number(costs?.baggingCost) || 0;
    const plasticBagCost = Number(costs?.plasticBagCost) || 0;
    const sterilizationCost = Number(costs?.sterilizationCost) || 0;
    const { totalCost, costPerTube } = computeTotals(
      resolvedMix, resolvedTransport, baggingCost, plasticBagCost, sterilizationCost, count
    );

    const batch = await ProductionBatch.create({
      _id: id,
      date,
      tubeCount: count,
      note: note ?? "",
      mix: resolvedMix,
      costs: { transport: resolvedTransport, baggingCost, plasticBagCost, sterilizationCost },
      totalCost,
      costPerTube,
    });

    return NextResponse.json(
      { success: true, data: { batch: normalizeBatch(batch.toObject()), movements } },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/inventory/batches error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
