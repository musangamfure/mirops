"use client";

import { useState, type Dispatch } from "react";
import { PRODUCTS, SITES } from "@/lib/constants";
import { loadCategories } from "@/lib/categories";
import type { AppState, AppAction, Transaction } from "@/lib/types";
import {
  fmt, sumKind, byProduct, byCategory, mealsBySiteToday,
  getOpeningFloat, getClosingFloat, isLowFloat, isDeficit,
} from "@/lib/store";
import { FloatPanel } from "./FloatPanel";

// ── Delete Confirm Modal ───────────────────────────────────────
function DeleteModal({
  label, onConfirm, onCancel, isMobile,
}: {
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
  isMobile: boolean;
}) {
  const panelStyle = isMobile
    ? {
        width: "100%", background: "#111e0f",
        borderRadius: "20px 20px 0 0",
        padding: "24px 20px calc(24px + env(safe-area-inset-bottom,0px))",
      }
    : {
        background: "#111e0f", border: "1px solid #4a7c59",
        borderRadius: 14, padding: 32, maxWidth: 360, width: "90%",
        boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
        animation: "scaleIn 0.2s var(--ease-out)",
      };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)",
        zIndex: 9999, display: "flex",
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
      }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div style={{ ...panelStyle, textAlign: "center" }}>
        {isMobile && (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: "#4a7c59" }} />
          </div>
        )}
        <div style={{ fontSize: 32, marginBottom: 12 }}>🗑</div>
        <div style={{ fontSize: 17, fontWeight: "bold", color: "#c8e6c9", marginBottom: 6 }}>
          Delete Entry?
        </div>
        <div style={{ fontSize: 13, color: "#6a9c6a", marginBottom: 8 }}>{label}</div>
        <div style={{ fontSize: 12, color: "#4a7c59", marginBottom: 24 }}>This cannot be undone.</div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: 13, borderRadius: 10,
            border: "1px solid #2d4a2d", background: "transparent",
            color: "#c8e6c9", fontSize: 15, cursor: "pointer",
            fontFamily: "Georgia, serif",
          }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: 13, borderRadius: 10,
            border: "none", background: "#c0392b",
            color: "white", fontSize: 15, fontWeight: "bold",
            cursor: "pointer", fontFamily: "Georgia, serif",
          }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Modal ─────────────────────────────────────────────────
