import type { AppState, AppAction, Transaction } from "./types";
import type { ProductId } from "./constants";
import { PRODUCTS, LOW_FLOAT_THRESHOLD } from "./constants";

// ─── DATE HELPERS ─────────────────────────────────────────────────────────────
/**
 * Returns today's date as YYYY-MM-DD in the browser's LOCAL timezone.
 * Using toISOString() would return UTC which is 2 hours behind Rwanda (UTC+2)
 * and can cause dates to appear on the wrong day.
 */
export function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ─── ID HELPER ───────────────────────────────────────────────────────────────
/**
 * Generates a client-side id used both as the local transaction id and (when
 * the database is reachable) as the Mongo _id, keeping local state and the
 * database record for the same transaction in sync.
 */
export function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ─── FORMATTER ───────────────────────────────────────────────────────────────
export function fmt(n: number | string | undefined): string {
  const num = Number(n ?? 0);
  return `RWF ${num.toLocaleString("en-US")}`;
}

// ─── INITIAL STATE ────────────────────────────────────────────────────────────
export function initState(): AppState {
  if (typeof window === "undefined") {
    return { transactions: [], activeDate: todayStr(), floats: {} };
  }
  try {
    // v4 → v5 migration: read v4 key, write to v5
    const v5 = localStorage.getItem("miru_ops_v5");
    if (v5) {
      const parsed = JSON.parse(v5) as AppState;
      return normalize(parsed);
    }

    const v4 = localStorage.getItem("miru_ops_v4");
    if (v4) {
      const parsed = JSON.parse(v4) as Partial<AppState>;
      return normalize({
        transactions: parsed.transactions ?? [],
        activeDate: parsed.activeDate ?? todayStr(),
        floats: parsed.floats ?? {},
      });
    }
  } catch {
    // corrupt storage — start fresh
  }
  return { transactions: [], activeDate: todayStr(), floats: {} };
}

/**
 * Maps legacy department ids (pre-Product rework) to their closest current
 * product id. "spawn" (Spawn Sales) had no direct successor in the new
 * 5-product lineup, so it's folded into "fresh" (Fresh Mushrooms) — the
 * nearest related product line.
 */
const LEGACY_DEPT_TO_PRODUCT: Record<string, string> = {
  tubes: "tubes",
  training: "trainings",
  spawn: "fresh",
  fresh: "fresh",
  cotton: "cotton",
  kitchen: "kitchen",
};

/**
 * Ensure every transaction has a string id (older versions used numeric ids),
 * that revenue transactions carry the new `product` field, and that any
 * transaction using the old, meals-only `mealSite` field has it folded into
 * the general `site` field (which now applies to every transaction kind).
 */
function normalize(state: AppState): AppState {
  return {
    ...state,
    transactions: state.transactions.map((t) => {
      const raw = t as Transaction & { dept?: string; mealSite?: string };
      const migrated = { ...raw, id: String(raw.id) };
      if (!migrated.product && raw.dept) {
        migrated.product = LEGACY_DEPT_TO_PRODUCT[raw.dept] as ProductId | undefined;
      }
      if (!migrated.site && raw.mealSite) {
        migrated.site = raw.mealSite as Transaction["site"];
      }
      delete (migrated as { dept?: string }).dept;
      delete (migrated as { mealSite?: string }).mealSite;
      return migrated as Transaction;
    }),
  };
}

// ─── REDUCER ─────────────────────────────────────────────────────────────────
export function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "ADD_TX": {
      const tx: Transaction = {
        ...action.payload,
        id: action.id ?? makeId(),
      };
      return { ...state, transactions: [tx, ...state.transactions] };
    }
    case "DEL_TX":
      return {
        ...state,
        transactions: state.transactions.filter((t) => t.id !== action.id),
      };
    case "SET_DATE":
      return { ...state, activeDate: action.date };
    case "SET_FLOAT":
      return {
        ...state,
        floats: { ...state.floats, [action.date]: action.amount },
      };
    case "ADD_FLOAT_TOPUP": {
      const tx: Transaction = {
        id: action.id ?? makeId(),
        kind: "float_topup",
        date: action.date,
        amount: action.amount,
        note: action.note || "Float top-up",
      };
      return { ...state, transactions: [tx, ...state.transactions] };
    }
    case "HYDRATE":
      return action.state;
    default:
      return state;
  }
}

