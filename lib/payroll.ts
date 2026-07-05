// ─── TYPES ────────────────────────────────────────────────────────────────────
export interface Employee {
  id: string;
  name: string;
  monthlySalary: number;
  rssbNumber?: string;
  idNumber?: string;
  phone?: string;
  site?: string;
  active: boolean;
}

export interface PayrollEntry {
  id: string;
  month: string; // YYYY-MM
  employeeId: string;
  employeeName: string;
  monthlySalary: number;
  basisOfCalculation: string;
  wagePerDay: number;
  daysToBePaid: number;
  ideni: number;
  netSalary: number;
  paid: boolean;
  paidDate?: string; // YYYY-MM-DD
  rssbNumber?: string;
  idNumber?: string;
  phone?: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ─── DATE / MONTH HELPERS ─────────────────────────────────────────────────────
export function currentMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function daysInMonth(month: string): number {
  const [year, mo] = month.split("-").map(Number);
  return new Date(year, mo, 0).getDate();
}

/** "2026-07" -> "1-31 July 2026" (respects each month's actual day count). */
export function basisOfCalculationForMonth(month: string): string {
  const [year, mo] = month.split("-").map(Number);
  const lastDay = daysInMonth(month);
  return `1-${lastDay} ${MONTH_NAMES[mo - 1]} ${year}`;
}

export function formatMonthLabel(month: string): string {
  const [year, mo] = month.split("-").map(Number);
  return `${MONTH_NAMES[mo - 1]} ${year}`;
}

// ─── PAYROLL MATH ─────────────────────────────────────────────────────────────
/**
 * Daily wage: monthly salary spread over a fixed 30-day pay cycle, matching
 * the convention used in the original payroll workbook (every month divides
 * by 30, regardless of that calendar month's actual length). This rounded
 * figure is for display only — see computeNetSalary for why net pay isn't
 * derived from it directly.
 */
export function computeWagePerDay(monthlySalary: number): number {
  return Math.round(monthlySalary / 30);
}

/**
 * Net pay = (daily rate × days actually paid) − any deduction (Ideni).
 * Uses the *unrounded* monthlySalary/30 rate rather than the rounded
 * wagePerDay shown in the UI, so a full 30-day month always comes out to
 * exactly monthlySalary − ideni (e.g. 40,000 stays 40,000, not 39,990).
 * Rounding only happens once, on the final result.
 */
export function computeNetSalary(monthlySalary: number, daysToBePaid: number, ideni: number): number {
  return Math.round((monthlySalary / 30) * daysToBePaid) - (Number(ideni) || 0);
}