function EditModal({
  tx, onSave, onCancel, isMobile,
}: {
  tx: Transaction;
  onSave: (updated: Partial<Transaction>) => void;
  onCancel: () => void;
  isMobile: boolean;
}) {
  const [amount, setAmount] = useState(String(tx.amount));
  const [note, setNote] = useState(tx.note ?? "");
  const [error, setError] = useState("");

  const handleSave = () => {
    const n = Number(amount);
    if (!amount || isNaN(n) || n <= 0) {
      setError("Enter a valid amount greater than 0");
      return;
    }
    onSave({ amount: n, note: note.trim() });
  };

  const product = PRODUCTS.find((p) => p.id === tx.product);
  const site = SITES.find((s) => s.id === (tx.mealSite ?? tx.site));

  const panelStyle = isMobile
    ? {
        width: "100%", background: "#111e0f",
        borderRadius: "20px 20px 0 0",
        padding: "20px 20px calc(20px + env(safe-area-inset-bottom,0px))",
        maxHeight: "90vh", overflowY: "auto" as const,
      }
    : {
        background: "#111e0f", border: "1px solid #2d4a2d",
        borderRadius: 16, maxWidth: 460, width: "90%",
        boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
        animation: "scaleIn 0.2s var(--ease-out)",
      };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)",
        zIndex: 9999, display: "flex",
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center", padding: isMobile ? 0 : 24,
      }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div style={panelStyle}>
        {isMobile && (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: "#4a7c59" }} />
          </div>
        )}

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: "bold", color: "#c8e6c9" }}>✏ Edit Entry</div>
            <div style={{ fontSize: 12, color: "#6a9c6a", marginTop: 4 }}>
              {product ? `${product.emoji} ${product.label}` : tx.category}
              {site ? ` · ${site.emoji} ${site.label}` : ""}
            </div>
          </div>
          <button onClick={onCancel} style={{
            width: 30, height: 30, borderRadius: "50%", border: "none",
            background: "#1e3320", color: "#c8e6c9", fontSize: 18, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>

        {/* Kind badge */}
        <div style={{ marginBottom: 16 }}>
          <span style={{
            display: "inline-block", padding: "4px 12px", borderRadius: 20,
            fontSize: 12, fontWeight: "bold",
            background: tx.kind === "revenue" ? "#1b4332" : tx.kind === "float_topup" ? "#3b0764" : "#3a0a0a",
            color: tx.kind === "revenue" ? "#4ade80" : tx.kind === "float_topup" ? "#c4b5fd" : "#f87171",
            border: `1px solid ${tx.kind === "revenue" ? "#2d4a2d" : tx.kind === "float_topup" ? "#7c3aed" : "#7f1d1d"}`,
          }}>
            {tx.kind === "revenue" ? "Revenue" : tx.kind === "float_topup" ? "Float Top-up" : "Expense"}
          </span>
          {tx.category && (
            <span style={{
              marginLeft: 6, display: "inline-block", padding: "4px 12px",
              borderRadius: 20, fontSize: 12, background: "#1e3320", color: "#9ab89a",
              border: "1px solid #2d4a2d",
            }}>{tx.category}</span>
          )}
        </div>

        {/* Amount field */}
        <div style={{ marginBottom: 16 }}>
          <label style={{
            display: "block", fontSize: 11, color: "#9ab89a", marginBottom: 6,
            textTransform: "uppercase", letterSpacing: 0.8,
          }}>Amount (RWF)</label>
          <input
            type="number" value={amount} min="1"
            onChange={(e) => { setAmount(e.target.value); setError(""); }}
            style={{ borderColor: error ? "#c0392b" : undefined }}
          />
          {error && <div style={{ color: "#f87171", fontSize: 12, marginTop: 4 }}>⚠ {error}</div>}
        </div>

        {/* Note field */}
        <div style={{ marginBottom: 24 }}>
          <label style={{
            display: "block", fontSize: 11, color: "#9ab89a", marginBottom: 6,
            textTransform: "uppercase", letterSpacing: 0.8,
          }}>Note</label>
          <input
            type="text" value={note} placeholder="Optional description"
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: 13, borderRadius: 10,
            border: "1px solid #2d4a2d", background: "transparent",
            color: "#9ab89a", fontSize: 14, cursor: "pointer",
            fontFamily: "Georgia, serif",
          }}>Cancel</button>
          <button onClick={handleSave} style={{
            flex: 2, padding: 13, borderRadius: 10, border: "none",
            background: "#4a7c59", color: "white", fontSize: 14,
            fontWeight: "bold", cursor: "pointer", fontFamily: "Georgia, serif",
          }}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// ── Mini bar ───────────────────────────────────────────────────
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ height: 6, background: "#1e3320", borderRadius: 4, overflow: "hidden" }}>
      <div style={{
        width: pct + "%", height: "100%", background: color,
        borderRadius: 4, transition: "width 0.4s",
      }} />
    </div>
  );
}

