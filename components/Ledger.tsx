"use client";

import { useState, type Dispatch } from "react";
import { DEPARTMENTS, SITES } from "@/lib/constants";
import type { AppState, AppAction, TxKind, DeptId, SiteId } from "@/lib/types";
import { fmt, sumKind } from "@/lib/store";
import { Card, Badge, labelSt, inputSt } from "./ui";

type KindFilter = "all" | TxKind;
type DeptFilter = "all" | DeptId;
type SiteFilter = "all" | SiteId;

export function Ledger({
  state,
  dispatch,
}: {
  state: AppState;
  dispatch: Dispatch<AppAction>;
}) {
  const [filterDept, setFilterDept] = useState<DeptFilter>("all");
  const [filterKind, setFilterKind] = useState<KindFilter>("all");
  const [filterSite, setFilterSite] = useState<SiteFilter>("all");

  const filteredTx = state.transactions.filter((t) => {
    if (t.kind === "float_topup") return false; // top-ups shown only on dashboard
    if (filterDept !== "all" && t.dept !== filterDept) return false;
    if (filterKind !== "all" && t.kind !== filterKind) return false;
    if (filterSite !== "all") {
      const siteId = t.category === "Meals (Staff)" ? t.mealSite : t.site;
      if (siteId !== filterSite) return false;
    }
    return true;
  });

  const net = sumKind(filteredTx, "revenue") - sumKind(filteredTx, "expense");

  return (
    <div>
      {/* FILTERS */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label style={{ ...labelSt, display: "block" }}>Department</label>
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value as DeptFilter)}
              style={{ ...inputSt, padding: "7px 10px", width: "auto" }}
            >
              <option value="all">All Departments</option>
              {DEPARTMENTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.emoji} {d.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ ...labelSt, display: "block" }}>Type</label>
            <select
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value as KindFilter)}
              style={{ ...inputSt, padding: "7px 10px", width: "auto" }}
            >
              <option value="all">All</option>
              <option value="revenue">Revenue</option>
              <option value="expense">Expense</option>
            </select>
          </div>
          <div>
            <label style={{ ...labelSt, display: "block" }}>Site</label>
            <select
              value={filterSite}
              onChange={(e) => setFilterSite(e.target.value as SiteFilter)}
              style={{ ...inputSt, padding: "7px 10px", width: "auto" }}
            >
              <option value="all">All Sites</option>
              {SITES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.emoji} {s.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "#999" }}>{filteredTx.length} entries</div>
            <div style={{ fontWeight: 700, color: "#1B4332", fontSize: 15 }}>
              Net: {fmt(net)}
            </div>
          </div>
        </div>
      </Card>

      {/* LIST */}
      <Card>
        {filteredTx.length === 0 ? (
          <div style={{ textAlign: "center", color: "#bbb", padding: "40px 0", fontSize: 14 }}>
            No entries match your filter.
          </div>
        ) : (
          filteredTx.map((t) => {
            const dept = DEPARTMENTS.find((d) => d.id === t.dept);
            const siteId = t.category === "Meals (Staff)" ? t.mealSite : t.site;
            const site = SITES.find((s) => s.id === siteId);
            return (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 0",
                  borderBottom: "1px solid #f5f5f5",
                }}
              >
                <span style={{ fontSize: 18 }}>{dept?.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{dept?.label}</span>
                    {site && <Badge color="#64748b">{site.emoji} {site.label}</Badge>}
                    {t.mealSession && <Badge color="#b45309">{t.mealSession}</Badge>}
                    {t.category && t.category !== "Meals (Staff)" && (
                      <Badge color="#888">{t.category}</Badge>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>
                    {t.date}
                    {t.note ? ` · ${t.note}` : ""}
                  </div>
                </div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 15,
                    color: t.kind === "revenue" ? "#1B4332" : "#c0392b",
                  }}
                >
                  {t.kind === "revenue" ? "+" : "−"}
                  {fmt(t.amount)}
                </div>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "DEL_TX", id: t.id })}
                  style={{
                    border: "none",
                    background: "#fee8e8",
                    color: "#c0392b",
                    cursor: "pointer",
                    fontSize: 12,
                    borderRadius: 6,
                    padding: "3px 9px",
                    fontWeight: 700,
                  }}
                >
                  Del
                </button>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
