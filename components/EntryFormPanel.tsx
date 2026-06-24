"use client";

import { useState, useEffect } from "react";
import type { Dispatch } from "react";
import {
  PRODUCTS, SITES, SITE_OPTIONS, MEAL_SESSIONS, MEAL_SESSION_OPTIONS,
  BOTH_SITES_ID, ALL_SESSIONS_ID,
} from "@/lib/constants";
import { loadCategories, saveCategories } from "@/lib/categories";
import type { AppAction, EntryForm, Transaction } from "@/lib/types";

const EMPTY_FORM: EntryForm = {
  kind: "revenue", product: "tubes", site: "mageragere",
  category: "", mealSession: "Lunch",
  amount: "", note: "",
};

const labelSt: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#9ab89a",
  textTransform: "uppercase", letterSpacing: 0.9,
  marginBottom: 6, display: "block",
};

export function EntryFormPanel({
  dispatch, activeDate, onSaved, existingTx,
}: {
  dispatch: Dispatch<AppAction>;
  activeDate: string;
  onSaved: (msg: string) => void;
  existingTx: Transaction[];
}) {
  const [form, setForm] = useState<EntryForm>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [addingCat, setAddingCat] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingDuplicate, setPendingDuplicate] = useState<Transaction | null>(null);

  useEffect(() => {
    setCategories(loadCategories());
  }, []);

  function setF<K extends keyof EntryForm>(key: K, val: EntryForm[K]) {
    setForm((f) => ({ ...f, [key]: val }));
    setError("");
  }

  const isMeal = form.kind === "expense" && form.category === "Meals (Staff)";
  const isOther = form.kind === "expense" && form.category === "Other";
  const isExpense = form.kind === "expense";

  function handleAddCategory() {
    const trimmed = newCat.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) {
      setF("category", trimmed);
      setAddingCat(false);
      setNewCat("");
      return;
    }
    const updated = [...categories, trimmed];
    setCategories(updated);
    saveCategories(updated);
    setF("category", trimmed);
    setAddingCat(false);
    setNewCat("");
  }

  /**
   * Looks for a same-day transaction that matches this one closely enough
   * to likely be an accidental re-entry: same kind, amount, site, and
   * product/category, and either the same note or both blank. This is a
   * judgment call, not a hard rule — legitimate repeats (e.g. two identical
   * transport fees) do happen, so this only prompts for confirmation, it
   * never blocks the save outright.
   */
  function findLikelyDuplicate(candidate: Transaction): Transaction | undefined {
    return existingTx.find((t) => {
      if (t.date !== activeDate) return false;
      if (t.kind !== candidate.kind) return false;
      if (t.amount !== candidate.amount) return false;
      if (t.site !== candidate.site) return false;
      if (candidate.kind === "revenue" && t.product !== candidate.product) return false;
      if (candidate.kind === "expense" && t.category !== candidate.category) return false;
      const sameNote = (t.note || "").trim() === (candidate.note || "").trim();
      return sameNote;
    });
  }

  function buildPayload() {
    const amt = Number(form.amount);
    return {
      kind: form.kind, date: activeDate, amount: amt,
      note: form.note.trim(),
      site: form.site,
      product: form.kind === "revenue" ? form.product : undefined,
      category: isExpense ? form.category : undefined,
      mealSession: isMeal ? form.mealSession : undefined,
    };
  }

  function submit() {
    if (submitting) return; // guards against double-tap / double-click firing two saves
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

    const payload = buildPayload();
    const duplicate = findLikelyDuplicate(payload as Transaction);
    if (duplicate) {
      setPendingDuplicate(duplicate);
      return; // wait for explicit confirmation before saving
    }

    doSave(payload);
  }

  function doSave(payload: ReturnType<typeof buildPayload>) {
    setSubmitting(true);
    dispatch({ type: "ADD_TX", payload });
    setForm((f) => ({ ...f, amount: "", note: "", category: "" }));
    setError("");
    setPendingDuplicate(null);
    onSaved("Entry saved ✓");
    // Release the lock shortly after — long enough to block an accidental
    // double-tap, short enough to never get in the way of the next entry.
    setTimeout(() => setSubmitting(false), 600);
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

  const selectedProduct = PRODUCTS.find((p) => p.id === form.product);

  return (
    <div>
      {pendingDuplicate && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)",
          zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        }}
          onClick={(e) => e.target === e.currentTarget && setPendingDuplicate(null)}
        >
          <div style={{
            background: "#111e0f", border: "1px solid #78460a",
            borderRadius: 16, maxWidth: 420, width: "100%",
            padding: 28, boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: "bold", color: "#c8e6c9", marginBottom: 8 }}>
              Possible Duplicate Entry
            </div>
            <div style={{ fontSize: 13, color: "#9ab89a", marginBottom: 20, lineHeight: 1.5 }}>
              An entry with the same amount, {pendingDuplicate.kind === "revenue" ? "product" : "category"}, and site
              already exists for {activeDate}
              {pendingDuplicate.note ? ` — note: "${pendingDuplicate.note}"` : ""}.
              Are you sure you want to save this one too?
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setPendingDuplicate(null)}
                style={{
                  flex: 1, padding: 12, borderRadius: 10,
                  border: "1px solid #2d4a2d", background: "transparent",
                  color: "#9ab89a", fontSize: 14, cursor: "pointer", fontFamily: "Georgia, serif",
                }}
              >Cancel</button>
              <button
                onClick={() => doSave(buildPayload())}
                style={{
                  flex: 1, padding: 12, borderRadius: 10, border: "none",
                  background: "#b45309", color: "white", fontSize: 14,
                  fontWeight: "bold", cursor: "pointer", fontFamily: "Georgia, serif",
                }}
              >Save Anyway</button>
            </div>
          </div>
        </div>
      )}

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
        {/* TYPE */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelSt}>Type</label>
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

        {/* REVENUE: Product + Site */}
        {!isExpense && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
            <div>
              <label style={labelSt}>Product</label>
              <select
                value={form.product}
                onChange={(e) => setF("product", e.target.value as EntryForm["product"])}
                style={{
                  ...selStyle,
                  borderColor: selectedProduct?.color ?? "#2d4a2d",
                  color: selectedProduct?.color ?? "#c8e6c9",
                }}
              >
                {PRODUCTS.map((p) => (
                  <option key={p.id} value={p.id}>{p.emoji} {p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelSt}>Site</label>
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
        )}

        {/* EXPENSE: Category + Site */}
        {isExpense && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
            <div>
              <label style={labelSt}>Expense Category</label>
              {!addingCat ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <select
                    value={form.category}
                    onChange={(e) => {
                      const newCat = e.target.value as EntryForm["category"];
                      setF("category", newCat);
                      // "Both Sites" only makes sense for Meals (Staff) bulk
                      // buys — fall back to a real site for any other category.
                      if (newCat !== "Meals (Staff)" && form.site === BOTH_SITES_ID) {
                        setF("site", "mageragere");
                      }
                    }}
                    style={{ ...selStyle, flex: 1 }}
                  >
                    <option value="">Select category…</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => setAddingCat(true)}
                    title="Add new category"
                    style={{
                      flexShrink: 0, width: 38,
                      border: "1px solid #2d4a2d", borderRadius: 8,
                      background: "#162214", color: "#4ade80",
                      fontSize: 16, fontWeight: 700, cursor: "pointer",
                    }}
                  >+</button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    autoFocus
                    placeholder="New category…"
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    style={{
                      flexShrink: 0, padding: "0 12px",
                      border: "none", borderRadius: 8,
                      background: "#4a7c59", color: "white",
                      fontSize: 13, fontWeight: 700, cursor: "pointer",
                      fontFamily: "Georgia, serif",
                    }}
                  >Add</button>
                  <button
                    type="button"
                    onClick={() => { setAddingCat(false); setNewCat(""); }}
                    style={{
                      flexShrink: 0, width: 34,
                      border: "1px solid #2d4a2d", borderRadius: 8,
                      background: "transparent", color: "#9ab89a",
                      fontSize: 14, cursor: "pointer",
                    }}
                  >×</button>
                </div>
              )}
            </div>
            <div>
              <label style={labelSt}>Site</label>
              <select
                value={form.site}
                onChange={(e) => {
                  const newSite = e.target.value as EntryForm["site"];
                  setF("site", newSite);
                  // Bulk buys ("Both Sites") default to covering every
                  // sitting; leaving "Both Sites" drops back to a real one.
                  if (newSite === BOTH_SITES_ID) {
                    setF("mealSession", ALL_SESSIONS_ID);
                  } else if (form.mealSession === ALL_SESSIONS_ID) {
                    setF("mealSession", "Lunch");
                  }
                }}
                style={selStyle}
              >
                {(isMeal ? SITE_OPTIONS : SITES).map((s) => (
                  <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>
                ))}
              </select>
              {isMeal && form.site === BOTH_SITES_ID && (
                <div style={{ fontSize: 11, color: "#b45309", marginTop: 5 }}>
                  Counts toward both sites&apos; meal totals — use for bulk monthly buys covering every session.
                </div>
              )}
            </div>
          </div>
        )}

        {/* MEAL SESSION (site already collected above) */}
        {isMeal && (
          <div style={{
            background: "#160e00", border: "1px solid #78460a44",
            borderRadius: 12, padding: "16px", marginBottom: 16,
          }}>
            <label style={{ ...labelSt, color: "#b45309" }}>🍽 Meal Session</label>
            <select
              value={form.mealSession}
              onChange={(e) => setF("mealSession", e.target.value as EntryForm["mealSession"])}
              style={{ ...selStyle, borderColor: "#78460a", background: "#1a0e00", color: "#f59e0b" }}
            >
              {(form.site === BOTH_SITES_ID ? MEAL_SESSION_OPTIONS : MEAL_SESSIONS).map((sess) => (
                <option key={sess} value={sess}>
                  {sess === "Breakfast" ? "🌅" : sess === "Lunch" ? "☀️" : sess === "Dinner" ? "🌙" : "📦"} {sess}
                </option>
              ))}
            </select>
            {form.site === BOTH_SITES_ID && form.mealSession === ALL_SESSIONS_ID && (
              <div style={{ fontSize: 11, color: "#b45309", marginTop: 5 }}>
                One bulk buy covering breakfast, lunch, and dinner for the whole month.
              </div>
            )}
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

        <button type="button" onClick={submit} disabled={submitting} style={{
          width: "100%", background: submitting ? "#3a5c3a" : "#4a7c59", color: "#fff",
          border: "none", borderRadius: 12, padding: "14px",
          fontWeight: "bold", fontSize: 16, cursor: submitting ? "default" : "pointer",
          fontFamily: "Georgia, serif", transition: "opacity 0.2s",
          boxShadow: "0 4px 16px rgba(74,124,89,0.3)",
          opacity: submitting ? 0.7 : 1,
        }}>
          {submitting ? "Saving…" : "Save Entry"}
        </button>
      </div>
    </div>
  );
}
