"use client";

import { useState, type Dispatch } from "react";
import {
  DEPARTMENTS,
  SITES,
  EXPENSE_CATS,
  MEAL_SESSIONS,
} from "@/lib/constants";
import type { ExpenseCat } from "@/lib/constants";
import type { AppAction, EntryForm } from "@/lib/types";
import { Card, labelSt, inputSt } from "./ui";
import { SiteToggle } from "./SiteToggle";

const EMPTY_FORM: EntryForm = {
  kind: "revenue",
  dept: "tubes",
  site: "mageragere",
  category: "",
  mealSite: "mageragere",
  mealSession: "Lunch",
  amount: "",
  note: "",
};

export function EntryFormPanel({
  dispatch,
  activeDate,
  onSaved,
}: {
  dispatch: Dispatch<AppAction>;
  activeDate: string;
  onSaved: (msg: string) => void;
}) {
  const [form, setForm] = useState<EntryForm>(EMPTY_FORM);
  const [error, setError] = useState("");

  function setF<K extends keyof EntryForm>(key: K, val: EntryForm[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  const isMeal = form.kind === "expense" && form.category === "Meals (Staff)";
  const isOther = form.kind === "expense" && form.category === "Other";
  const isExpense = form.kind === "expense";

  function submit() {
    const amt = Number(form.amount);
    if (!form.amount || isNaN(amt) || amt <= 0) {
      setError("Enter a valid amount greater than 0");
      return;
    }
    if (isExpense && !form.category) {
      setError("Select an expense category");
      return;
    }
    if (isOther && !form.note.trim()) {
      setError('Add a description for "Other"');
      return;
    }

    // At this point we've validated: if isExpense, form.category is non-empty.
    const category: ExpenseCat | undefined = isExpense
      ? (form.category as ExpenseCat)
      : undefined;

    dispatch({
      type: "ADD_TX",
      payload: {
        kind: form.kind,
        date: activeDate,
        amount: amt,
        note: form.note.trim(),
        dept: form.dept,
        site: form.site,
        category,
        mealSite: isMeal ? form.mealSite : undefined,
        mealSession: isMeal ? form.mealSession : undefined,
      },
    });

    // Reset amount/note/category but keep kind/dept/site for fast repeat entry
    setForm((f) => ({ ...f, amount: "", note: "", category: "" }));
    setError("");
    onSaved("Saved ✓");
  }

  return (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      <Card>
        <h2 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 800, color: "#1B4332" }}>
          Record New Entry
        </h2>

        {/* SITE */}
        <div style={{ marginBottom: 18 }}>
          <label style={labelSt}>Site</label>
          <SiteToggle value={form.site} onChange={(v) => setF("site", v)} />
        </div>

        {/* TYPE */}
        <div style={{ marginBottom: 18 }}>
          <label style={labelSt}>Type</label>
          <div style={{ display: "flex", gap: 10 }}>
            {(["revenue", "expense"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setF("kind", k)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 10,
                  border: `2px solid ${
                    form.kind === k ? (k === "revenue" ? "#1B4332" : "#c0392b") : "#eee"
                  }`,
                  background:
                    form.kind === k
                      ? k === "revenue"
                        ? "#1B43321a"
                        : "#c0392b12"
                      : "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  color:
                    form.kind === k ? (k === "revenue" ? "#1B4332" : "#c0392b") : "#aaa",
                }}
              >
                {k === "revenue" ? "💰 Revenue" : "💸 Expense"}
              </button>
            ))}
          </div>
        </div>

        {/* DEPARTMENT */}
        <div style={{ marginBottom: 18 }}>
          <label style={labelSt}>Department</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {DEPARTMENTS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setF("dept", d.id)}
                style={{
                  padding: "10px 6px",
                  borderRadius: 10,
                  border: `2px solid ${form.dept === d.id ? d.color : "#eee"}`,
                  background: form.dept === d.id ? d.color + "18" : "#fff",
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: "pointer",
                  color: form.dept === d.id ? d.color : "#777",
                  textAlign: "center",
                  lineHeight: 1.4,
                }}
              >
                <div style={{ fontSize: 20 }}>{d.emoji}</div>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* EXPENSE CATEGORY */}
        {isExpense && (
          <div style={{ marginBottom: 18 }}>
            <label style={labelSt}>Expense Category</label>
            <select
              value={form.category}
              onChange={(e) => setF("category", e.target.value as EntryForm["category"])}
              style={inputSt}
            >
              <option value="">Select category…</option>
              {EXPENSE_CATS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* MEAL DETAILS */}
        {isMeal && (
          <div
            style={{
              background: "#fff7ed",
              border: "1px solid #f59e0b44",
              borderRadius: 12,
              padding: "14px 16px",
              marginBottom: 18,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#b45309",
                marginBottom: 12,
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              🍽 Meal Details
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ ...labelSt, color: "#92400e" }}>Site</label>
              <div style={{ display: "flex", gap: 8 }}>
                {SITES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setF("mealSite", s.id)}
                    style={{
                      flex: 1,
                      padding: "8px",
                      borderRadius: 8,
                      border: `2px solid ${form.mealSite === s.id ? "#f59e0b" : "#e5e7eb"}`,
                      background: form.mealSite === s.id ? "#fef3c7" : "#fff",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                      color: form.mealSite === s.id ? "#92400e" : "#888",
                    }}
                  >
                    {s.emoji} {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ ...labelSt, color: "#92400e" }}>Meal Session</label>
              <div style={{ display: "flex", gap: 8 }}>
                {MEAL_SESSIONS.map((sess) => (
                  <button
                    key={sess}
                    type="button"
                    onClick={() => setF("mealSession", sess)}
                    style={{
                      flex: 1,
                      padding: "8px",
                      borderRadius: 8,
                      border: `2px solid ${form.mealSession === sess ? "#f59e0b" : "#e5e7eb"}`,
                      background: form.mealSession === sess ? "#fef3c7" : "#fff",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: "pointer",
                      color: form.mealSession === sess ? "#92400e" : "#888",
                    }}
                  >
                    {sess === "Breakfast" ? "🌅" : sess === "Lunch" ? "☀️" : "🌙"} {sess}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* OTHER — required description */}
        {isOther && (
          <div style={{ marginBottom: 18 }}>
            <label style={labelSt}>
              Description <span style={{ color: "#c0392b" }}>*</span>
            </label>
            <input
              type="text"
              placeholder="Describe this expense…"
              value={form.note}
              onChange={(e) => setF("note", e.target.value)}
              style={{ ...inputSt, borderColor: !form.note.trim() ? "#f59e0b" : "#e5e5e5" }}
            />
            {!form.note.trim() && (
              <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 4 }}>
                Required for &quot;Other&quot;
              </div>
            )}
          </div>
        )}

        {/* AMOUNT */}
        <div style={{ marginBottom: 18 }}>
          <label style={labelSt}>Amount (RWF)</label>
          <input
            type="number"
            min="0"
            placeholder="0"
            value={form.amount}
            onChange={(e) => setF("amount", e.target.value)}
            style={{
              ...inputSt,
              fontSize: 22,
              fontWeight: 700,
              color: form.kind === "revenue" ? "#1B4332" : "#c0392b",
            }}
          />
        </div>

        {/* NOTE (non-Other) */}
        {!isOther && (
          <div style={{ marginBottom: 18 }}>
            <label style={labelSt}>Note (optional)</label>
            <input
              type="text"
              placeholder="e.g. 50 tubes to Jean Paul, client name…"
              value={form.note}
              onChange={(e) => setF("note", e.target.value)}
              style={inputSt}
            />
          </div>
        )}

        {error && (
          <div
            style={{
              background: "#fee8e8",
              color: "#c0392b",
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 14,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          style={{
            width: "100%",
            background: "#1B4332",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            padding: "14px",
            fontWeight: 800,
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          Save Entry
        </button>
      </Card>
    </div>
  );
}
