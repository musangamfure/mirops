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

export type SiteId = (typeof SITES)[number]["id"];

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
export type MealSession = (typeof MEAL_SESSIONS)[number];

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
