"use client";

import { useState, useMemo, useEffect, type Dispatch } from "react";
import { PRODUCTS, SITES } from "@/lib/constants";
import { loadCategories } from "@/lib/categories";
import type { AppState, AppAction, TxKind, ProductId, SiteId } from "@/lib/types";
import { fmt, sumKind } from "@/lib/store";
import { EntryRow } from "./Dashboard";

type KindFilter = "all" | TxKind;
type ProductFilter = "all" | ProductId;
type CategoryFilter = "all" | string;
type SiteFilter = "all" | SiteId;

const labelSt: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#9ab89a",
  textTransform: "uppercase", letterSpacing: 0.9,
  marginBottom: 5, display: "block",
};

const selectSt: React.CSSProperties = {
  border: "1.5px solid #1e3320", borderRadius: 10,
  padding: "8px 12px", fontSize: 13, outline: "none",
  background: "#111e0f", color: "#e8dcc8", width: "100%",
  fontFamily: "Georgia, serif",
};

const inputSt: React.CSSProperties = {
  border: "1.5px solid #1e3320", borderRadius: 10,
  padding: "8px 12px", fontSize: 13, outline: "none",
  background: "#111e0f", color: "#e8dcc8", width: "100%",
  fontFamily: "Georgia, serif",
};

// ── Date Group Header ──────────────────────────────────────────
function DateGroupHeader({
  date, count, revenue, expense, isMobile,
}: {
  date: string; count: number; revenue: number; expense: number; isMobile: boolean;
}) {
  // Format date nicely: "Tuesday, 17 June 2026"
  const formatted = (() => {
    try {
      const [y, m, d] = date.split("-").map(Number);
      return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      });
    } catch {
      return date;
    }
  })();

  const net = revenue - expense;

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      flexWrap: "wrap", gap: 8,
      padding: "10px 0 8px",
      borderBottom: "2px solid #1e3320",
      marginBottom: 4,
      marginTop: 4,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%", background: "#4a7c59", flexShrink: 0,
        }} />
        <span style={{ fontWeight: 700, fontSize: isMobile ? 13 : 14, color: "#c8e6c9" }}>
          {formatted}
        </span>
        <span style={{
          fontSize: 11, color: "#6a9c6a", background: "#1e3320",
          borderRadius: 20, padding: "2px 8px", fontWeight: 600,
        }}>
          {count} {count === 1 ? "entry" : "entries"}
        </span>
      </div>
      {!isMobile && (
        <div style={{ display: "flex", gap: 14, fontSize: 12 }}>
          {revenue > 0 && (
            <span style={{ color: "#4ade80", fontWeight: 700 }}>+{fmt(revenue)}</span>
          )}
          {expense > 0 && (
            <span style={{ color: "#f87171", fontWeight: 700 }}>−{fmt(expense)}</span>
          )}
          <span style={{
            fontWeight: 800, fontSize: 13,
            color: net >= 0 ? "#4ade80" : "#f87171",
          }}>
            Net {net >= 0 ? "+" : "−"}{fmt(Math.abs(net))}
          </span>
        </div>
      )}
    </div>
  );
}

