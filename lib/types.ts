import type { DeptId, SiteId, ExpenseCat, MealSession } from "./constants";

export type { DeptId, SiteId };


// ─── TRANSACTION ─────────────────────────────────────────────────────────────
export type TxKind = "revenue" | "expense" | "float_topup";

export interface Transaction {
  id: string;
  kind: TxKind;
  date: string;          // YYYY-MM-DD
  amount: number;
  note: string;
  // revenue / expense fields
  dept?: DeptId;
  site?: SiteId;
  // expense-specific
  category?: ExpenseCat;
  // meals
  mealSite?: SiteId;
  mealSession?: MealSession;
  // top-up (no dept/site needed)
}

// ─── APP STATE ───────────────────────────────────────────────────────────────
export interface AppState {
  transactions: Transaction[];
  activeDate: string;       // YYYY-MM-DD currently viewed
  /** floats[date] = manually-set opening float for that date */
  floats: Record<string, number>;
}

// ─── FORM STATE (for Record Entry) ───────────────────────────────────────────
export interface EntryForm {
  kind: "revenue" | "expense";
  dept: DeptId;
  site: SiteId;
  category: ExpenseCat | "";
  mealSite: SiteId;
  mealSession: MealSession;
  amount: string;
  note: string;
}

// ─── REDUCER ACTIONS ─────────────────────────────────────────────────────────
export type AppAction =
  // `id`, if provided, is used instead of an auto-generated one. This lets
  // the caller (App.tsx) pre-generate an id so the same value can be sent
  // to the database and stored in local state — keeping the two in sync.
  | { type: "ADD_TX";        payload: Omit<Transaction, "id">; id?: string }
  | { type: "DEL_TX";        id: string }
  | { type: "SET_DATE";      date: string }
  | { type: "SET_FLOAT";     date: string; amount: number }
  | { type: "ADD_FLOAT_TOPUP"; date: string; amount: number; note: string; id?: string }
  | { type: "HYDRATE";       state: AppState };
