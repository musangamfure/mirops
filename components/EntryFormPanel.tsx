"use client";

import { useState, type Dispatch } from "react";
import {
  DEPARTMENTS, SITES, EXPENSE_CATS, MEAL_SESSIONS,
} from "@/lib/constants";
import type { ExpenseCat } from "@/lib/constants";
import type { AppAction, EntryForm } from "@/lib/types";

const EMPTY_FORM: EntryForm = {
  kind: "revenue", dept: "tubes", site: "mageragere",
  category: "", mealSite: "mageragere", mealSession: "Lunch",
  amount: "", note: "",
};

const labelSt: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#9ab89a",
  textTransform: "uppercase", letterSpacing: 0.9,
  marginBottom: 6, display: "block",
};

export function EntryFormPanel({
  dispatch, activeDate, onSaved,
}: {
  dispatch: Dispatch<AppAction>;
  activeDate: string;
  onSaved: (msg: string) => void;
}) {
  const [form, setForm] = useState<EntryForm>(EMPTY_FORM);
  const [error, setError] = useState("");

  function setF<K extends keyof EntryForm>(key: K, val: EntryForm[K]) {
    setForm((f) => ({ ...f, [key]: val }));
    setError("");
  }

  const isMeal = form.kind === "expense" && form.category === "Meals (Staff)";
  const isOther = form.kind === "expense" && form.category === "Other";
  const isExpense = form.kind === "expense";

  function submit() {
    const amt = Number(form.amount);
    if (!form.amount || isNaN(amt) || amt <= 0) {
      setError("Enter a valid amount greater than 0"); return;
    }
    if (isExpense && !form.category) {
      setError("Select an expense category"); return;
    }
    if (isOther && !form.note.trim()) {
      setError("Add a description for Other"); return;
    }

    const category: ExpenseCat | undefined = isExpense ? (form.category as ExpenseCat) : undefined;
    dispatch({
      type: "ADD_TX",
      payload: {
        kind: form.kind, date: activeDate, amount: amt,
        note: form.note.trim(), dept: form.dept, site: form.site,
        category,
        mealSite: isMeal ? form.mealSite : undefined,
        mealSession: isMeal ? form.mealSession : undefined,
      },
    });
    setForm((f) => ({ ...f, amount: "", note: "", category: "" }));
    setError("");
    onSaved("Entry saved ✓");
  }

  const selStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    background: "#162214",
    border: "1px solid #2d4a2d",
    borderRadius: 8,
    color: "#c8e6c9",
    fontSize: 13,
    fontFamily: "Georgia, serif",
    cursor: "pointer",
    appearance: "none" as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236a9c6a' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
    paddingRight: 32,
  };

  // Find emoji for selected site/dept
  const selectedSite = SITES.find((s) => s.id === form.site);
  const selectedDept = DEPARTMENTS.find((d) => d.id === form.dept);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: "bold", color: "#c8e6c9", margin: 0 }}>Record Entry</h1>
        <p style={{ color: "#6a9c6a", marginTop: 4, fontSize: 13 }}>
          Logging for {activeDate}
        </p>
      </div>

      <div style={{
        background: "#111e0f", border: "1px solid #1e3320",
        borderRadius: 14, padding: "22px 22px",
      }}>
        {/* ROW: Site + Type */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
          {/* SITE */}
          <div>
            <label style={labelSt}>Site</label>
            <div style={{ position: "relative" }}>
              <select
                value={form.site}
                onChange={(e) => setF("site", e.target.value as EntryForm["site"])}
                style={selStyle}
              >
                {SITES.map((s) => (
                  <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* TYPE */}
          <div>
            <label style={labelSt}>Type</label>
            <div style={{ position: "relative" }}>
              <select
                value={form.kind}
                onChange={(e) => setF("kind", e.target.value as EntryForm["kind"])}
                style={{
                  ...selStyle,
                  color: form.kind === "revenue" ? "#4ade80" : "#f87171",
                  borderColor: form.kind === "revenue" ? "#2d6a4f" : "#7f1d1d",
                  background: form.kind === "revenue" ? "#0f1a0f" : "#1a0a0a",
                }}
              >
                <option value="revenue">💹 Revenue</option>
                <option value="expense">💸 Expense</option>
              </select>
            </div>
          </div>
        </div>

        {/* DEPARTMENT */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelSt}>Department</label>
          <div style={{ position: "relative" }}>
            <select
              value={form.dept}
              onChange={(e) => setF("dept", e.target.value as EntryForm["dept"])}
              style={{
                ...selStyle,
                borderColor: selectedDept?.color ?? "#2d4a2d",
                color: selectedDept?.color ?? "#c8e6c9",
              }}
            >
              {DEPARTMENTS.map((d) => (
                <option key={d.id} value={d.id}>{d.emoji} {d.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* EXPENSE CATEGORY */}
        {isExpense && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>Expense Category</label>
            <select
              value={form.category}
              onChange={(e) => setF("category", e.target.value as EntryForm["category"])}
              style={selStyle}
            >
              <option value="">Select category…</option>
              {EXPENSE_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {/* MEAL DETAILS */}
        {isMeal && (
          <div style={{
            background: "#160e00", border: "1px solid #78460a44",
            borderRadius: 12, padding: "16px", marginBottom: 16,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", marginBottom: 14,
              textTransform: "uppercase", letterSpacing: 0.8 }}>
              🍽 Meal Details
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ ...labelSt, color: "#b45309" }}>Meal Site</label>
                <select
                  value={form.mealSite}
                  onChange={(e) => setF("mealSite", e.target.value as EntryForm["mealSite"])}
                  style={{ ...selStyle, borderColor: "#78460a", background: "#1a0e00", color: "#f59e0b" }}
                >
                  {SITES.map((s) => (
                    <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ ...labelSt, color: "#b45309" }}>Session</label>
                <select
                  value={form.mealSession}
                  onChange={(e) => setF("mealSession", e.target.value as EntryForm["mealSession"])}
                  style={{ ...selStyle, borderColor: "#78460a", background: "#1a0e00", color: "#f59e0b" }}
                >
                  {MEAL_SESSIONS.map((sess) => (
                    <option key={sess} value={sess}>
                      {sess === "Breakfast" ? "🌅" : sess === "Lunch" ? "☀️" : "🌙"} {sess}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* OTHER description */}
        {isOther && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>Description <span style={{ color: "#c0392b" }}>*</span></label>
            <input
              type="text" placeholder="Describe this expense…"
              value={form.note} onChange={(e) => setF("note", e.target.value)}
              style={{ borderColor: !form.note.trim() ? "#f59e0b" : undefined }}
            />
            {!form.note.trim() && (
              <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 4 }}>Required for Other</div>
            )}
          </div>
        )}

        {/* AMOUNT */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelSt}>Amount (RWF)</label>
          <input
            type="number" min="0" placeholder="0"
            value={form.amount} onChange={(e) => setF("amount", e.target.value)}
            style={{
              fontSize: 22, fontWeight: 700,
              color: form.kind === "revenue" ? "#4ade80" : "#f87171",
            }}
          />
        </div>

        {/* NOTE (non-Other) */}
        {!isOther && (
          <div style={{ marginBottom: 20 }}>
            <label style={labelSt}>Note (optional)</label>
            <input
              type="text" placeholder="e.g. 50 tubes to Jean Paul…"
              value={form.note} onChange={(e) => setF("note", e.target.value)}
            />
          </div>
        )}

        {error && (
          <div style={{
            background: "#2a0a0a", color: "#f87171", borderRadius: 10,
            padding: "10px 14px", fontSize: 13, fontWeight: 600,
            marginBottom: 16, border: "1px solid #7f1d1d",
          }}>
            ⚠ {error}
          </div>
        )}

        <button type="button" onClick={submit} style={{
          width: "100%", background: "#4a7c59", color: "#fff",
          border: "none", borderRadius: 12, padding: "14px",
          fontWeight: "bold", fontSize: 16, cursor: "pointer",
          fontFamily: "Georgia, serif", transition: "opacity 0.2s",
          boxShadow: "0 4px 16px rgba(74,124,89,0.3)",
        }}>
          Save Entry
        </button>
      </div>
    </div>
  );
}
