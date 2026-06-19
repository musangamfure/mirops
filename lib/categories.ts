import { DEFAULT_EXPENSE_CATS } from "./constants";

const CATEGORIES_KEY = "miru_expense_categories_v1";

export function loadCategories(): string[] {
  if (typeof window === "undefined") return [...DEFAULT_EXPENSE_CATS];
  try {
    const stored = localStorage.getItem(CATEGORIES_KEY);
    if (stored) return JSON.parse(stored) as string[];
  } catch {
    // corrupt storage — fall back to defaults
  }
  return [...DEFAULT_EXPENSE_CATS];
}

export function saveCategories(list: string[]) {
  try {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(list));
  } catch {
    // ignore write failures (e.g. storage full / private mode)
  }
}
