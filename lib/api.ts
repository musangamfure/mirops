import type { AppState, Transaction } from "./types";

export type DataSource = "mongodb" | "localStorage";

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

/**
 * Loads transactions + floats from the database. If the request fails for
 * any reason (no MONGODB_URI configured, network error, offline, etc.) the
 * `localFallback` state (already hydrated from localStorage by the caller)
 * is returned instead and `source` is "localStorage".
 *
 * `activeDate` is a per-browser UI preference and is never stored in the
 * database — it always comes from the local fallback state.
 */
export async function apiGetState(localFallback: AppState): Promise<{
  state: AppState;
  source: DataSource;
}> {
  try {
    const [txData, floatData] = await Promise.all([
      fetch("/api/transactions").then((r) => parseJson<Transaction[]>(r)),
      fetch("/api/floats").then((r) => parseJson<Record<string, number>>(r)),
    ]);
    return {
      state: {
        transactions: txData,
        floats: floatData,
        activeDate: localFallback.activeDate,
      },
      source: "mongodb",
    };
  } catch (err) {
    console.warn(
      "Database unavailable, using localStorage:",
      err instanceof Error ? err.message : err
    );
    return { state: localFallback, source: "localStorage" };
  }
}

/**
 * Persists a transaction (revenue, expense, or float top-up) that has
 * already been added to local state. `tx.id` is sent as the Mongo _id so
 * the database record matches the locally-held transaction exactly.
 */
export async function apiAddTransaction(tx: Transaction): Promise<DataSource> {
  try {
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tx),
    });
    await parseJson<Transaction>(res);
    return "mongodb";
  } catch (err) {
    console.warn(
      "Database unavailable, transaction kept in localStorage only:",
      err instanceof Error ? err.message : err
    );
    return "localStorage";
  }
}

/** Deletes a transaction that has already been removed from local state. */
export async function apiDeleteTransaction(id: string): Promise<DataSource> {
  try {
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    await parseJson<{ id: string }>(res);
    return "mongodb";
  } catch (err) {
    console.warn(
      "Database unavailable, deletion kept in localStorage only:",
      err instanceof Error ? err.message : err
    );
    return "localStorage";
  }
}

/** Sets (upserts) the opening float override for a given date. */
export async function apiSetFloat(date: string, amount: number): Promise<DataSource> {
  try {
    const res = await fetch("/api/floats", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, amount }),
    });
    await parseJson<{ date: string; amount: number }>(res);
    return "mongodb";
  } catch (err) {
    console.warn(
      "Database unavailable, float kept in localStorage only:",
      err instanceof Error ? err.message : err
    );
    return "localStorage";
  }
}
