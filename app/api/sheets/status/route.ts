import { NextResponse } from "next/server";
import { isSheetsSyncConfigured } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

// GET /api/sheets/status — lets the client know whether Google Sheets
// sync is configured, without ever exposing the credentials themselves.
export async function GET() {
  return NextResponse.json({ configured: isSheetsSyncConfigured() });
}
