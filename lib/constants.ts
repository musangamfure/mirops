// ─── PRODUCTS (revenue lines) ────────────────────────────────────────────────
export const PRODUCTS = [
  { id: "tubes",   label: "Tubes",             emoji: "🧫", color: "#2D6A4F" },
  { id: "trainings", label: "Trainings",       emoji: "🎓", color: "#1B4332" },
  { id: "fresh",   label: "Fresh Mushrooms",    emoji: "🍄", color: "#52B788" },
  { id: "cotton",  label: "Cottonseed Hulls",   emoji: "🌾", color: "#74C69D" },
  { id: "kitchen", label: "Miru Kitchen",       emoji: "🍳", color: "#95D5B2" },
] as const;

export type ProductId = (typeof PRODUCTS)[number]["id"];

// ─── SITES ──────────────────────────────────────────────────────────────────
export const SITES = [
  { id: "mageragere", label: "Mageragere", emoji: "🏭" },
  { id: "nyakabanda", label: "Nyakabanda",  emoji: "🏠" },
] as const;

export type RealSiteId = (typeof SITES)[number]["id"];

/**
 * "Both Sites" is a special, non-physical selection — used when a single
 * purchase covers both locations at once (e.g. buying a month's worth of
 * staff food in bulk, for every meal session, in one trip). It's kept out
 * of `SITES` so the per-site breakdown tables (which iterate `SITES`) keep
 * showing only the two real locations; aggregation helpers in `lib/store.ts`
 * fold any "both"-tagged transaction into each real site's totals instead.
 */
export const BOTH_SITES_ID = "both" as const;
export const BOTH_SITES_OPTION = { id: BOTH_SITES_ID, label: "Both Sites", emoji: "🏭🏠" } as const;

// Full picker list — real sites plus the "Both Sites" choice — for any
// dropdown/toggle that should let the user select it (currently: the
// Meals (Staff) expense category).
export const SITE_OPTIONS = [...SITES, BOTH_SITES_OPTION] as const;

export type SiteId = RealSiteId | typeof BOTH_SITES_ID;

// ─── EXPENSE CATEGORIES (user-editable, seeded with defaults) ──────────────
export const DEFAULT_EXPENSE_CATS = [
  "Meals (Staff)",
  "Transport",
  "Raw Materials",
  "Utilities",
  "Packaging",
  "Marketing",
  "Equipment",
  "Salaries",
  "Maintenance",
  "Other",
] as const;

// Mutable list — managed via localStorage (see lib/categories.ts)
export type ExpenseCat = string;

// ─── MEAL SESSIONS ──────────────────────────────────────────────────────────
export const MEAL_SESSIONS = ["Breakfast", "Lunch", "Dinner"] as const;
export type RealMealSession = (typeof MEAL_SESSIONS)[number];

/**
 * "All Sessions" pairs with "Both Sites" (see BOTH_SITES_ID above) for a
 * single bulk monthly food purchase that covers breakfast, lunch, and
 * dinner at once, rather than one sitting. Kept out of MEAL_SESSIONS so
 * any per-session breakdown that iterates that list stays limited to the
 * three real sittings; only the picker needs to offer it.
 */
export const ALL_SESSIONS_ID = "All Sessions" as const;
export const MEAL_SESSION_OPTIONS = [...MEAL_SESSIONS, ALL_SESSIONS_ID] as const;

export type MealSession = RealMealSession | typeof ALL_SESSIONS_ID;

// ─── EMPLOYEES ──────────────────────────────────────────────────────────────
export const DEFAULT_EMPLOYEES = [
  "Emmanuel",
  "Claudine",
  "Jean Pierre",
  "Anitha",
  "Kevin",
  "Solange",
] as const;

// Mutable list — managed via localStorage in StaffOps
export const EMPLOYEES: string[] = [...DEFAULT_EMPLOYEES];

// ─── LOW-FLOAT THRESHOLD ────────────────────────────────────────────────────
export const LOW_FLOAT_THRESHOLD = 10_000; // RWF