// ── Group Button Row ───────────────────────────────────────────
function CrudGroupBtns({
  onEdit, onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
  compact?: boolean; // kept for call-site compat, unused
}) {
  const [open, setOpen] = useState(false);

  // Close when clicking outside
  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setOpen(false);
    }
  };

  return (
    <div
      style={{ position: "relative", flexShrink: 0 }}
      onBlur={handleBlur}
    >
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Actions"
        style={{
          width: 30, height: 30,
          border: "1px solid #2d4a2d", borderRadius: 8,
          background: open ? "#1e3320" : "#162214",
          color: "#9ab89a", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, fontWeight: 900, letterSpacing: 1,
          transition: "background 0.15s",
          padding: 0,
        }}
      >
        ···
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 6px)",
          background: "#162214", border: "1px solid #2d4a2d",
          borderRadius: 10, overflow: "hidden", zIndex: 200,
          minWidth: 130,
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}>
          <button
            onClick={() => { setOpen(false); onEdit(); }}
            style={{
              width: "100%", padding: "10px 14px",
              border: "none", borderBottom: "1px solid #1e3320",
              background: "transparent", color: "#c8e6c9",
              fontSize: 13, fontFamily: "Georgia, serif",
              cursor: "pointer", textAlign: "left",
              display: "flex", alignItems: "center", gap: 8,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#1e3320")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            ✏ Edit
          </button>
          <button
            onClick={() => { setOpen(false); onDelete(); }}
            style={{
              width: "100%", padding: "10px 14px",
              border: "none", background: "transparent",
              color: "#f87171", fontSize: 13,
              fontFamily: "Georgia, serif", cursor: "pointer",
              textAlign: "left", display: "flex", alignItems: "center", gap: 8,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#2a0a0a")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            🗑 Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ── Entry Row (reusable for both Dashboard and Ledger) ─────────
export function EntryRow({
  t, dispatch, onFlash, isMobile, showDate,
}: {
  t: Transaction;
  dispatch: Dispatch<AppAction>;
  onFlash: (msg: string, type?: string) => void;
  isMobile: boolean;
  showDate?: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);

  const product = PRODUCTS.find((p) => p.id === t.product);
  const siteId = t.category === "Meals (Staff)" ? t.mealSite : t.site;
  const site = SITES.find((s) => s.id === siteId);

  const amountColor = t.kind === "revenue" ? "#4ade80"
    : t.kind === "float_topup" ? "#c4b5fd" : "#f87171";
  const amountSign = t.kind === "revenue" ? "+" : t.kind === "float_topup" ? "+" : "−";

  const primaryLabel = t.kind === "revenue" ? product?.label : t.category;
  const primaryEmoji = t.kind === "revenue" ? product?.emoji : "💸";

  const label = `${primaryLabel ?? "Float Top-up"} · ${fmt(t.amount)}${t.note ? ` · ${t.note}` : ""}`;

  function handleEdit(updated: Partial<Transaction>) {
    // Delete old, add updated (preserves date/kind/product/category/site)
    dispatch({ type: "DEL_TX", id: t.id });
    dispatch({
      type: "ADD_TX",
      id: t.id,
      payload: {
        ...t,
        amount: updated.amount ?? t.amount,
        note: updated.note ?? t.note,
      },
    });
    setEditing(false);
    onFlash("Entry updated ✓");
  }

  function handleDelete() {
    dispatch({ type: "DEL_TX", id: t.id });
    setConfirmDelete(false);
    onFlash("Entry deleted.", "error");
  }

  return (
    <>
      {confirmDelete && (
        <DeleteModal
          label={label} isMobile={isMobile}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      {editing && (
        <EditModal
          tx={t} isMobile={isMobile}
          onSave={handleEdit}
          onCancel={() => setEditing(false)}
        />
      )}

      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "9px 0", borderBottom: "1px solid #1e3320",
      }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>
          {t.kind === "float_topup" ? "💜" : primaryEmoji}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: "#c8e6c9" }}>
              {t.kind === "float_topup" ? "Float Top-up" : primaryLabel}
            </span>
            {site && (
              <span style={{
                background: "#64748b22", color: "#64748b", border: "1px solid #64748b44",
                borderRadius: 6, padding: "1px 7px", fontSize: 11, fontWeight: 600,
              }}>{site.emoji} {site.label}</span>
            )}
            {t.mealSession && (
              <span style={{
                background: "#b4530922", color: "#b45309", border: "1px solid #b4530944",
                borderRadius: 6, padding: "1px 7px", fontSize: 11, fontWeight: 600,
              }}>{t.mealSession}</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "#6a9c6a", marginTop: 2 }}>
            {showDate && <span style={{ marginRight: 6 }}>{t.date} ·</span>}
            {t.note || <span style={{ color: "#3a5c3a", fontStyle: "italic" }}>No note</span>}
          </div>
        </div>

        <div style={{
          fontWeight: 800, fontSize: 14, color: amountColor,
          flexShrink: 0, minWidth: 90, textAlign: "right",
        }}>
          {amountSign}{fmt(t.amount)}
        </div>

        <CrudGroupBtns
          compact={isMobile}
          onEdit={() => setEditing(true)}
          onDelete={() => setConfirmDelete(true)}
        />
      </div>
    </>
  );
}

// ── TopupRow ───────────────────────────────────────────────────
function TopupRow({
  t, dispatch, onFlash, isMobile,
}: {
  t: Transaction;
  dispatch: Dispatch<AppAction>;
  onFlash: (msg: string, type?: string) => void;
  isMobile: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);

  function handleEdit(updated: Partial<Transaction>) {
    dispatch({ type: "DEL_TX", id: t.id });
    dispatch({
      type: "ADD_TX", id: t.id,
      payload: { ...t, amount: updated.amount ?? t.amount, note: updated.note ?? t.note },
    });
    setEditing(false);
    onFlash("Float top-up updated ✓");
  }

  function handleDelete() {
    dispatch({ type: "DEL_TX", id: t.id });
    setConfirmDelete(false);
    onFlash("Top-up deleted.", "error");
  }

  return (
    <>
      {confirmDelete && (
        <DeleteModal
          label={`Float Top-up · ${fmt(t.amount)}`} isMobile={isMobile}
          onConfirm={handleDelete} onCancel={() => setConfirmDelete(false)}
        />
      )}
      {editing && (
        <EditModal tx={t} isMobile={isMobile} onSave={handleEdit} onCancel={() => setEditing(false)} />
      )}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "9px 0", borderBottom: "1px solid #1e3320",
      }}>
        <span style={{ fontSize: 18 }}>💜</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: "#c4b5fd" }}>Float Top-up</div>
          <div style={{ fontSize: 11, color: "#6a9c6a" }}>{t.note}</div>
        </div>
        <div style={{ fontWeight: 800, fontSize: 14, color: "#c4b5fd" }}>+{fmt(t.amount)}</div>
        <CrudGroupBtns compact={isMobile}
          onEdit={() => setEditing(true)} onDelete={() => setConfirmDelete(true)} />
      </div>
    </>
  );
}

