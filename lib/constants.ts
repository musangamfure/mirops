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

// ─── RAW MATERIALS (mushroom tube production inventory) ────────────────────
// Per-tube consumption ratios for the four formula-linked materials are
// derived from the 1-ton base bulk recipe (per the production formula):
//   Cottonseed Hulls: 1,000 kg  →  0.1600 kg / tube
//   Rice Bran:          250 kg  →  0.0400 kg / tube
//   Rice Husks:         250 kg  →  0.0400 kg / tube
//   Lime (CaCO3):         50 kg  →  0.0080 kg / tube
// (Batch yields 6,250 kg wet substrate = 6,250 x 1kg tubes.)
// Corn cobs, spawn, alcohol, and hygiene cotton are not part of the fixed
// substrate formula, so they have no `kgPerTube` ratio — their stock is
// managed via manual Stock In / Stock Out movements only.
export const RAW_MATERIALS = [
  { id: "cotton_hulls", label: "Cottonseed Hulls", emoji: "🌾", unit: "kg", kgPerTube: 0.16 },
  { id: "rice_bran",    label: "Rice Bran",         emoji: "🌿", unit: "kg", kgPerTube: 0.04 },
  { id: "rice_husks",   label: "Rice Husks",        emoji: "🌱", unit: "kg", kgPerTube: 0.04 },
  { id: "lime",         label: "Lime",              emoji: "🧪", unit: "kg", kgPerTube: 0.008 },
  { id: "corn_cobs",    label: "Corn Cobs",         emoji: "🌽", unit: "kg", kgPerTube: null },
  { id: "spawn",        label: "Mushroom Spawn",    emoji: "🍄", unit: "kg", kgPerTube: null },
  { id: "alcohol",      label: "Alcohol",           emoji: "🧴", unit: "L",  kgPerTube: null },
  { id: "hygiene_cotton", label: "Hygiene Cotton",  emoji: "🩹", unit: "kg", kgPerTube: null },
] as const;

export type RawMaterialId = (typeof RAW_MATERIALS)[number]["id"];

// NOTE: the employee roster used to live here as a hardcoded list managed
// via localStorage. It's now a real Employee collection in the database
// (see lib/models/Employee.ts, app/api/employees) so the team is shared
// across devices instead of per-browser.

// ─── LOW-FLOAT THRESHOLD ────────────────────────────────────────────────────
export const LOW_FLOAT_THRESHOLD = 10_000; // RWF
