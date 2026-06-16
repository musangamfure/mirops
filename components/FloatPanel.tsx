"use client";

import { useState, type Dispatch } from "react";
import type { AppState, AppAction } from "@/lib/types";
import {
  fmt,
  getOpeningFloat,
  getClosingFloat,
  sumKind,
  isLowFloat,
  isDeficit,
} from "@/lib/store";
import { inputSt } from "./ui";

export function FloatPanel({
  state,
  dispatch,
  activeDate,
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
    if (openInput.trim() === "" || isNaN(v) || v < 0) {
      setOpenError("Enter a valid non-negative number");
      return;
    }
    dispatch({ type: "SET_FLOAT", date: activeDate, amount: v });
    setEditingOpen(false);
    setOpenInput("");
    setOpenError("");
  }

  function saveTopup() {
    const v = Number(topupAmt);
    if (topupAmt.trim() === "" || isNaN(v) || v <= 0) {
      setTopupError("Enter an amount greater than 0");
      return;
    }
    dispatch({
      type: "ADD_FLOAT_TOPUP",
      date: activeDate,
      amount: v,
      note: topupNote.trim() || "Float top-up",
    });
    setTopupAmt("");
    setTopupNote("");
    setTopupError("");
    setShowTopup(false);
  }

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {/* OPENING FLOAT */}
        <div
          style={{
            flex: 1,
            minWidth: 160,
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
              marginBottom: 4,
            }}
          >
            Opening Float
          </div>
          {editingOpen ? (
            <div>
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <input
                  autoFocus
                  type="number"
                  value={openInput}
                  onChange={(e) => {
                    setOpenInput(e.target.value);
                    setOpenError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveOpen();
                    if (e.key === "Escape") {
                      setEditingOpen(false);
                      setOpenError("");
                    }
                  }}
                  placeholder={String(opening)}
                  style={{
                    ...inputSt,
                    fontSize: 16,
                    fontWeight: 700,
                    padding: "6px 10px",
                    flex: 1,
                    borderColor: openError ? "#c0392b" : "#e5e5e5",
                  }}
                />
                <button
                  type="button"
                  onClick={saveOpen}
                  style={{
                    background: "#1B4332",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "6px 12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  Set
                </button>
              </div>
              {openError && (
                <div style={{ fontSize: 11, color: "#c0392b", marginTop: 4 }}>
                  {openError}
                </div>
              )}
            </div>
          ) : (
            <>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  color: "#1B4332",
                  marginBottom: 4,
                }}
              >
                {fmt(opening)}
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingOpen(true);
                  setOpenInput(String(opening));
                }}
                style={{
                  fontSize: 11,
                  color: "#40916C",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  fontWeight: 600,
                }}
              >
                ✏️ Edit
              </button>
            </>
          )}
        </div>

        {/* TODAY'S FLOW */}
        <div
          style={{
            flex: 1,
            minWidth: 160,
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
              marginBottom: 8,
            }}
          >
            Today&apos;s Flow
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "#555" }}>+ Revenue</span>
              <span style={{ fontWeight: 700, color: "#1B4332" }}>{fmt(dayRev)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "#555" }}>− Expenses</span>
              <span style={{ fontWeight: 700, color: "#c0392b" }}>{fmt(dayExp)}</span>
            </div>
            {totalTopups > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#555" }}>+ Top-ups</span>
                <span style={{ fontWeight: 700, color: "#7c3aed" }}>{fmt(totalTopups)}</span>
              </div>
            )}
          </div>
        </div>

        {/* CLOSING FLOAT */}
        <div
          style={{
            flex: 1,
            minWidth: 160,
            background: lowFloat || deficit ? "#fff7ed" : "#fff",
            borderRadius: 14,
            padding: "18px 20px",
            boxShadow: "0 1px 4px #0000000d",
            border: `1px solid ${lowFloat || deficit ? "#f59e0b55" : "#eee"}`,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 4,
              color: lowFloat || deficit ? "#b45309" : "#888",
            }}
          >
            Closing Float {(lowFloat || deficit) && "⚠️"}
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: deficit ? "#c0392b" : lowFloat ? "#b45309" : "#1B4332",
              marginBottom: 4,
            }}
          >
            {fmt(closing)}
          </div>
          {lowFloat && !deficit && (
            <div style={{ fontSize: 11, color: "#b45309", fontWeight: 600 }}>
              Float running low
            </div>
          )}
          {deficit && (
            <div style={{ fontSize: 11, color: "#c0392b", fontWeight: 600 }}>
              ⛔ Float in deficit
            </div>
          )}
        </div>

        {/* FLOAT TOP-UP */}
        <div
          style={{
            flex: 1,
            minWidth: 160,
            background: "#f8f5ff",
            borderRadius: 14,
            padding: "18px 20px",
            boxShadow: "0 1px 4px #0000000d",
            border: "1px solid #e9d5ff",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "#6b21a8",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 4,
            }}
          >
            Float Top-up
          </div>
          {!showTopup ? (
            <>
              {topups.length > 0 && (
                <div style={{ fontSize: 13, fontWeight: 700, color: "#7c3aed", marginBottom: 6 }}>
                  {fmt(totalTopups)} added today
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowTopup(true)}
                style={{
                  background: "#7c3aed",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 13,
                  width: "100%",
                }}
              >
                + Add Money
              </button>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <input
                autoFocus
                type="number"
                min="0"
                value={topupAmt}
                onChange={(e) => {
                  setTopupAmt(e.target.value);
                  setTopupError("");
                }}
                placeholder="Amount (RWF)"
                style={{
                  ...inputSt,
                  fontSize: 14,
                  fontWeight: 700,
                  padding: "6px 10px",
                  color: "#7c3aed",
                  borderColor: topupError ? "#c0392b" : "#e5e5e5",
                }}
              />
              <input
                type="text"
                value={topupNote}
                onChange={(e) => setTopupNote(e.target.value)}
                placeholder="Reason (optional)"
                style={{ ...inputSt, fontSize: 13, padding: "6px 10px" }}
              />
              {topupError && (
                <div style={{ fontSize: 11, color: "#c0392b" }}>{topupError}</div>
              )}
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  onClick={saveTopup}
                  style={{
                    flex: 1,
                    background: "#7c3aed",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "7px",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowTopup(false);
                    setTopupAmt("");
                    setTopupNote("");
                    setTopupError("");
                  }}
                  style={{
                    background: "#f0f0f0",
                    color: "#666",
                    border: "none",
                    borderRadius: 8,
                    padding: "7px 10px",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
