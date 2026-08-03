import { connectDB } from "./mongodb";
import Transaction, { type TransactionDoc } from "./models/Transaction";
import Float from "./models/Float";
import PayrollEntry from "./models/Payroll";
import { PRODUCTS, SITES, LOW_FLOAT_THRESHOLD } from "./constants";
import type { Transaction as Tx, AppState } from "./types";
import {
  sumKind, byProduct, byCategory, bySite, mealsBySiteToday, fmt,
  getOpeningFloat, getClosingFloat, isLowFloat, isDeficit,
} from "./store";

// Same legacy-field migration used elsewhere — kept in sync since the cron
// job reads the DB directly (not via the API).
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

/** Last calendar day of `month` (YYYY-MM) as YYYY-MM-DD. */
function lastDayOfMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)); // day 0 of next month = last day of this month
  return last.toISOString().slice(0, 10);
}

function firstDayOfMonth(month: string): string {
  return `${month}-01`;
}

/** Every YYYY-MM-DD date in `month`, in order. */
function allDatesInMonth(month: string): string[] {
  const last = lastDayOfMonth(month);
  const lastDay = Number(last.slice(8, 10));
  const out: string[] = [];
  for (let d = 1; d <= lastDay; d++) {
    out.push(`${month}-${String(d).padStart(2, "0")}`);
  }
  return out;
}

/** Previous calendar month (YYYY-MM) for `month` (YYYY-MM). */
function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1)); // m is 1-indexed; -2 steps back one month
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, 1));
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

function pct(part: number, whole: number): string {
  if (!whole) return "—";
  return `${((part / whole) * 100).toFixed(0)}%`;
}

export interface MonthlySummary {
  subject: string;
  html: string;
  text: string;
  hasActivity: boolean;
}

/**
 * Builds the full monthly digest for `month` (YYYY-MM): revenue & expense
 * totals with category/department breakdowns, per-site P&L, payroll paid,
 * cash-float health across the month, and an overall company-health
 * verdict comparing against the previous month. Reuses the same pure
 * helpers (byProduct, byCategory, getOpeningFloat, etc.) the dashboard and
 * daily summary use, so the numbers always match what's on screen.
 */
