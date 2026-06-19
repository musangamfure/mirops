"use client";

import { useState, useEffect } from "react";
import { PRODUCTS, SITES, DEFAULT_EMPLOYEES } from "@/lib/constants";
import { loadCategories, saveCategories } from "@/lib/categories";
import type { AppState } from "@/lib/types";
import { fmt, bySite } from "@/lib/store";

const EMPLOYEES_KEY = "miru_employees_v1";

function loadEmployees(): string[] {
  if (typeof window === "undefined") return [...DEFAULT_EMPLOYEES];
  try {
    const stored = localStorage.getItem(EMPLOYEES_KEY);
    if (stored) return JSON.parse(stored) as string[];
  } catch {}
  return [...DEFAULT_EMPLOYEES];
}

function saveEmployees(list: string[]) {
  try { localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(list)); } catch {}
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      background: color + "22", color, border: `1px solid ${color}44`,
      borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 600,
    }}>{children}</span>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "#111e0f", borderRadius: 14, padding: "18px 20px",
      border: "1px solid #1e3320", ...style,
    }}>{children}</div>
  );
}

// ── Generic Name Modal (used for both Employees and Categories) ─
function NameModal({
  title, label, placeholder, submitLabel, initial, onSave, onCancel,
}: {
  title: string;
  label: string;
  placeholder: string;
  submitLabel: string;
  initial?: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial ?? "");
  const [error, setError] = useState("");

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) { setError(`${label} is required`); return; }
    onSave(trimmed);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)",
      zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div style={{
        background: "#111e0f", border: "1px solid #2d4a2d",
        borderRadius: 16, maxWidth: 400, width: "100%",
        padding: 28, boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: "bold", color: "#c8e6c9" }}>
            {title}
          </div>
          <button onClick={onCancel} style={{
            width: 30, height: 30, borderRadius: "50%", border: "none",
            background: "#1e3320", color: "#c8e6c9", fontSize: 18, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{
            display: "block", fontSize: 11, color: "#9ab89a", marginBottom: 6,
            textTransform: "uppercase", letterSpacing: 0.8,
          }}>{label}</label>
          <input
            type="text"
            value={name}
            placeholder={placeholder}
            autoFocus
            onChange={(e) => { setName(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            style={{ borderColor: error ? "#c0392b" : undefined }}
          />
          {error && <div style={{ color: "#f87171", fontSize: 12, marginTop: 4 }}>⚠ {error}</div>}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: 12, borderRadius: 10,
            border: "1px solid #2d4a2d", background: "transparent",
            color: "#9ab89a", fontSize: 14, cursor: "pointer", fontFamily: "Georgia, serif",
          }}>Cancel</button>
          <button onClick={handleSave} style={{
            flex: 2, padding: 12, borderRadius: 10, border: "none",
            background: "#4a7c59", color: "white", fontSize: 14,
            fontWeight: "bold", cursor: "pointer", fontFamily: "Georgia, serif",
          }}>{initial ? "Save Changes" : submitLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm ─────────────────────────────────────────────
function DeleteConfirm({ title, name, onConfirm, onCancel }: {
  title: string; name: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)",
      zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div style={{
        background: "#111e0f", border: "1px solid #4a7c59",
        borderRadius: 14, padding: 28, maxWidth: 340, width: "100%",
        textAlign: "center", boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🗑</div>
        <div style={{ fontSize: 16, fontWeight: "bold", color: "#c8e6c9", marginBottom: 6 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: "#6a9c6a", marginBottom: 8 }}>{name}</div>
        <div style={{ fontSize: 12, color: "#4a7c59", marginBottom: 24 }}>This cannot be undone.</div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: 12, borderRadius: 10,
            border: "1px solid #2d4a2d", background: "transparent",
            color: "#c8e6c9", fontSize: 14, cursor: "pointer", fontFamily: "Georgia, serif",
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: 12, borderRadius: 10, border: "none",
            background: "#c0392b", color: "white", fontSize: 14,
            fontWeight: "bold", cursor: "pointer", fontFamily: "Georgia, serif",
          }}>Remove</button>
        </div>
      </div>
    </div>
  );
}

// ── Employee Three-Dots Menu ───────────────────────────────────
function MenuBtn({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
  };

  return (
    <div style={{ position: "relative", flexShrink: 0 }} onBlur={handleBlur}>
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
          transition: "background 0.15s", padding: 0,
        }}
      >
        ···
      </button>
      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 6px)",
          background: "#162214", border: "1px solid #2d4a2d",
          borderRadius: 10, overflow: "hidden", zIndex: 200,
          minWidth: 130, boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}>
          <button
            onClick={() => { setOpen(false); onEdit(); }}
            style={{
              width: "100%", padding: "10px 14px", border: "none",
              borderBottom: "1px solid #1e3320", background: "transparent",
              color: "#c8e6c9", fontSize: 13, fontFamily: "Georgia, serif",
              cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#1e3320")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >✏ Edit</button>
          <button
            onClick={() => { setOpen(false); onDelete(); }}
            style={{
              width: "100%", padding: "10px 14px", border: "none",
              background: "transparent", color: "#f87171", fontSize: 13,
              fontFamily: "Georgia, serif", cursor: "pointer",
              textAlign: "left", display: "flex", alignItems: "center", gap: 8,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#2a0a0a")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >🗑 Remove</button>
        </div>
      )}
    </div>
  );
}

