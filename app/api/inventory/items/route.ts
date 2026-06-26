import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import InventoryItem, { type InventoryItemDoc } from "@/lib/models/InventoryItem";
import { RAW_MATERIALS } from "@/lib/constants";

export const dynamic = "force-dynamic";

function normalize(doc: InventoryItemDoc) {
  const { _id, createdAt, updatedAt, ...rest } = doc as InventoryItemDoc & { __v?: number };
  delete (rest as Record<string, unknown>).__v;
  return { id: _id, ...rest };
}

/**
 * Ensures all 8 raw materials from RAW_MATERIALS have an InventoryItem
 * document. Safe to call on every GET — only inserts materials that don't
 * already exist, never overwrites existing stock levels.
 */
async function ensureSeeded() {
  const existing = await InventoryItem.find({}, { _id: 1 }).lean();
  const existingIds = new Set(existing.map((d) => d._id));
  const missing = RAW_MATERIALS.filter((m) => !existingIds.has(m.id));
  if (missing.length === 0) return;

  await InventoryItem.insertMany(
    missing.map((m) => ({
      _id: m.id,
      label: m.label,
      unit: m.unit,
      currentStock: 0,
      reorderThreshold: 0,
      costPerUnit: 0,
    }))
  );
}

// GET /api/inventory/items — list all raw material stock levels
export async function GET() {
  try {
    await connectDB();
    await ensureSeeded();
    const items = await InventoryItem.find({}).sort({ label: 1 }).lean();
    return NextResponse.json({ success: true, data: items.map(normalize) });
  } catch (err) {
    console.error("GET /api/inventory/items error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/inventory/items — create a new raw material (not one of the
// original seeded set). Body: { label, unit, costPerUnit?, reorderThreshold?, currentStock? }
// The id is slugified from the label; if that id is already taken, a short
// numeric suffix is appended.
export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const { label, unit, costPerUnit, reorderThreshold, currentStock } = body;

    if (!label || typeof label !== "string" || !label.trim()) {
      return NextResponse.json({ success: false, error: "label is required." }, { status: 400 });
    }
    if (!unit || typeof unit !== "string" || !unit.trim()) {
      return NextResponse.json({ success: false, error: "unit is required." }, { status: 400 });
    }

    const baseId = label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "material";

    let id = baseId;
    let suffix = 1;
    while (await InventoryItem.exists({ _id: id })) {
      suffix += 1;
      id = `${baseId}_${suffix}`;
    }

    const created = await InventoryItem.create({
      _id: id,
      label: label.trim(),
      unit: unit.trim(),
      currentStock: Number(currentStock) || 0,
      reorderThreshold: Number(reorderThreshold) || 0,
      costPerUnit: Number(costPerUnit) || 0,
    });

    return NextResponse.json({ success: true, data: normalize(created.toObject()) }, { status: 201 });
  } catch (err) {
    console.error("POST /api/inventory/items error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PATCH /api/inventory/items — update an item's reorder threshold or cost/unit
// Body: { id, reorderThreshold?, costPerUnit? }
export async function PATCH(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const { id, reorderThreshold, costPerUnit } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: "id is required." }, { status: 400 });
    }

    const update: Record<string, number> = {};
    if (reorderThreshold !== undefined) update.reorderThreshold = Number(reorderThreshold);
    if (costPerUnit !== undefined) update.costPerUnit = Number(costPerUnit);

    const updated = await InventoryItem.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!updated) {
      return NextResponse.json({ success: false, error: "Item not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: normalize(updated) });
  } catch (err) {
    console.error("PATCH /api/inventory/items error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
