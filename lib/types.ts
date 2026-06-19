import type { ProductId, SiteId, ExpenseCat, MealSession } from "./constants";

export type { ProductId, SiteId };


// ─── TRANSACTION ─────────────────────────────────────────────────────────────
export type TxKind = "revenue" | "expense" | "float_topup";

export interface Transaction {
  id: string;
  kind: TxKind;
  date: string;          // YYYY-MM-DD
  amount: number;
  note: string;
  // site applies to both revenue and expense entries
  site?: SiteId;
  // revenue fields
  product?: ProductId;
  // expense fields
  category?: ExpenseCat;
  // meals
  mealSession?: MealSession;
  // top-up (no product/category/site needed)
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
  product: ProductId;
  site: SiteId;
  category: ExpenseCat | "";
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
