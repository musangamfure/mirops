"use client";

import { useState, type Dispatch } from "react";
import type { AppState, AppAction } from "@/lib/types";
import { fmt, getOpeningFloat, getClosingFloat, sumKind, isLowFloat, isDeficit } from "@/lib/store";

export function FloatPanel({
  state, dispatch, activeDate,
}: {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  activeDate: string;
}) {
  const [editingOpen, setEditingOpen] = useState(false);
  const [openInput, setOpenInput] = useState("");
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmt, setTopupAmt] = useState("");
  const [topupNote, setTopupNote] = useState("");
  const [topupError, setTopupError] = useState("");
  const [openError, setOpenError] = useState("");

  const opening = getOpeningFloat(state, activeDate);
  const closing = getClosingFloat(state, activeDate);
  const dayTx = state.transactions.filter((t) => t.date === activeDate);
  const topups = dayTx.filter((t) => t.kind === "float_topup");
  const totalTopups = sumKind(dayTx, "float_topup");
  const dayRev = sumKind(dayTx, "revenue");
  const dayExp = sumKind(dayTx, "expense");
  const lowFloat = isLowFloat(closing);
  const deficit = isDeficit(closing);

  function saveOpen() {
    const v = Number(openInput);
    if (openInput.trim() === "" || isNaN(v) || v < 0) { setOpenError("Enter a valid non-negative number"); return; }
    dispatch({ type: "SET_FLOAT", date: activeDate, amount: v });
    setEditingOpen(false); setOpenInput(""); setOpenError("");
  }

  function saveTopup() {
    const v = Number(topupAmt);
    if (topupAmt.trim() === "" || isNaN(v) || v <= 0) { setTopupError("Enter an amount greater than 0"); return; }
    dispatch({ type: "ADD_FLOAT_TOPUP", date: activeDate, amount: v, note: topupNote.trim() || "Float top-up" });
    setTopupAmt(""); setTopupNote(""); setTopupError(""); setShowTopup(false);
  }

  const cardSt: React.CSSProperties = {
    flex: 1, minWidth: 150, background: "#111e0f",
    borderRadius: 14, padding: "16px 18px",
    border: "1px solid #1e3320",
  };

  const metaSt: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: 1, marginBottom: 6, color: "#6a9c6a",
  };

  const valSt: React.CSSProperties = {
    fontSize: 20, fontWeight: 800, color: "#c8e6c9", marginBottom: 4,
  };

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {/* Opening float */}
      <div style={cardSt}>
        <div style={metaSt}>Opening Float</div>
        {editingOpen ? (
          <div>
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              <input autoFocus type="number" value={openInput}
                onChange={(e) => { setOpenInput(e.target.value); setOpenError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") saveOpen(); if (e.key === "Escape") { setEditingOpen(false); setOpenError(""); } }}
                placeholder={String(opening)}
                style={{ fontSize: 15, fontWeight: 700, padding: "6px 10px", flex: 1 }}
              />
              <button type="button" onClick={saveOpen} style={{
                background: "#4a7c59", color: "#fff", border: "none", borderRadius: 8,
                padding: "6px 12px", fontWeight: 700, cursor: "pointer", fontSize: 13,
                fontFamily: "Georgia, serif",
              }}>Set</button>
            </div>
            {openError && <div style={{ fontSize: 11, color: "#f87171", marginTop: 4 }}>{openError}</div>}
          </div>
        ) : (
          <>
            <div style={valSt}>{fmt(opening)}</div>
            <button type="button" onClick={() => { setEditingOpen(true); setOpenInput(String(opening)); }} style={{
              fontSize: 11, color: "#4a7c59", background: "none", border: "none",
              cursor: "pointer", padding: 0, fontWeight: 600,
            }}>✏ Edit</button>
          </>
        )}
      </div>

      {/* Today's flow */}
      <div style={cardSt}>
        <div style={metaSt}>Today&apos;s Flow</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {[
            { label: "+ Revenue", val: dayRev, color: "#4ade80" },
            { label: "− Expenses", val: dayExp, color: "#f87171" },
            ...(totalTopups > 0 ? [{ label: "+ Top-ups", val: totalTopups, color: "#c4b5fd" }] : []),
          ].map((row) => (
            <div key={row.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "#9ab89a" }}>{row.label}</span>
              <span style={{ fontWeight: 700, color: row.color }}>{fmt(row.val)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Closing float */}
      <div style={{
        ...cardSt,
        background: deficit ? "#1a0a0a" : lowFloat ? "#160e00" : "#111e0f",
        borderColor: deficit ? "#7f1d1d" : lowFloat ? "#78460a44" : "#1e3320",
      }}>
        <div style={{ ...metaSt, color: deficit ? "#f87171" : lowFloat ? "#f59e0b" : "#6a9c6a" }}>
          Closing Float {(lowFloat || deficit) ? "⚠️" : ""}
        </div>
        <div style={{ ...valSt, color: deficit ? "#f87171" : lowFloat ? "#f59e0b" : "#4ade80" }}>
          {fmt(closing)}
        </div>
        {lowFloat && !deficit && <div style={{ fontSize: 11, color: "#b45309", fontWeight: 600 }}>Float running low</div>}
        {deficit && <div style={{ fontSize: 11, color: "#c0392b", fontWeight: 600 }}>⛔ Float in deficit</div>}
      </div>

      {/* Top-up */}
      <div style={{ ...cardSt, background: "#130b20", borderColor: "#3b1a5c44" }}>
        <div style={{ ...metaSt, color: "#9b59b6" }}>Float Top-up</div>
        {!showTopup ? (
          <>
            {topups.length > 0 && (
              <div style={{ fontSize: 13, fontWeight: 700, color: "#c4b5fd", marginBottom: 8 }}>
                {fmt(totalTopups)} added today
              </div>
            )}
            <button type="button" onClick={() => setShowTopup(true)} style={{
              background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8,
              padding: "8px 14px", fontWeight: 700, cursor: "pointer",
              fontSize: 13, width: "100%", fontFamily: "Georgia, serif",
            }}>+ Add Money</button>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <input autoFocus type="number" min="0" value={topupAmt}
              onChange={(e) => { setTopupAmt(e.target.value); setTopupError(""); }}
              placeholder="Amount (RWF)"
              style={{ fontSize: 14, fontWeight: 700, padding: "6px 10px", color: "#c4b5fd" }}
            />
            <input type="text" value={topupNote} onChange={(e) => setTopupNote(e.target.value)}
              placeholder="Reason (optional)" style={{ fontSize: 13, padding: "6px 10px" }} />
            {topupError && <div style={{ fontSize: 11, color: "#f87171" }}>{topupError}</div>}
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" onClick={saveTopup} style={{
                flex: 1, background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8,
                padding: "7px", fontWeight: 700, cursor: "pointer", fontSize: 13, fontFamily: "Georgia, serif",
              }}>Save</button>
              <button type="button" onClick={() => { setShowTopup(false); setTopupAmt(""); setTopupNote(""); setTopupError(""); }} style={{
                background: "#1e3320", color: "#9ab89a", border: "none", borderRadius: 8,
                padding: "7px 10px", fontWeight: 700, cursor: "pointer", fontSize: 13, fontFamily: "Georgia, serif",
              }}>✕</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
