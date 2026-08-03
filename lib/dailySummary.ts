import { connectDB } from "./mongodb";
import Transaction, { type TransactionDoc } from "./models/Transaction";
import Float from "./models/Float";
import PayrollEntry from "./models/Payroll";
import { PRODUCTS, SITES } from "./constants";
import type { Transaction as Tx, AppState } from "./types";
import {
  sumKind, byProduct, byCategory, mealsBySiteToday,
  getOpeningFloat, getClosingFloat, isLowFloat, isDeficit, fmt,
} from "./store";

// Same legacy-field migration used in app/api/transactions/route.ts, kept
// in sync here since the cron job reads the DB directly (not via the API).
const LEGACY_DEPT_TO_PRODUCT: Record<string, string> = {
  tubes: "tubes", training: "trainings", spawn: "fresh", fresh: "fresh",
  cotton: "cotton", kitchen: "kitchen",
};

function normalizeTx(doc: TransactionDoc & { dept?: string }): Tx {
  let product = doc.product;
  let site = doc.site;
  if (!product && doc.dept) product = LEGACY_DEPT_TO_PRODUCT[doc.dept];
  if (!site && doc.mealSite) site = doc.mealSite;
  return {
    id: doc._id,
    kind: doc.kind,
    date: doc.date,
    amount: doc.amount,
    note: doc.note ?? "",
    product: product as Tx["product"],
    site: site as Tx["site"],
    category: doc.category,
    mealSession: doc.mealSession as Tx["mealSession"],
    bulkStart: doc.bulkStart,
    bulkEnd: doc.bulkEnd,
  };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Kigali (Africa/Kigali, UTC+2, no DST — Rwanda never observes daylight
 * saving) date string for "right now". Used so the cron job — which runs
 * on Vercel's UTC clock — asks for the correct local business day.
 */
export function kigaliTodayStr(now: Date = new Date()): string {
  const kigali = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  return kigali.toISOString().slice(0, 10);
}

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
}

export interface DailySummary {
  subject: string;
  html: string;
  text: string;
  hasActivity: boolean;
}

/**
 * Builds the full daily digest for `date` (YYYY-MM-DD): float movement,
 * revenue/expense totals and breakdowns, meals served, and any payroll
 * paid that day. Reuses the same pure helpers (getOpeningFloat, byProduct,
 * etc.) the dashboard itself uses, so the numbers always match what's on
 * screen.
 */
