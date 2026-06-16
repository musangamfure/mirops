"use client";

import type { Dispatch } from "react";
import { DEPARTMENTS, SITES } from "@/lib/constants";
import type { AppState, AppAction, Transaction } from "@/lib/types";
import { fmt, sumKind, byDept, mealsBySiteToday } from "@/lib/store";
import { Card, Badge, MiniBar } from "./ui";
import { FloatPanel } from "./FloatPanel";

export function Dashboard({
  state,
  dispatch,
  activeDate,
}: {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  activeDate: string;
}) {
  const dayTx = state.transactions.filter((t) => t.date === activeDate);

  const dayRev = sumKind(dayTx, "revenue");
  const dayExp = sumKind(dayTx, "expense");

  const deptRevDay = byDept(dayTx, "revenue");
  const deptExpDay = byDept(dayTx, "expense");
  const maxDeptRev = Math.max(1, ...Object.values(deptRevDay));
  const maxDeptExp = Math.max(1, ...Object.values(deptExpDay));

  const meals = mealsBySiteToday(dayTx);

  const revenueEntries = dayTx.filter((t) => t.kind === "revenue").length;
  const expenseEntries = dayTx.filter((t) => t.kind === "expense").length;

  const recentTx = dayTx.filter((t) => t.kind !== "float_topup").slice(0, 12);
  const topupTx = dayTx.filter((t) => t.kind === "float_topup");

  return (
    <div>
      <div style={{ marginBottom: 12, color: "#666", fontWeight: 600, fontSize: 14 }}>
        Daily Summary — {activeDate}
      </div>

      {/* FLOAT PANEL */}
      <FloatPanel state={state} dispatch={dispatch} activeDate={activeDate} />

      {/* REVENUE / EXPENSE TOTALS */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div
          style={{
            flex: 1,
            minWidth: 140,
            background: "#fff",
            borderRadius: 14,
            padding: "18px 20px",
            boxShadow: "0 1px 4px #0000000d",
            border: "1px solid #eee",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "#888",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Revenue
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#1B4332", marginTop: 4 }}>
            {fmt(dayRev)}
          </div>
          <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>
            {revenueEntries} entries
          </div>
        </div>
        <div
          style={{
            flex: 1,
            minWidth: 140,
            background: "#fff",
            borderRadius: 14,
            padding: "18px 20px",
            boxShadow: "0 1px 4px #0000000d",
            border: "1px solid #eee",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "#888",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Expenses
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#c0392b", marginTop: 4 }}>
            {fmt(dayExp)}
          </div>
          <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>
            {expenseEntries} entries
          </div>
        </div>
      </div>

      {/* DEPARTMENT CHARTS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <Card>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: "#1B4332" }}>
            Revenue by Department — Today
          </div>
          {DEPARTMENTS.map((d) => (
            <div key={d.id} style={{ marginBottom: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                  <span>{d.emoji}</span> {d.label}
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 12,
                    color: deptRevDay[d.id] > 0 ? d.color : "#ccc",
                  }}
                >
                  {fmt(deptRevDay[d.id])}
                </span>
              </div>
              <MiniBar value={deptRevDay[d.id]} max={maxDeptRev} color={d.color} />
            </div>
          ))}
        </Card>

        <Card>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: "#c0392b" }}>
            Expenses by Department — Today
          </div>
          {DEPARTMENTS.map((d) => (
            <div key={d.id} style={{ marginBottom: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                  <span>{d.emoji}</span> {d.label}
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 12,
                    color: deptExpDay[d.id] > 0 ? "#c0392b" : "#ccc",
                  }}
                >
                  {fmt(deptExpDay[d.id])}
                </span>
              </div>
              <MiniBar value={deptExpDay[d.id]} max={maxDeptExp} color="#e74c3c" />
            </div>
          ))}
        </Card>
      </div>

      {/* MEALS CALLOUT */}
      {(meals.mageragere > 0 || meals.nyakabanda > 0) && (
        <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
          {SITES.map((s) => (
            <div
              key={s.id}
              style={{
                flex: 1,
                background: "#fff7ed",
                border: "1px solid #f59e0b44",
                borderRadius: 12,
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 22 }}>{s.emoji}</span>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#b45309",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                  }}
                >
                  {s.label} — Meals Today
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#92400e" }}>
                  {fmt(meals[s.id] ?? 0)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* RECENT ENTRIES */}
      <Card>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>
          Recent Entries — {activeDate}
        </div>
        {recentTx.length === 0 && topupTx.length === 0 ? (
          <div style={{ color: "#bbb", fontSize: 14, textAlign: "center", padding: "28px 0" }}>
            No entries yet. Use &quot;Record Entry&quot; to add one.
          </div>
        ) : (
          <>
            {recentTx.map((t) => (
              <EntryRow key={t.id} t={t} dispatch={dispatch} />
            ))}
            {topupTx.map((t) => (
              <TopupRow key={t.id} t={t} dispatch={dispatch} />
            ))}
          </>
        )}
      </Card>
    </div>
  );
}

function EntryRow({ t, dispatch }: { t: Transaction; dispatch: Dispatch<AppAction> }) {
  const dept = DEPARTMENTS.find((d) => d.id === t.dept);
  const siteId = t.category === "Meals (Staff)" ? t.mealSite : t.site;
  const site = SITES.find((s) => s.id === siteId);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 0",
        borderBottom: "1px solid #f5f5f5",
      }}
    >
      <span style={{ fontSize: 18 }}>{dept?.emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{dept?.label}</span>
          {site && <Badge color="#64748b">{site.emoji} {site.label}</Badge>}
          {t.mealSession && <Badge color="#b45309">{t.mealSession}</Badge>}
        </div>
        <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>
          {t.category}
          {t.note ? ` · ${t.note}` : ""}
        </div>
      </div>
      <Badge color={t.kind === "revenue" ? "#1B4332" : "#c0392b"}>
        {t.kind === "revenue" ? "+" : "−"}
        {fmt(t.amount)}
      </Badge>
      <button
        type="button"
        onClick={() => dispatch({ type: "DEL_TX", id: t.id })}
        aria-label="Delete entry"
        style={{
          border: "none",
          background: "none",
          color: "#ddd",
          cursor: "pointer",
          fontSize: 18,
          lineHeight: 1,
          padding: "0 4px",
        }}
      >
        ×
      </button>
    </div>
  );
}

function TopupRow({ t, dispatch }: { t: Transaction; dispatch: Dispatch<AppAction> }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 0",
        borderBottom: "1px solid #f5f5f5",
      }}
    >
      <span style={{ fontSize: 18 }}>💜</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: "#7c3aed" }}>Float Top-up</div>
        <div style={{ fontSize: 11, color: "#aaa" }}>{t.note}</div>
      </div>
      <Badge color="#7c3aed">+{fmt(t.amount)}</Badge>
      <button
        type="button"
        onClick={() => dispatch({ type: "DEL_TX", id: t.id })}
        aria-label="Delete top-up"
        style={{
          border: "none",
          background: "none",
          color: "#ddd",
          cursor: "pointer",
          fontSize: 18,
          lineHeight: 1,
          padding: "0 4px",
        }}
      >
        ×
      </button>
    </div>
  );
}
