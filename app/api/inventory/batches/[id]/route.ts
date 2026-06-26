import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import ProductionBatch from "@/lib/models/ProductionBatch";
import StockMovement from "@/lib/models/StockMovement";
import {
  deductMix, restoreMix, resolveTransport, computeTotals,
  normalizeBatch, normalizeMovement,
} from "@/lib/batchCost";

export const dynamic = "force-dynamic";

// PATCH /api/inventory/batches/:id — edit a logged batch. Re-derives stock
// and cost from scratch:
//   1. Restore the old mix (add each old line's quantity back to stock).
//   2. Delete the old production_deduction movements for this batch.
//   3. Deduct the new mix and write fresh movements.
//   4. Recompute the cost breakdown and totals.
// Body shape matches POST: { date, tubeCount, note?, mix, costs }
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    const existing = await ProductionBatch.findById(params.id);
    if (!existing) {
      return NextResponse.json({ success: false, error: "Batch not found." }, { status: 404 });
    }

    const body = await req.json();
    const { date, tubeCount, note, mix, costs } = body;

    const count = Number(tubeCount);
    if (tubeCount === undefined || isNaN(count) || count <= 0) {
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

    // 1. Give back the stock the original batch consumed.
    await restoreMix(existing.mix.map((m) => ({ itemId: m.itemId, quantity: m.quantity })));

    // 2. Drop the old movements tied to this batch — they no longer
    // reflect what actually happened once we deduct the new mix below.
    await StockMovement.deleteMany({ batchId: params.id });

    // 3. Deduct the new mix and log fresh movements. If this fails
    // (e.g. unknown material), the old mix has already been restored —
    // not perfectly transactional without Mongo sessions, but it leaves
    // stock in a recoverable state rather than double-deducting.
    let resolvedMix;
    try {
      resolvedMix = await deductMix(validMixInput);
    } catch (e) {
      return NextResponse.json({ success: false, error: (e as Error).message }, { status: 400 });
    }

    const movements = [];
    for (const line of resolvedMix) {
      const mv = await StockMovement.create({
        _id: `${params.id}-${line.itemId}-${Date.now()}`,
        itemId: line.itemId,
        type: "production_deduction",
        quantity: -line.quantity,
        date: date ?? existing.date,
        note: `Used in batch of ${count} tubes`,
        batchId: params.id,
      });
      movements.push(normalizeMovement(mv.toObject()));
    }

    // 4. Recompute costs.
    const transportInput: { itemId: string; amount: number }[] =
      Array.isArray(costs?.transport) ? costs.transport : [];
    const resolvedTransport = resolveTransport(transportInput, resolvedMix);

    const baggingCost = Number(costs?.baggingCost) || 0;
    const plasticBagCost = Number(costs?.plasticBagCost) || 0;
    const sterilizationCost = Number(costs?.sterilizationCost) || 0;
    const { totalCost, costPerTube } = computeTotals(
      resolvedMix, resolvedTransport, baggingCost, plasticBagCost, sterilizationCost, count
    );

    existing.date = date ?? existing.date;
    existing.tubeCount = count;
    existing.note = note ?? existing.note;
    existing.mix = resolvedMix;
    existing.costs = { transport: resolvedTransport, baggingCost, plasticBagCost, sterilizationCost };
    existing.totalCost = totalCost;
    existing.costPerTube = costPerTube;
    await existing.save();

    return NextResponse.json({
      success: true,
      data: { batch: normalizeBatch(existing.toObject()), movements },
    });
  } catch (err) {
    console.error("PATCH /api/inventory/batches/:id error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/inventory/batches/:id — remove a batch, restore the stock it
// consumed, and remove its production_deduction movements.
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    const existing = await ProductionBatch.findById(params.id);
    if (!existing) {
      return NextResponse.json({ success: false, error: "Batch not found." }, { status: 404 });
    }

    await restoreMix(existing.mix.map((m) => ({ itemId: m.itemId, quantity: m.quantity })));
    await StockMovement.deleteMany({ batchId: params.id });
    await ProductionBatch.findByIdAndDelete(params.id);

    return NextResponse.json({ success: true, data: { id: params.id } });
  } catch (err) {
    console.error("DELETE /api/inventory/batches/:id error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
