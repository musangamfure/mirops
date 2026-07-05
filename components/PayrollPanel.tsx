"use client";

import { useEffect, useState } from "react";
import { fmt } from "@/lib/store";
import type { PayrollEntry } from "@/lib/payroll";
import { currentMonthStr, formatMonthLabel } from "@/lib/payroll";
import { apiGetPayroll, apiUpdatePayrollEntry } from "@/lib/payrollApi";
import { Card } from "./ui";

// Payroll history starts with the June 2026 workbook — nothing to show,
// or generate, before that.
const MIN_PAYROLL_MONTH = "2026-06";

// ── Editable number cell — local text buffer, commits on blur ───
function NumberCell({
  value, onCommit, fullWidth = false, netColor = false,
}: { value: number; onCommit: (v: number) => void; fullWidth?: boolean; netColor?: boolean }) {
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);

  function commit() {
    const n = Number(text);
    if (!isNaN(n) && n >= 0 && n !== value) onCommit(n);
    else setText(String(value));
  }

  return (
    <input
      type="number"
      min={0}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      style={{
        width: fullWidth ? "100%" : netColor ? 120 : 90, boxSizing: "border-box",
        border: `1px solid ${netColor ? "#2d4a2d" : "#1e3320"}`, borderRadius: 8,
        padding: "6px 8px", fontSize: 13, background: "#0a1208",
        color: netColor ? "#4ade80" : "#e8dcc8",
        fontWeight: netColor ? 800 : 400,
        textAlign: "right", fontFamily: "inherit",
      }}
    />
  );
}

function PaidBtn({ paid, onClick }: { paid: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700,
        cursor: "pointer", fontFamily: "Georgia, serif", whiteSpace: "nowrap",
        background: paid ? "#1b4332" : "#3a1515",
        color: paid ? "#4ade80" : "#f87171",
      }}
    >
      {paid ? "✓ Paid" : "Mark Paid"}
    </button>
  );
}

