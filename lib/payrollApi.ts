import type { Employee, PayrollEntry } from "./payroll";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function parseJson<T>(res: Response): Promise<T> {
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.success) throw new Error(json.error || `Request failed (${res.status})`);
  return json.data as T;
}

// ── EMPLOYEES ──────────────────────────────────────────────────
export async function apiGetEmployees(): Promise<Employee[]> {
  const res = await fetch("/api/employees");
  return parseJson<Employee[]>(res);
}

export async function apiCreateEmployee(emp: {
  name: string;
  monthlySalary: number;
  rssbNumber?: string;
  idNumber?: string;
  phone?: string;
  site?: string;
}): Promise<Employee> {
  const res = await fetch("/api/employees", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(emp),
  });
  return parseJson<Employee>(res);
}

export async function apiUpdateEmployee(
  id: string,
  patch: Partial<{
    name: string;
    monthlySalary: number;
    rssbNumber: string;
    idNumber: string;
    phone: string;
    site: string;
    active: boolean;
  }>
): Promise<Employee> {
  const res = await fetch(`/api/employees/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return parseJson<Employee>(res);
}

export async function apiDeleteEmployee(id: string): Promise<{ id: string }> {
  const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
  return parseJson<{ id: string }>(res);
}

// ── PAYROLL ────────────────────────────────────────────────────
/**
 * Fetches (and, if needed, auto-generates) the payroll run for `month`
 * (YYYY-MM). Generation only fills in entries for employees who don't
 * already have one that month — it never touches existing entries, so
 * edits and paid status are always preserved.
 */
export async function apiGetPayroll(month: string): Promise<PayrollEntry[]> {
  const res = await fetch(`/api/payroll?month=${encodeURIComponent(month)}`);
  return parseJson<PayrollEntry[]>(res);
}

export async function apiUpdatePayrollEntry(
  id: string,
  patch: Partial<{
    daysToBePaid: number;
    ideni: number;
    netSalary: number;
    paid: boolean;
    paidDate: string;
    basisOfCalculation: string;
  }>
): Promise<PayrollEntry> {
  const res = await fetch(`/api/payroll/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return parseJson<PayrollEntry>(res);
}

export async function apiDeletePayrollEntry(id: string): Promise<{ id: string }> {
  const res = await fetch(`/api/payroll/${id}`, { method: "DELETE" });
  return parseJson<{ id: string }>(res);
}
