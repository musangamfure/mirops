import { google } from "googleapis";
import type { Transaction } from "./types";
import { PRODUCTS, SITES } from "./constants";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
// Required env vars (see .env.local.example):
//   GOOGLE_SHEETS_ID            — the spreadsheet id from its URL
//   GOOGLE_SERVICE_ACCOUNT_EMAIL
//   GOOGLE_SERVICE_ACCOUNT_KEY  — the service account's private key
//
// If any are missing, sync is silently skipped — Sheets sync is an optional
// mirror, never a blocker for the app's core MongoDB-backed functionality.
const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
const SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
// Private keys are usually stored with literal "\n" sequences in env vars
// (since real newlines aren't valid in most .env formats) — convert them
// back to actual newlines before handing to the JWT client.
const SA_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");

const SHEET_TAB = "Transactions";
const SHEET_RANGE = `${SHEET_TAB}!A:K`;

export function isSheetsSyncConfigured(): boolean {
  return Boolean(SHEET_ID && SA_EMAIL && SA_KEY);
}

let cachedClient: ReturnType<typeof google.sheets> | null = null;

function getSheetsClient() {
  if (cachedClient) return cachedClient;
  if (!SA_EMAIL || !SA_KEY) return null;

  const auth = new google.auth.JWT({
    email: SA_EMAIL,
    key: SA_KEY,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  cachedClient = google.sheets({ version: "v4", auth });
  return cachedClient;
}

const HEADER_ROW = [
  "ID", "Date", "Kind", "Product", "Category", "Site",
  "Meal Session", "Amount (RWF)", "Note", "Recorded At",
];

function productLabel(id?: string): string {
  return PRODUCTS.find((p) => p.id === id)?.label ?? "";
}

function siteLabel(id?: string): string {
  return SITES.find((s) => s.id === id)?.label ?? "";
}

function txToRow(t: Transaction): string[] {
  return [
    t.id,
    t.date,
    t.kind,
    t.kind === "revenue" ? productLabel(t.product) : "",
    t.kind === "expense" ? (t.category ?? "") : "",
    siteLabel(t.site),
    t.mealSession ?? "",
    String(t.amount),
    t.note ?? "",
    new Date().toISOString(),
  ];
}

/**
 * Ensures the target sheet tab exists and has a header row. Safe to call
 * on every sync — it's a no-op if already set up. Failures here should
 * never crash the caller; they're logged and swallowed.
 */
async function ensureHeader(): Promise<void> {
  const sheets = getSheetsClient();
  if (!sheets || !SHEET_ID) return;

  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const hasTab = meta.data.sheets?.some(
      (s) => s.properties?.title === SHEET_TAB
    );
    if (!hasTab) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: SHEET_TAB } } }],
        },
      });
    }

    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_TAB}!A1:A1`,
    });
    if (!existing.data.values || existing.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_TAB}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [HEADER_ROW] },
      });
    }
  } catch (err) {
    console.error("Sheets ensureHeader error:", err);
  }
}

/**
 * Appends one transaction as a new row. Fire-and-forget from the caller's
 * perspective — errors are logged, never thrown, so a Sheets outage can
 * never block saving a transaction to the database.
 */
export async function appendTransactionToSheet(t: Transaction): Promise<void> {
  if (!isSheetsSyncConfigured()) return;
  const sheets = getSheetsClient();
  if (!sheets || !SHEET_ID) return;

  try {
    await ensureHeader();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: SHEET_RANGE,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [txToRow(t)] },
    });
  } catch (err) {
    console.error("Sheets append error:", err);
  }
}

/**
 * Marks a transaction's row as deleted by finding it by ID (column A) and
 * clearing its contents, rather than physically removing the row — this
 * keeps row numbers stable for anyone with the sheet open, and leaves a
 * visible trace rather than silently vanishing data.
 */
export async function markTransactionDeletedInSheet(id: string): Promise<void> {
  if (!isSheetsSyncConfigured()) return;
  const sheets = getSheetsClient();
  if (!sheets || !SHEET_ID) return;

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: SHEET_RANGE,
    });
    const rows = res.data.values ?? [];
    const rowIndex = rows.findIndex((row) => row[0] === id);
    if (rowIndex === -1) return; // not found — nothing to do

    const sheetRowNumber = rowIndex + 1; // 1-indexed, matches sheet rows
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_TAB}!I${sheetRowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [["[DELETED]"]] },
    });
  } catch (err) {
    console.error("Sheets delete-mark error:", err);
  }
}