export async function buildMonthlySummary(month: string): Promise<MonthlySummary> {
  await connectDB();

  const first = firstDayOfMonth(month);
  const last = lastDayOfMonth(month);
  const prevM = prevMonth(month);

  // Need full history up to the end of this month for the opening-float
  // carry-forward chain and for the prior-month comparison — YYYY-MM-DD
  // strings sort lexicographically the same as chronologically, so a
  // plain $lte comparison works (same trick as the daily summary).
  const [txDocs, floatDocs, paidThisMonth] = await Promise.all([
    Transaction.find({ date: { $lte: last } }).lean<TransactionDoc[]>(),
    Float.find({ _id: { $lte: last } }).lean<{ _id: string; amount: number }[]>(),
    PayrollEntry.find({ month }).lean(),
  ]);

  const transactions = txDocs.map(normalizeTx);
  const floats: Record<string, number> = {};
  floatDocs.forEach((f) => { floats[f._id] = f.amount; });
  const state: AppState = { transactions, activeDate: last, floats };

  const monthTx = transactions.filter((t) => t.date >= first && t.date <= last);
  const prevMonthTx = transactions.filter((t) => t.date.slice(0, 7) === prevM);

  const revenue = sumKind(monthTx, "revenue");
  const expense = sumKind(monthTx, "expense");
  const topups = sumKind(monthTx, "float_topup");
  const net = revenue - expense;

  const prevRevenue = sumKind(prevMonthTx, "revenue");
  const prevExpense = sumKind(prevMonthTx, "expense");
  const prevNet = prevRevenue - prevExpense;

  const revByProduct = byProduct(monthTx, "revenue");
  const expenseCatsRaw = Array.from(
    new Set(monthTx.filter((t) => t.kind === "expense" && t.category).map((t) => t.category as string))
  );
  const expByCategory = byCategory(monthTx, "expense", expenseCatsRaw);
  // Highest spend first
  const expenseCats = [...expenseCatsRaw].sort((a, b) => (expByCategory[b] ?? 0) - (expByCategory[a] ?? 0));

  const siteTotals = bySite(monthTx, SITES.map((s) => s.id));
  const meals = mealsBySiteToday(monthTx); // filters by category only — safe to reuse for any tx window
  const totalMealsSpend = Object.values(meals).reduce((s, n) => s + n, 0);

  const payrollTotal = paidThisMonth.reduce((s, p) => s + (p.paid ? p.netSalary : 0), 0);
  const paidCount = paidThisMonth.filter((p) => p.paid).length;

  // ── Float health across every day of the month ──
  const dates = allDatesInMonth(month);
  const openingFloat = getOpeningFloat(state, first);
  const closingFloat = getClosingFloat(state, last);
  let deficitDays = 0;
  let lowDays = 0;
  let lowestClose = closingFloat;
  let lowestCloseDate = last;
  dates.forEach((d) => {
    const close = getClosingFloat(state, d);
    if (isDeficit(close)) deficitDays++;
    else if (isLowFloat(close)) lowDays++;
    if (close < lowestClose) { lowestClose = close; lowestCloseDate = d; }
  });

  // ── Overall company-health verdict ──
  const revenueChangePct = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null;
  const netChangePct = prevNet !== 0 ? ((net - prevNet) / Math.abs(prevNet)) * 100 : null;

  const concerns: string[] = [];
  if (net < 0) concerns.push("The month closed with a net loss (expenses exceeded revenue).");
  if (deficitDays > 0) concerns.push(`Cash float went into deficit on ${deficitDays} day${deficitDays === 1 ? "" : "s"}.`);
  if (revenueChangePct !== null && revenueChangePct <= -15) {
    concerns.push(`Revenue dropped ${Math.abs(revenueChangePct).toFixed(0)}% vs. ${formatMonthLabel(prevM)}.`);
  }

  const cautions: string[] = [];
  if (lowDays > 0 && deficitDays === 0) cautions.push(`Cash float ran low (under ${fmt(LOW_FLOAT_THRESHOLD)}) on ${lowDays} day${lowDays === 1 ? "" : "s"}.`);
  if (revenueChangePct !== null && revenueChangePct < 0 && revenueChangePct > -15) {
    cautions.push(`Revenue was down ${Math.abs(revenueChangePct).toFixed(0)}% vs. ${formatMonthLabel(prevM)}.`);
  }

  let healthLabel: string;
  let healthColor: string;
  if (concerns.length > 0) { healthLabel = "🔴 Needs Attention"; healthColor = "#b03a2e"; }
  else if (cautions.length > 0) { healthLabel = "🟡 Caution"; healthColor = "#b8860b"; }
  else { healthLabel = "🟢 Healthy"; healthColor = "#2D6A4F"; }

  const healthNotes = concerns.length > 0 ? concerns : cautions.length > 0 ? cautions : [
    "Revenue covered expenses with a positive net, and the cash float stayed above the low-float threshold all month.",
  ];

  const dateLabel = formatMonthLabel(month);
  const hasActivity = monthTx.length > 0 || paidThisMonth.length > 0;

  // ── Plain text ──
  const lines: string[] = [];
  lines.push(`Miru Mushrooms — Monthly Report — ${dateLabel}`);
  lines.push("");
  lines.push(`Overall health: ${healthLabel}`);
  healthNotes.forEach((n) => lines.push(`  - ${n}`));
  lines.push("");
  lines.push(`Revenue: ${fmt(revenue)}   Expenses: ${fmt(expense)}   Net: ${fmt(net)}`);
  if (revenueChangePct !== null) lines.push(`Revenue vs. ${formatMonthLabel(prevM)}: ${revenueChangePct >= 0 ? "+" : ""}${revenueChangePct.toFixed(1)}%`);
  if (netChangePct !== null) lines.push(`Net vs. ${formatMonthLabel(prevM)}: ${netChangePct >= 0 ? "+" : ""}${netChangePct.toFixed(1)}%`);
  if (topups > 0) lines.push(`Float top-ups: ${fmt(topups)}`);
  lines.push("");
  lines.push("Revenue by department:");
  PRODUCTS.forEach((p) => {
    if (revByProduct[p.id]) lines.push(`  ${p.emoji} ${p.label}: ${fmt(revByProduct[p.id])} (${pct(revByProduct[p.id], revenue)})`);
  });
  if (expenseCats.length > 0) {
    lines.push("");
    lines.push("Expenses by category:");
    expenseCats.forEach((c) => lines.push(`  ${c}: ${fmt(expByCategory[c])} (${pct(expByCategory[c], expense)})`));
  }
  lines.push("");
  lines.push("By site:");
  SITES.forEach((s) => {
    const t = siteTotals[s.id];
    if (t && (t.revenue || t.expense)) {
      lines.push(`  ${s.emoji} ${s.label}: revenue ${fmt(t.revenue)}, expenses ${fmt(t.expense)}, net ${fmt(t.revenue - t.expense)}`);
    }
  });
  if (totalMealsSpend > 0) {
    lines.push("");
    lines.push(`Staff meals this month: ${fmt(totalMealsSpend)}`);
  }
  if (paidCount > 0) {
    lines.push("");
    lines.push(`Payroll paid this month (${paidCount}): ${fmt(payrollTotal)}`);
  }
  lines.push("");
  lines.push(`Cash float: opened at ${fmt(openingFloat)}, closed at ${fmt(closingFloat)}.`);
  lines.push(`Lowest closing balance: ${fmt(lowestClose)} on ${lowestCloseDate}.`);
  if (deficitDays > 0) lines.push(`⚠️ Deficit on ${deficitDays} day(s).`);
  if (lowDays > 0) lines.push(`🟡 Running low on ${lowDays} day(s).`);
  if (!hasActivity) {
    lines.push("");
    lines.push("No transactions were recorded this month.");
  }
  const text = lines.join("\n");

  // ── HTML ──
  const row = (label: string, value: string, color = "#1b3a1b") =>
    `<tr><td style="padding:6px 0;color:#4a6b4a;font-size:13px;">${esc(label)}</td>` +
    `<td style="padding:6px 0;text-align:right;font-weight:700;color:${color};font-size:13px;">${esc(value)}</td></tr>`;

  const productRows = PRODUCTS.filter((p) => revByProduct[p.id])
    .map((p) => row(`${p.emoji} ${p.label}`, `${fmt(revByProduct[p.id])} (${pct(revByProduct[p.id], revenue)})`, "#2D6A4F"))
    .join("");
  const expenseRows = expenseCats
    .map((c) => row(c, `${fmt(expByCategory[c])} (${pct(expByCategory[c], expense)})`, "#b03a2e"))
    .join("");
  const siteRows = SITES.filter((s) => siteTotals[s.id] && (siteTotals[s.id].revenue || siteTotals[s.id].expense))
    .map((s) => {
      const t = siteTotals[s.id];
      return row(`${s.emoji} ${s.label}`, `Rev ${fmt(t.revenue)} · Exp ${fmt(t.expense)} · Net ${fmt(t.revenue - t.expense)}`, t.revenue - t.expense >= 0 ? "#2D6A4F" : "#b03a2e");
    })
    .join("");
  const floatRows = [
    row("Opening Float", fmt(openingFloat)),
    row("Closing Float", fmt(closingFloat)),
    row("Lowest Balance", `${fmt(lowestClose)} (${lowestCloseDate})`, lowestClose < 0 ? "#b03a2e" : lowestClose < LOW_FLOAT_THRESHOLD ? "#b8860b" : "#1b3a1b"),
    deficitDays > 0 ? row("Deficit Days", String(deficitDays), "#b03a2e") : "",
    lowDays > 0 ? row("Low-Float Days", String(lowDays), "#b8860b") : "",
  ].join("");

  const section = (title: string, rows: string) =>
    rows
      ? `<h3 style="margin:24px 0 8px;font-size:14px;color:#0f2e17;border-bottom:1px solid #d8e6d8;padding-bottom:6px;">${esc(title)}</h3>
         <table style="width:100%;border-collapse:collapse;">${rows}</table>`
      : "";

  const healthNotesHtml = healthNotes.map((n) => `<li style="margin-bottom:4px;">${esc(n)}</li>`).join("");

  const changeLine = (label: string, changePct: number | null) =>
    changePct === null
      ? ""
      : `<div style="font-size:12px;color:${changePct >= 0 ? "#2D6A4F" : "#b03a2e"};margin-top:2px;">${esc(label)} vs. ${esc(formatMonthLabel(prevM))}: ${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}%</div>`;

  const html = `
  <div style="font-family:Georgia,'Times New Roman',serif;max-width:560px;margin:0 auto;background:#fbfdfb;color:#1b3a1b;padding:28px;border:1px solid #d8e6d8;border-radius:12px;">
    <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#4a6b4a;">Miru Mushrooms — Operations</div>
    <h1 style="margin:4px 0 4px;font-size:22px;color:#0f2e17;">Monthly Report — ${esc(dateLabel)}</h1>

    <table style="width:100%;border-collapse:collapse;background:#eef6ee;border-radius:8px;padding:14px;display:table;margin-top:14px;">
      <tr>
        <td style="padding:14px;">
          <div style="font-size:13px;color:#4a6b4a;">Overall Company Health</div>
          <div style="font-size:18px;font-weight:700;color:${healthColor};margin:2px 0 8px;">${esc(healthLabel)}</div>
          <ul style="margin:0;padding-left:18px;font-size:13px;color:#2f4a2f;">${healthNotesHtml}</ul>
        </td>
      </tr>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-top:16px;">
      ${row("Total Revenue", fmt(revenue), "#2D6A4F")}
      ${row("Total Expenses", fmt(expense), "#b03a2e")}
      ${row("Net for the Month", fmt(net), net >= 0 ? "#2D6A4F" : "#b03a2e")}
      ${topups > 0 ? row("Float Top-ups", fmt(topups)) : ""}
    </table>
    ${changeLine("Revenue", revenueChangePct)}
    ${changeLine("Net", netChangePct)}

    ${section("Revenue by Department", productRows)}
    ${section("Expenses by Category", expenseRows)}
    ${section("By Site", siteRows)}
    ${totalMealsSpend > 0 ? section(`Staff Meals This Month — ${fmt(totalMealsSpend)}`, "") : ""}
    ${paidCount > 0 ? section(`Payroll Paid This Month (${paidCount}) — ${fmt(payrollTotal)}`, "") : ""}
    ${section("Cash Float Health", floatRows)}

    ${!hasActivity ? `<p style="color:#4a6b4a;font-size:13px;margin-top:20px;font-style:italic;">No transactions were recorded this month.</p>` : ""}

    <p style="margin-top:28px;font-size:11px;color:#8aa88a;">Sent automatically at 9pm on the 1st of the month — Miru Ops Dashboard</p>
  </div>`;

  return {
    subject: `Miru Mushrooms — Monthly Report — ${dateLabel}`,
    html,
    text,
    hasActivity,
  };
}

/**
 * Kigali (UTC+2, no DST) YYYY-MM for "the month that should be reported on
 * right now". A monthly cron firing on the 1st reports on the month that
 * just ended, so this returns the *previous* calendar month relative to
 * today's Kigali date.
 */
export function kigaliReportMonthStr(now: Date = new Date()): string {
  const kigali = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const y = kigali.getUTCFullYear();
  const m = kigali.getUTCMonth() + 1; // 1-indexed, current month
  const prev = new Date(Date.UTC(y, m - 2, 1)); // step back one month
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
}