export function PayrollPanel({
  isMobile, onFlash,
}: {
  isMobile: boolean;
  onFlash?: (msg: string, type?: string) => void;
}) {
  const [month, setMonth] = useState(() => {
    const cur = currentMonthStr();
    return cur < MIN_PAYROLL_MONTH ? MIN_PAYROLL_MONTH : cur;
  });
  const [entries, setEntries] = useState<PayrollEntry[]>([]);
  const [loading, setLoading] = useState(true);

  function fail(err: unknown) {
    onFlash?.(err instanceof Error ? err.message : "Something went wrong", "error");
  }

  useEffect(() => {
    setLoading(true);
    apiGetPayroll(month)
      .then(setEntries)
      .catch(fail)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function updateEntry(id: string, patch: Partial<{ daysToBePaid: number; ideni: number; netSalary: number; paid: boolean }>) {
    try {
      const updated = await apiUpdatePayrollEntry(id, patch);
      setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)));
      if (patch.paid !== undefined) {
        onFlash?.(patch.paid ? `Marked ${updated.employeeName} as paid` : `Marked ${updated.employeeName} as unpaid`);
      }
    } catch (err) {
      fail(err);
    }
  }

  const totalNet = entries.reduce((s, e) => s + e.netSalary, 0);
  const paidCount = entries.filter((e) => e.paid).length;

  return (
    <div>
      {/* Title row with month picker */}
      <div style={{
        marginBottom: 20,
        display: "flex",
        alignItems: isMobile ? "flex-start" : "center",
        justifyContent: "space-between",
        flexDirection: isMobile ? "column" : "row",
        flexWrap: "wrap",
        gap: isMobile ? 12 : 10,
      }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: isMobile ? 20 : 26, fontWeight: "bold", color: "#c8e6c9", margin: 0 }}>
            Payroll
          </h1>
          <p style={{ color: "#6a9c6a", marginTop: 4, fontSize: 13 }}>{formatMonthLabel(month)}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, width: isMobile ? "100%" : "auto", flexShrink: 0 }}>
          <label style={{ fontSize: 12, color: "#6a9c6a", fontWeight: 600, flexShrink: 0 }}>Month</label>
          <input
            type="month"
            value={month}
            min={MIN_PAYROLL_MONTH}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            style={{
              border: "1px solid #2d4a2d", borderRadius: 8,
              padding: "7px 12px", background: "#162214",
              color: "#c8e6c9", fontSize: 13,
              width: isMobile ? "100%" : 170,
              maxWidth: "100%", boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      {/* Summary cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr 1fr 1fr" : "repeat(3, 1fr)",
        gap: 12, marginBottom: 20,
      }}>
        <Card>
          <div style={{ fontSize: isMobile ? 18 : 20, marginBottom: 6 }}>👥</div>
          <div style={{ fontSize: isMobile ? 17 : 24, fontWeight: "bold", color: "#c8e6c9" }}>{entries.length}</div>
          <div style={{ fontSize: 10, color: "#6a9c6a", marginTop: 4, textTransform: "uppercase", letterSpacing: 0.7 }}>
            Employees
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: isMobile ? 18 : 20, marginBottom: 6 }}>💰</div>
          <div style={{ fontSize: isMobile ? 15 : 24, fontWeight: "bold", color: "#c8e6c9" }}>{fmt(totalNet)}</div>
          <div style={{ fontSize: 10, color: "#6a9c6a", marginTop: 4, textTransform: "uppercase", letterSpacing: 0.7 }}>
            Total Net Pay
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: isMobile ? 18 : 20, marginBottom: 6 }}>✅</div>
          <div style={{ fontSize: isMobile ? 17 : 24, fontWeight: "bold", color: "#c8e6c9" }}>{paidCount}/{entries.length}</div>
          <div style={{ fontSize: 10, color: "#6a9c6a", marginTop: 4, textTransform: "uppercase", letterSpacing: 0.7 }}>
            Paid
          </div>
        </Card>
      </div>

      {/* Payroll entries */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "#4a7c59" }}>Loading payroll…</div>
        ) : entries.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "#3a5c3a", fontStyle: "italic", fontSize: 13 }}>
            No active employees to run payroll for. Add employees in Staff &amp; Ops first.
          </div>
        ) : isMobile ? (
          // ── Mobile: stacked cards ──
          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            {entries.map((e) => (
              <div key={e.id} style={{
                border: "1px solid #1e3320", borderRadius: 12, padding: 14, background: "#162214",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
                  <div style={{ fontWeight: 700, color: "#c8e6c9", fontSize: 14 }}>{e.employeeName}</div>
                  <PaidBtn paid={e.paid} onClick={() => updateEntry(e.id, { paid: !e.paid })} />
                </div>
                <div style={{ fontSize: 11, color: "#6a9c6a", marginBottom: 12 }}>{e.basisOfCalculation}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "#6a9c6a", marginBottom: 4, textTransform: "uppercase" }}>Days Paid</div>
                    <NumberCell fullWidth value={e.daysToBePaid} onCommit={(v) => updateEntry(e.id, { daysToBePaid: v })} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "#6a9c6a", marginBottom: 4, textTransform: "uppercase" }}>Ideni</div>
                    <NumberCell fullWidth value={e.ideni} onCommit={(v) => updateEntry(e.id, { ideni: v })} />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, paddingTop: 8, borderTop: "1px solid #1e3320" }}>
                  <span style={{ color: "#9ab89a" }}>Net Salary</span>
                  <NumberCell value={e.netSalary} onCommit={(v) => updateEntry(e.id, { netSalary: v })} netColor />
                </div>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "8px 4px 2px", fontWeight: 700 }}>
              <span style={{ color: "#9ab89a" }}>Total</span>
              <span style={{ color: "#4ade80" }}>{fmt(totalNet)}</span>
            </div>
          </div>
        ) : (
          // ── Desktop: table ──
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#162214", textAlign: "left" }}>
                  {["Employee", "Basis of Calculation", "Wage / Day", "Days to be Paid", "Ideni", "Net Salary", "Status"].map((h) => (
                    <th key={h} style={{
                      padding: "10px 14px", color: "#9ab89a", fontWeight: 700,
                      fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} style={{ borderTop: "1px solid #1e3320" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: "#c8e6c9", whiteSpace: "nowrap" }}>{e.employeeName}</td>
                    <td style={{ padding: "10px 14px", color: "#9ab89a", whiteSpace: "nowrap" }}>{e.basisOfCalculation}</td>
                    <td style={{ padding: "10px 14px", color: "#9ab89a", whiteSpace: "nowrap" }}>{fmt(e.wagePerDay)}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <NumberCell value={e.daysToBePaid} onCommit={(v) => updateEntry(e.id, { daysToBePaid: v })} />
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <NumberCell value={e.ideni} onCommit={(v) => updateEntry(e.id, { ideni: v })} />
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <NumberCell value={e.netSalary} onCommit={(v) => updateEntry(e.id, { netSalary: v })} netColor />
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <PaidBtn paid={e.paid} onClick={() => updateEntry(e.id, { paid: !e.paid })} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid #2d4a2d" }}>
                  <td colSpan={5} style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, color: "#9ab89a" }}>
                    Total
                  </td>
                  <td style={{ padding: "12px 14px", fontWeight: 800, color: "#4ade80", whiteSpace: "nowrap" }}>{fmt(totalNet)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