// ── KPI Card ───────────────────────────────────────────────────
function KpiCard({
  label, value, icon, accent, isMobile,
}: {
  label: string; value: string | number; icon: string; accent: string; isMobile: boolean;
}) {
  return (
    <div style={{
      background: "#111e0f", border: "1px solid #1e3320",
      borderRadius: 14, padding: isMobile ? "14px 16px" : "18px 22px",
      borderLeft: `4px solid ${accent}`,
    }}>
      <div style={{ fontSize: isMobile ? 20 : 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: "bold", color: "#c8e6c9" }}>{value}</div>
      <div style={{
        fontSize: 11, color: "#6a9c6a", marginTop: 4,
        textTransform: "uppercase", letterSpacing: 0.9,
      }}>{label}</div>
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────
export function Dashboard({
  state, dispatch, activeDate, isMobile, onFlash,
}: {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  activeDate: string;
  isMobile: boolean;
  onFlash: (msg: string, type?: string) => void;
}) {
  const dayTx = state.transactions.filter((t) => t.date === activeDate);
  const dayRev = sumKind(dayTx, "revenue");
  const dayExp = sumKind(dayTx, "expense");
  const net = dayRev - dayExp;

  const opening = getOpeningFloat(state, activeDate);
  const closing = getClosingFloat(state, activeDate);

  const categories = loadCategories();
  const productRevDay = byProduct(dayTx, "revenue");
  const catExpDay = byCategory(dayTx, "expense", categories);
  const maxProductRev = Math.max(1, ...Object.values(productRevDay));
  const maxCatExp = Math.max(1, ...Object.values(catExpDay));
  const activeCats = categories.filter((c) => catExpDay[c] > 0);
  const catsToShow = activeCats.length > 0 ? activeCats : categories.slice(0, 6);

  const meals = mealsBySiteToday(dayTx);
  const revenueEntries = dayTx.filter((t) => t.kind === "revenue").length;
  const expenseEntries = dayTx.filter((t) => t.kind === "expense").length;

  const recentTx = dayTx.filter((t) => t.kind !== "float_topup").slice(0, 12);
  const topupTx = dayTx.filter((t) => t.kind === "float_topup");

  const kpis = [
    { label: "Revenue",  value: fmt(dayRev), icon: "💹", accent: "#2d6a4f" },
    { label: "Expenses", value: fmt(dayExp), icon: "💸", accent: "#7f1d1d" },
    { label: "Net",      value: fmt(net),    icon: "📊", accent: net >= 0 ? "#1b4332" : "#7f1d1d" },
    { label: "Entries",  value: revenueEntries + expenseEntries, icon: "📝", accent: "#4a7c59" },
  ];

  return (
    <div>
      {/* Title row with inline date picker */}
      <div style={{
        marginBottom: 20,
        display: "flex",
        alignItems: isMobile ? "flex-start" : "center",
        justifyContent: "space-between",
        flexDirection: isMobile ? "column" : "row",
        gap: isMobile ? 12 : 0,
      }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 20 : 26, fontWeight: "bold", color: "#c8e6c9", margin: 0 }}>
            Daily Overview
          </h1>
          <p style={{ color: "#6a9c6a", marginTop: 4, fontSize: 13 }}>
            {activeDate}
          </p>
        </div>
        {!isMobile && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ fontSize: 12, color: "#6a9c6a", fontWeight: 600 }}>Date</label>
            <input
              type="date"
              value={activeDate}
              onChange={(e) => dispatch({ type: "SET_DATE", date: e.target.value })}
              style={{
                border: "1px solid #2d4a2d", borderRadius: 8,
                padding: "7px 12px", background: "#162214",
                color: "#c8e6c9", fontSize: 13, width: "auto",
              }}
            />
          </div>
        )}
      </div>
      {isMobile && (
        <div style={{ marginBottom: 16 }}>
          <input
            type="date"
            value={activeDate}
            onChange={(e) => dispatch({ type: "SET_DATE", date: e.target.value })}
            style={{
              border: "1px solid #2d4a2d", borderRadius: 8,
              padding: "8px 12px", background: "#162214",
              color: "#c8e6c9", fontSize: 13, width: "100%",
            }}
          />
        </div>
      )}

      {/* KPI grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
        gap: 12, marginBottom: 20,
      }}>
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} isMobile={isMobile} />
        ))}
      </div>

      {/* Float panel */}
      <div style={{ marginBottom: 20 }}>
        <FloatPanel state={state} dispatch={dispatch} activeDate={activeDate} />
      </div>

      {/* Dept charts — stacked on mobile, side by side on desktop */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        gap: 16, marginBottom: 20,
      }}>
        {/* Revenue by product */}
        <div style={{
          background: "#111e0f", border: "1px solid #1e3320",
          borderRadius: 14, padding: "18px 20px",
        }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: "#4ade80" }}>
            Revenue by Product
          </div>
          {PRODUCTS.map((p) => (
            <div key={p.id} style={{ marginBottom: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5, color: "#9ab89a" }}>
                  <span>{p.emoji}</span> {p.label}
                </span>
                <span style={{
                  fontWeight: 700, fontSize: 12,
                  color: productRevDay[p.id] > 0 ? p.color : "#2d4a2d",
                }}>
                  {fmt(productRevDay[p.id])}
                </span>
              </div>
              <MiniBar value={productRevDay[p.id]} max={maxProductRev} color={p.color} />
            </div>
          ))}
        </div>

        {/* Expenses by category */}
        <div style={{
          background: "#111e0f", border: "1px solid #1e3320",
          borderRadius: 14, padding: "18px 20px",
        }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: "#f87171" }}>
            Expenses by Category
          </div>
          {catsToShow.map((c) => (
            <div key={c} style={{ marginBottom: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: "#9ab89a" }}>{c}</span>
                <span style={{
                  fontWeight: 700, fontSize: 12,
                  color: catExpDay[c] > 0 ? "#f87171" : "#3a1515",
                }}>
                  {fmt(catExpDay[c])}
                </span>
              </div>
              <MiniBar value={catExpDay[c]} max={maxCatExp} color="#c0392b" />
            </div>
          ))}
        </div>
      </div>

      {/* Meals callout */}
      {(meals.mageragere > 0 || meals.nyakabanda > 0) && (
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          {SITES.map((s) => (
            <div key={s.id} style={{
              flex: 1, minWidth: 140,
              background: "#160e00", border: "1px solid #78460a44",
              borderRadius: 12, padding: "12px 16px",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 22 }}>{s.emoji}</span>
              <div>
                <div style={{ fontSize: 11, color: "#b45309", fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: 0.8 }}>
                  {s.label} — Meals
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#f59e0b" }}>
                  {fmt(meals[s.id] ?? 0)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent Entries with CRUD */}
      <div style={{
        background: "#111e0f", border: "1px solid #1e3320",
        borderRadius: 14, padding: isMobile ? "16px" : "20px 24px",
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 16, flexWrap: "wrap", gap: 8,
        }}>
          <h2 style={{ fontSize: 14, fontWeight: "bold", color: "#c8e6c9", margin: 0 }}>
            Recent Entries — {activeDate}
          </h2>
          <div style={{ fontSize: 12, color: "#6a9c6a" }}>
            {recentTx.length + topupTx.length} records
          </div>
        </div>

        {recentTx.length === 0 && topupTx.length === 0 ? (
          <div style={{ color: "#3a5c3a", fontSize: 14, textAlign: "center", padding: "32px 0" }}>
            No entries yet. Use &ldquo;Record Entry&rdquo; to add one.
          </div>
        ) : (
          <>
            {recentTx.map((t) => (
              <EntryRow
                key={t.id} t={t} dispatch={dispatch}
                onFlash={onFlash} isMobile={isMobile}
              />
            ))}
            {topupTx.map((t) => (
              <TopupRow
                key={t.id} t={t} dispatch={dispatch}
                onFlash={onFlash} isMobile={isMobile}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
