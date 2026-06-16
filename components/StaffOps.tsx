"use client";

import { DEPARTMENTS, SITES, EXPENSE_CATS, EMPLOYEES, MEAL_SESSIONS } from "@/lib/constants";
import type { AppState } from "@/lib/types";
import { fmt } from "@/lib/store";
import { Card, Badge } from "./ui";

export function StaffOps({ state }: { state: AppState }) {
  const allTx = state.transactions;

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 16,
        }}
      >
        {/* TEAM */}
        <Card>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: "#1B4332" }}>
            👥 Team — {EMPLOYEES.length} Employees
          </div>
          {EMPLOYEES.map((emp) => (
            <div
              key={emp}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 0",
                borderBottom: "1px solid #f5f5f5",
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  background: "#1B433220",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  color: "#1B4332",
                  fontSize: 13,
                }}
              >
                {emp[0]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{emp}</div>
              </div>
              <Badge color="#40916C">Active</Badge>
            </div>
          ))}
        </Card>

        {/* P&L BY DEPARTMENT */}
        <Card>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: "#333" }}>
            📈 All-Time P&amp;L by Department
          </div>
          {DEPARTMENTS.map((d) => {
            const dRev = allTx
              .filter((t) => t.dept === d.id && t.kind === "revenue")
              .reduce((s, t) => s + t.amount, 0);
            const dExp = allTx
              .filter((t) => t.dept === d.id && t.kind === "expense")
              .reduce((s, t) => s + t.amount, 0);
            const net = dRev - dExp;
            return (
              <div key={d.id} style={{ marginBottom: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {d.emoji} {d.label}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: net >= 0 ? "#1B4332" : "#c0392b",
                    }}
                  >
                    {fmt(net)}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "#aaa" }}>
                  Rev: {fmt(dRev)} · Exp: {fmt(dExp)}
                </div>
              </div>
            );
          })}
        </Card>
      </div>

      {/* MEALS BY SITE */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: "#b45309" }}>
          🍽 Meals by Site (All Time)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {SITES.map((s) => {
            const siteMealTx = allTx.filter(
              (t) => t.kind === "expense" && t.category === "Meals (Staff)" && t.mealSite === s.id
            );
            const total = siteMealTx.reduce((sum, t) => sum + t.amount, 0);
            return (
              <div key={s.id} style={{ background: "#fff7ed", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: "#92400e", marginBottom: 10 }}>
                  {s.emoji} {s.label}
                </div>
                <div style={{ fontWeight: 800, fontSize: 20, color: "#b45309", marginBottom: 10 }}>
                  {fmt(total)}
                </div>
                {MEAL_SESSIONS.map((sess) => {
                  const sessTotal = siteMealTx
                    .filter((t) => t.mealSession === sess)
                    .reduce((sum, t) => sum + t.amount, 0);
                  return (
                    <div
                      key={sess}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        color: "#92400e",
                        marginBottom: 4,
                      }}
                    >
                      <span>
                        {sess === "Breakfast" ? "🌅" : sess === "Lunch" ? "☀️" : "🌙"} {sess}
                      </span>
                      <span style={{ fontWeight: 600 }}>{fmt(sessTotal)}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </Card>

      {/* EXPENSE CATEGORIES */}
      <Card>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: "#333" }}>
          💸 All Expense Categories (All Time)
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
            gap: 10,
          }}
        >
          {EXPENSE_CATS.map((cat) => {
            const total = allTx
              .filter((t) => t.kind === "expense" && t.category === cat)
              .reduce((s, t) => s + t.amount, 0);
            return (
              <div key={cat} style={{ background: "#f9f9f9", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{cat}</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: total > 0 ? "#c0392b" : "#ddd" }}>
                  {fmt(total)}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