export async function buildDailySummary(date: string): Promise<DailySummary> {
  await connectDB();

  // Only need history up to `date` for the opening-float carry-forward
  // chain — YYYY-MM-DD strings sort lexicographically the same as
  // chronologically, so a plain $lte comparison works.
  const [txDocs, floatDocs, paidToday] = await Promise.all([
    Transaction.find({ date: { $lte: date } }).lean<TransactionDoc[]>(),
    Float.find({ _id: { $lte: date } }).lean<{ _id: string; amount: number }[]>(),
    PayrollEntry.find({ paidDate: date }).lean(),
  ]);

  const transactions = txDocs.map(normalizeTx);
  const floats: Record<string, number> = {};
  floatDocs.forEach((f) => { floats[f._id] = f.amount; });
  const state: AppState = { transactions, activeDate: date, floats };

  const todaysTx = transactions.filter((t) => t.date === date);
  const revenue = sumKind(todaysTx, "revenue");
  const expense = sumKind(todaysTx, "expense");
  const topups = sumKind(todaysTx, "float_topup");
  const net = revenue - expense;

  const opening = getOpeningFloat(state, date);
  const closing = getClosingFloat(state, date);

  const revByProduct = byProduct(todaysTx, "revenue");
  const expenseCats = Array.from(
    new Set(todaysTx.filter((t) => t.kind === "expense" && t.category).map((t) => t.category as string))
  );
  const expByCategory = byCategory(todaysTx, "expense", expenseCats);
  const meals = mealsBySiteToday(todaysTx);
  const totalMealsSpend = Object.values(meals).reduce((s, n) => s + n, 0);

  const payrollTotal = paidToday.reduce((s, p) => s + p.netSalary, 0);

  const floatStatus = isDeficit(closing) ? "⚠️ IN DEFICIT" : isLowFloat(closing) ? "🟡 Running low" : "🟢 Healthy";
  const dateLabel = formatDateLabel(date);
  const hasActivity = todaysTx.length > 0 || paidToday.length > 0;

  // ── Plain text ──
  const lines: string[] = [];
  lines.push(`Miru Mushrooms — Daily Summary — ${dateLabel}`);
  lines.push("");
  lines.push(`Float: ${fmt(opening)} opening → ${fmt(closing)} closing (${floatStatus})`);
  lines.push(`Revenue: ${fmt(revenue)}   Expenses: ${fmt(expense)}   Net: ${fmt(net)}`);
  if (topups > 0) lines.push(`Float top-ups: ${fmt(topups)}`);
  lines.push("");
  lines.push("Revenue by department:");
  PRODUCTS.forEach((p) => {
    if (revByProduct[p.id]) lines.push(`  ${p.emoji} ${p.label}: ${fmt(revByProduct[p.id])}`);
  });
  if (expenseCats.length > 0) {
    lines.push("");
    lines.push("Expenses by category:");
    expenseCats.forEach((c) => lines.push(`  ${c}: ${fmt(expByCategory[c])}`));
  }
  if (totalMealsSpend > 0) {
    lines.push("");
    lines.push("Staff meals (spend by site):");
    SITES.forEach((s) => {
      if (meals[s.id]) lines.push(`  ${s.emoji} ${s.label}: ${fmt(meals[s.id])}`);
    });
    lines.push(`  Total: ${fmt(totalMealsSpend)}`);
  }
  if (paidToday.length > 0) {
    lines.push("");
    lines.push(`Payroll paid today (${paidToday.length}): ${fmt(payrollTotal)}`);
    paidToday.forEach((p) => lines.push(`  ${p.employeeName}: ${fmt(p.netSalary)}`));
  }
  if (!hasActivity) {
    lines.push("");
    lines.push("No transactions were recorded today.");
  }
  const text = lines.join("\n");

  // ── HTML ──
  const row = (label: string, value: string, color = "#1b3a1b") =>
    `<tr><td style="padding:6px 0;color:#4a6b4a;font-size:13px;">${esc(label)}</td>` +
    `<td style="padding:6px 0;text-align:right;font-weight:700;color:${color};font-size:13px;">${esc(value)}</td></tr>`;

  const productRows = PRODUCTS.filter((p) => revByProduct[p.id])
    .map((p) => row(`${p.emoji} ${p.label}`, fmt(revByProduct[p.id]), "#2D6A4F"))
    .join("");
  const expenseRows = expenseCats.map((c) => row(c, fmt(expByCategory[c]), "#b03a2e")).join("");
  const mealRows = SITES.filter((s) => meals[s.id])
    .map((s) => row(`${s.emoji} ${s.label}`, fmt(meals[s.id]), "#b03a2e"))
    .join("");
  const payrollRows = paidToday.map((p) => row(p.employeeName, fmt(p.netSalary), "#2D6A4F")).join("");

  const section = (title: string, rows: string) =>
    rows
      ? `<h3 style="margin:24px 0 8px;font-size:14px;color:#0f2e17;border-bottom:1px solid #d8e6d8;padding-bottom:6px;">${esc(title)}</h3>
         <table style="width:100%;border-collapse:collapse;">${rows}</table>`
      : "";

  const html = `
  <div style="font-family:Georgia,'Times New Roman',serif;max-width:560px;margin:0 auto;background:#fbfdfb;color:#1b3a1b;padding:28px;border:1px solid #d8e6d8;border-radius:12px;">
    <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#4a6b4a;">Miru Mushrooms — Operations</div>
    <h1 style="margin:4px 0 20px;font-size:22px;color:#0f2e17;">${esc(dateLabel)}</h1>

    <table style="width:100%;border-collapse:collapse;background:#eef6ee;border-radius:8px;padding:14px;display:table;">
      <tr>
        <td style="padding:14px;">
          <table style="width:100%;border-collapse:collapse;">
            ${row("Opening Float", fmt(opening))}
            ${row("Closing Float", fmt(closing))}
            ${row("Status", floatStatus)}
            ${topups > 0 ? row("Float Top-ups", fmt(topups)) : ""}
          </table>
        </td>
      </tr>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-top:16px;">
      ${row("Total Revenue", fmt(revenue), "#2D6A4F")}
      ${row("Total Expenses", fmt(expense), "#b03a2e")}
      ${row("Net for the Day", fmt(net), net >= 0 ? "#2D6A4F" : "#b03a2e")}
    </table>

    ${section("Revenue by Department", productRows)}
    ${section("Expenses by Category", expenseRows)}
    ${totalMealsSpend > 0 ? section(`Staff Meals by Site — ${fmt(totalMealsSpend)}`, mealRows) : ""}
    ${paidToday.length > 0 ? section(`Payroll Paid Today — ${fmt(payrollTotal)}`, payrollRows) : ""}

    ${!hasActivity ? `<p style="color:#4a6b4a;font-size:13px;margin-top:20px;font-style:italic;">No transactions were recorded today.</p>` : ""}

    <p style="margin-top:28px;font-size:11px;color:#8aa88a;">Sent automatically at 9pm — Miru Ops Dashboard</p>
  </div>`;

  return {
    subject: `Miru Mushrooms — Daily Summary — ${dateLabel}`,
    html,
    text,
    hasActivity,
  };
}