// ─── FLOAT LOGIC ─────────────────────────────────────────────────────────────

/** All unique dates that have any data, sorted ascending */
export function getSortedDates(state: AppState): string[] {
  const set = new Set<string>(state.transactions.map((t) => t.date));
  Object.keys(state.floats).forEach((d) => set.add(d));
  return Array.from(set).sort();
}

/**
 * Opening float for a date.
 * Uses manual override if set; otherwise carries forward from previous day's closing.
 */
export function getOpeningFloat(state: AppState, date: string): number {
  if (state.floats[date] !== undefined) return state.floats[date];
  const prev = getSortedDates(state)
    .filter((d) => d < date)
    .at(-1);
  if (!prev) return 0;
  return getClosingFloat(state, prev);
}

/**
 * Closing float = opening + revenue + topups − expenses
 */
export function getClosingFloat(state: AppState, date: string): number {
  const opening = getOpeningFloat(state, date);
  const txs = state.transactions.filter((t) => t.date === date);
  const rev = sumKind(txs, "revenue");
  const exp = sumKind(txs, "expense");
  const topups = sumKind(txs, "float_topup");
  return opening + rev - exp + topups;
}

export function isLowFloat(closing: number): boolean {
  return closing >= 0 && closing < LOW_FLOAT_THRESHOLD;
}

export function isDeficit(closing: number): boolean {
  return closing < 0;
}

// ─── AGGREGATION HELPERS ─────────────────────────────────────────────────────

export function sumKind(
  txs: Transaction[],
  kind: Transaction["kind"]
): number {
  return txs
    .filter((t) => t.kind === kind)
    .reduce((s, t) => s + t.amount, 0);
}

export function byProduct(
  txs: Transaction[],
  kind: "revenue"
): Record<string, number> {
  const out: Record<string, number> = {};
  PRODUCTS.forEach((p) => { out[p.id] = 0; });
  txs
    .filter((t) => t.kind === kind)
    .forEach((t) => {
      if (t.product) out[t.product] = (out[t.product] ?? 0) + t.amount;
    });
  return out;
}

export function byCategory(
  txs: Transaction[],
  kind: "expense",
  categories: string[]
): Record<string, number> {
  const out: Record<string, number> = {};
  categories.forEach((c) => { out[c] = 0; });
  txs
    .filter((t) => t.kind === kind)
    .forEach((t) => {
      if (t.category) out[t.category] = (out[t.category] ?? 0) + t.amount;
    });
  return out;
}

/**
 * Revenue or expense totals grouped by site, across both kinds at once —
 * { siteId: { revenue, expense } } — so the dashboard can show a full
 * picture of money in vs. money out per location.
 */
export function bySite(
  txs: Transaction[],
  siteIds: string[]
): Record<string, { revenue: number; expense: number }> {
  const out: Record<string, { revenue: number; expense: number }> = {};
  siteIds.forEach((id) => { out[id] = { revenue: 0, expense: 0 }; });
  txs.forEach((t) => {
    if (t.kind !== "revenue" && t.kind !== "expense") return;
    if (!t.site) return;
    if (!out[t.site]) out[t.site] = { revenue: 0, expense: 0 };
    out[t.site][t.kind] += t.amount;
  });
  return out;
}

export function mealsBySiteToday(txs: Transaction[]): Record<string, number> {
  const out: Record<string, number> = {};
  txs
    .filter((t) => t.kind === "expense" && t.category === "Meals (Staff)")
    .forEach((t) => {
      const key = t.site ?? "unknown";
      out[key] = (out[key] ?? 0) + t.amount;
    });
  return out;
}