export function StaffOps({ state, isMobile }: { state: AppState; isMobile: boolean }) {
  const allTx = state.transactions;
  const [employees, setEmployees] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [categories, setCategories] = useState<string[]>([]);
  const [catAddOpen, setCatAddOpen] = useState(false);
  const [catEditTarget, setCatEditTarget] = useState<string | null>(null);
  const [catDeleteTarget, setCatDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    setEmployees(loadEmployees());
    setCategories(loadCategories());
  }, []);

  function persistAndSet(list: string[]) {
    setEmployees(list);
    saveEmployees(list);
  }

  function handleAdd(name: string) {
    persistAndSet([...employees, name]);
    setAddOpen(false);
  }

  function handleEdit(oldName: string, newName: string) {
    persistAndSet(employees.map((e) => (e === oldName ? newName : e)));
    setEditTarget(null);
  }

  function handleDelete(name: string) {
    persistAndSet(employees.filter((e) => e !== name));
    setDeleteTarget(null);
  }

  function persistAndSetCats(list: string[]) {
    setCategories(list);
    saveCategories(list);
  }

  function handleCatAdd(name: string) {
    if (categories.includes(name)) { setCatAddOpen(false); return; }
    persistAndSetCats([...categories, name]);
    setCatAddOpen(false);
  }

  function handleCatEdit(oldName: string, newName: string) {
    persistAndSetCats(categories.map((c) => (c === oldName ? newName : c)));
    setCatEditTarget(null);
  }

  function handleCatDelete(name: string) {
    persistAndSetCats(categories.filter((c) => c !== name));
    setCatDeleteTarget(null);
  }

  return (
    <div>
      {addOpen && (
        <NameModal
          title="➕ Add Employee" label="Full Name" placeholder="e.g. Jean Paul"
          submitLabel="Add Employee"
          onSave={handleAdd} onCancel={() => setAddOpen(false)}
        />
      )}
      {editTarget && (
        <NameModal
          title="✏ Edit Employee" label="Full Name" placeholder="e.g. Jean Paul"
          submitLabel="Add Employee"
          initial={editTarget}
          onSave={(name) => handleEdit(editTarget, name)}
          onCancel={() => setEditTarget(null)}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          title="Remove Employee?"
          name={deleteTarget}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {catAddOpen && (
        <NameModal
          title="➕ Add Category" label="Category Name" placeholder="e.g. Insurance"
          submitLabel="Add Category"
          onSave={handleCatAdd} onCancel={() => setCatAddOpen(false)}
        />
      )}
      {catEditTarget && (
        <NameModal
          title="✏ Edit Category" label="Category Name" placeholder="e.g. Insurance"
          submitLabel="Add Category"
          initial={catEditTarget}
          onSave={(name) => handleCatEdit(catEditTarget, name)}
          onCancel={() => setCatEditTarget(null)}
        />
      )}
      {catDeleteTarget && (
        <DeleteConfirm
          title="Remove Category?"
          name={catDeleteTarget}
          onConfirm={() => handleCatDelete(catDeleteTarget)}
          onCancel={() => setCatDeleteTarget(null)}
        />
      )}

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: "bold", color: "#c8e6c9", margin: 0 }}>Staff & Ops</h1>
        <p style={{ color: "#6a9c6a", marginTop: 4, fontSize: 13 }}>Team overview and all-time P&L</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* TEAM */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#4ade80" }}>
              👥 Team — {employees.length} Employees
            </div>
            <button
              onClick={() => setAddOpen(true)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 12px", borderRadius: 8,
                border: "1px solid #2d4a2d", background: "#162214",
                color: "#4ade80", fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "Georgia, serif",
              }}
            >
              ➕ Add
            </button>
          </div>
          {employees.length === 0 && (
            <div style={{ color: "#3a5c3a", fontSize: 13, textAlign: "center", padding: "16px 0", fontStyle: "italic" }}>
              No employees yet. Add one above.
            </div>
          )}
          {employees.map((emp) => (
            <div key={emp} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 0", borderBottom: "1px solid #1e3320",
            }}>
              <div style={{
                width: 34, height: 34, background: "#1b4332",
                borderRadius: "50%", display: "flex", alignItems: "center",
                justifyContent: "center", fontWeight: 800, color: "#4ade80", fontSize: 13,
                flexShrink: 0,
              }}>
                {emp[0]}
              </div>
              <div style={{ flex: 1, fontSize: 13, color: "#c8e6c9", fontWeight: 600 }}>{emp}</div>
              <Badge color="#40916C">Active</Badge>
              {/* Three-dots menu */}
              <MenuBtn
                onEdit={() => setEditTarget(emp)}
                onDelete={() => setDeleteTarget(emp)}
              />
            </div>
          ))}
        </Card>

        {/* CATEGORIES */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#f87171" }}>
              🏷 Expense Categories — {categories.length}
            </div>
            <button
              onClick={() => setCatAddOpen(true)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 12px", borderRadius: 8,
                border: "1px solid #2d4a2d", background: "#162214",
                color: "#f87171", fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "Georgia, serif",
              }}
            >
              ➕ Add
            </button>
          </div>
          {categories.length === 0 && (
            <div style={{ color: "#3a5c3a", fontSize: 13, textAlign: "center", padding: "16px 0", fontStyle: "italic" }}>
              No categories yet. Add one above.
            </div>
          )}
          {categories.map((cat) => (
            <div key={cat} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 0", borderBottom: "1px solid #1e3320",
            }}>
              <div style={{
                width: 34, height: 34, background: "#3a0a0a",
                borderRadius: "50%", display: "flex", alignItems: "center",
                justifyContent: "center", fontWeight: 800, color: "#f87171", fontSize: 13,
                flexShrink: 0,
              }}>
                {cat[0]}
              </div>
              <div style={{ flex: 1, fontSize: 13, color: "#c8e6c9", fontWeight: 600 }}>{cat}</div>
              <MenuBtn
                onEdit={() => setCatEditTarget(cat)}
                onDelete={() => setCatDeleteTarget(cat)}
              />
            </div>
          ))}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* REVENUE BY PRODUCT */}
        <Card>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: "#c8e6c9" }}>
            📈 All-Time Revenue by Product
          </div>
          {(() => {
            const totalRevAll = Math.max(1, ...PRODUCTS.map((p) =>
              allTx.filter((t) => t.product === p.id && t.kind === "revenue").reduce((s, t) => s + t.amount, 0)
            ));
            return PRODUCTS.map((p) => {
              const pRev = allTx.filter((t) => t.product === p.id && t.kind === "revenue").reduce((s, t) => s + t.amount, 0);
              return (
                <div key={p.id} style={{ marginBottom: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#9ab89a" }}>
                      {p.emoji} {p.label}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: pRev > 0 ? "#4ade80" : "#3a5c3a" }}>
                      {fmt(pRev)}
                    </span>
                  </div>
                  <div style={{ height: 4, background: "#1e3320", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 2, background: p.color,
                      width: `${Math.min(100, (pRev / totalRevAll) * 100)}%`,
                    }} />
                  </div>
                </div>
              );
            });
          })()}
        </Card>

        {/* EXPENSES BY CATEGORY */}
        <Card>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: "#c8e6c9" }}>
            📉 All-Time Expenses by Category
          </div>
          {categories.length === 0 && (
            <div style={{ color: "#3a5c3a", fontSize: 13, textAlign: "center", padding: "16px 0", fontStyle: "italic" }}>
              No categories defined yet.
            </div>
          )}
          {(() => {
            const totalExpAll = Math.max(1, ...categories.map((c) =>
              allTx.filter((t) => t.category === c && t.kind === "expense").reduce((s, t) => s + t.amount, 0)
            ));
            return categories.map((c) => {
              const cExp = allTx.filter((t) => t.category === c && t.kind === "expense").reduce((s, t) => s + t.amount, 0);
              return (
                <div key={c} style={{ marginBottom: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#9ab89a" }}>{c}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: cExp > 0 ? "#f87171" : "#3a1515" }}>
                      {fmt(cExp)}
                    </span>
                  </div>
                  <div style={{ height: 4, background: "#1e3320", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 2, background: "#c0392b",
                      width: `${Math.min(100, (cExp / totalExpAll) * 100)}%`,
                    }} />
                  </div>
                </div>
              );
            });
          })()}
        </Card>
      </div>

      {/* Site summary */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: "#c8e6c9" }}>
          🏭 Site Overview (All-Time)
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {(() => {
            const siteIds = SITES.map((s) => s.id);
            const totals = bySite(allTx, siteIds);
            return SITES.map((s) => {
              const rev = totals[s.id]?.revenue ?? 0;
              const exp = totals[s.id]?.expense ?? 0;
              return (
                <div key={s.id} style={{
                  flex: 1, minWidth: 200, background: "#162214",
                  borderRadius: 12, padding: "14px 18px", border: "1px solid #1e3320",
                }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{s.emoji}</div>
                  <div style={{ fontWeight: 700, color: "#c8e6c9", marginBottom: 10 }}>{s.label}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: "#9ab89a" }}>Revenue</span>
                      <span style={{ color: "#4ade80", fontWeight: 700 }}>{fmt(rev)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: "#9ab89a" }}>Expenses</span>
                      <span style={{ color: "#f87171", fontWeight: 700 }}>{fmt(exp)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingTop: 6, borderTop: "1px solid #1e3320", marginTop: 4 }}>
                      <span style={{ color: "#c8e6c9", fontWeight: 700 }}>Net</span>
                      <span style={{ color: rev - exp >= 0 ? "#4ade80" : "#f87171", fontWeight: 800 }}>{fmt(rev - exp)}</span>
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </Card>
    </div>
  );
}