export function Ledger({
  state, dispatch, isMobile, onFlash,
}: {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  isMobile: boolean;
  onFlash: (msg: string, type?: string) => void;
}) {
  const [filterProduct, setFilterProduct] = useState<ProductFilter>("all");
  const [filterCategory, setFilterCategory] = useState<CategoryFilter>("all");
  const [filterKind, setFilterKind] = useState<KindFilter>("all");
  const [filterSite, setFilterSite] = useState<SiteFilter>("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(!isMobile);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    setCategories(loadCategories());
  }, []);

  const filteredTx = useMemo(() => {
    return state.transactions.filter((t) => {
      if (t.kind === "float_topup") return false;
      if (filterProduct !== "all" && t.product !== filterProduct) return false;
      if (filterCategory !== "all" && t.category !== filterCategory) return false;
      if (filterKind !== "all" && t.kind !== filterKind) return false;
      if (filterSite !== "all") {
        const siteId = t.category === "Meals (Staff)" ? t.mealSite : t.site;
        if (siteId !== filterSite) return false;
      }
      if (filterDateFrom && t.date < filterDateFrom) return false;
      if (filterDateTo && t.date > filterDateTo) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const product = PRODUCTS.find((p) => p.id === t.product);
        const haystack = [product?.label, t.note, t.category, t.date].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [state.transactions, filterProduct, filterCategory, filterKind, filterSite, filterDateFrom, filterDateTo, search]);

  // Group by date, sorted most-recent first
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filteredTx>();
    for (const t of filteredTx) {
      if (!map.has(t.date)) map.set(t.date, []);
      map.get(t.date)!.push(t);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredTx]);

  const totalRev = sumKind(filteredTx, "revenue");
  const totalExp = sumKind(filteredTx, "expense");
  const net = totalRev - totalExp;

  const hasFilters =
    filterProduct !== "all" || filterCategory !== "all" || filterKind !== "all" || filterSite !== "all" ||
    filterDateFrom !== "" || filterDateTo !== "" || search.trim() !== "";

  const activeFilterCount = [
    filterProduct !== "all",
    filterCategory !== "all",
    filterKind !== "all",
    filterSite !== "all",
    filterDateFrom !== "",
    filterDateTo !== "",
    search.trim() !== "",
  ].filter(Boolean).length;

  const clearFilters = () => {
    setFilterProduct("all");
    setFilterCategory("all");
    setFilterKind("all");
    setFilterSite("all");
    setFilterDateFrom("");
    setFilterDateTo("");
    setSearch("");
  };

  return (
    <div>
      {/* Title */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 20 : 26, fontWeight: "bold", color: "#c8e6c9", margin: 0 }}>
            Ledger
          </h1>
          <p style={{ color: "#6a9c6a", marginTop: 4, fontSize: 13 }}>
            All transactions grouped by date
          </p>
        </div>
        {isMobile && (
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 10,
              border: `1px solid ${hasFilters ? "#4a7c59" : "#1e3320"}`,
              background: hasFilters ? "#162214" : "transparent",
              color: hasFilters ? "#4ade80" : "#9ab89a",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
              fontFamily: "Georgia, serif",
            }}
          >
            🔽 Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
        )}
      </div>

      {/* Filters panel */}
      {filtersOpen && (
        <div style={{
          background: "#111e0f", border: "1px solid #1e3320",
          borderRadius: 14, padding: "16px 20px", marginBottom: 16,
        }}>
          {/* Search row */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelSt}>Search</label>
            <input
              type="text"
              placeholder="Product, category, note…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputSt, paddingLeft: 14 }}
            />
          </div>

          {/* Date range row */}
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr",
            gap: 12, alignItems: "flex-end", marginBottom: 12,
          }}>
            <div>
              <label style={labelSt}>From date</label>
              <input
                type="date"
                value={filterDateFrom}
                max={filterDateTo || undefined}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                style={inputSt}
              />
            </div>
            <div>
              <label style={labelSt}>To date</label>
              <input
                type="date"
                value={filterDateTo}
                min={filterDateFrom || undefined}
                onChange={(e) => setFilterDateTo(e.target.value)}
                style={inputSt}
              />
            </div>
            <div>
              <label style={labelSt}>Type</label>
              <select value={filterKind} onChange={(e) => setFilterKind(e.target.value as KindFilter)} style={selectSt}>
                <option value="all">All Types</option>
                <option value="revenue">💹 Revenue</option>
                <option value="expense">💸 Expense</option>
              </select>
            </div>
          </div>

          {/* Product / Category / Site row */}
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr",
            gap: 12, alignItems: "flex-end",
          }}>
            <div>
              <label style={labelSt}>Product</label>
              <select value={filterProduct} onChange={(e) => setFilterProduct(e.target.value as ProductFilter)} style={selectSt}>
                <option value="all">All Products</option>
                {PRODUCTS.map((p) => (
                  <option key={p.id} value={p.id}>{p.emoji} {p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelSt}>Category</label>
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as CategoryFilter)} style={selectSt}>
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelSt}>Site</label>
              <select value={filterSite} onChange={(e) => setFilterSite(e.target.value as SiteFilter)} style={selectSt}>
                <option value="all">All Sites</option>
                {SITES.map((s) => (
                  <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Clear row */}
          <div style={{
            display: "flex", justifyContent: "flex-end", marginTop: 12,
          }}>
            {hasFilters && (
              <button
                onClick={clearFilters}
                style={{
                  padding: "8px 16px", borderRadius: 8,
                  border: "1px solid #2d4a2d", background: "transparent",
                  color: "#9ab89a", fontSize: 12, cursor: "pointer",
                  fontFamily: "Georgia, serif", whiteSpace: "nowrap",
                  alignSelf: "flex-end",
                }}
              >
                ✕ Clear all
              </button>
            )}
          </div>
        </div>
      )}

      {/* Summary strip */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
        gap: 12, marginBottom: 16,
      }}>
        {[
          { label: "Entries",  value: filteredTx.length,  icon: "📝", accent: "#4a7c59" },
          { label: "Revenue",  value: fmt(totalRev),       icon: "💹", accent: "#2d6a4f" },
          { label: "Expenses", value: fmt(totalExp),       icon: "💸", accent: "#7f1d1d" },
          { label: "Net",      value: fmt(net),            icon: "📊", accent: net >= 0 ? "#1b4332" : "#7f1d1d" },
        ].map((k) => (
          <div key={k.label} style={{
            background: "#111e0f", border: "1px solid #1e3320",
            borderRadius: 12, padding: "12px 16px",
            borderLeft: `3px solid ${k.accent}`,
          }}>
            <div style={{ fontSize: 16, marginBottom: 4 }}>{k.icon}</div>
            <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: "bold", color: "#c8e6c9" }}>{k.value}</div>
            <div style={{ fontSize: 10, color: "#6a9c6a", textTransform: "uppercase", letterSpacing: 0.8 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Grouped transaction list */}
      <div style={{
        background: "#111e0f", border: "1px solid #1e3320",
        borderRadius: 14, padding: isMobile ? "14px 16px" : "18px 24px",
      }}>
        {grouped.length === 0 ? (
          <div style={{ textAlign: "center", color: "#3a5c3a", padding: "48px 0", fontSize: 14 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
            <div>{hasFilters ? "No entries match your filters." : "No transactions yet."}</div>
          </div>
        ) : (
          grouped.map(([date, txs], i) => {
            const groupRev = sumKind(txs, "revenue");
            const groupExp = sumKind(txs, "expense");
            return (
              <div
                key={date}
                style={{ marginBottom: i < grouped.length - 1 ? 24 : 0 }}
              >
                <DateGroupHeader
                  date={date}
                  count={txs.length}
                  revenue={groupRev}
                  expense={groupExp}
                  isMobile={isMobile}
                />
                {txs.map((t) => (
                  <EntryRow
                    key={t.id} t={t} dispatch={dispatch}
                    onFlash={onFlash} isMobile={isMobile} showDate={false}
                  />
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
