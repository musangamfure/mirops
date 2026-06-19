"use client";

import { useEffect, useReducer, useState } from "react";
import { reducer, initState, todayStr, makeId } from "@/lib/store";
import {
  apiGetState,
  apiAddTransaction,
  apiDeleteTransaction,
  apiSetFloat,
} from "@/lib/api";
import type { AppAction } from "@/lib/types";
import { Dashboard } from "./Dashboard";
import { EntryFormPanel } from "./EntryFormPanel";
import { Ledger } from "./Ledger";
import { StaffOps } from "./StaffOps";

// ── useIsMobile ────────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  useEffect(() => {
    const check = () => {
      const byWidth = window.innerWidth < 900;
      const byMedia = window.matchMedia("(max-width: 899px)").matches;
      const byAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
      setIsMobile(byWidth || byMedia || byAgent);
    };
    check();
    const mq = window.matchMedia("(max-width: 899px)");
    mq.addEventListener("change", check);
    window.addEventListener("resize", check);
    return () => {
      mq.removeEventListener("change", check);
      window.removeEventListener("resize", check);
    };
  }, []);
  return isMobile;
}

// ── Toast ──────────────────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: string }) {
  const isError = type === "error";
  const isInfo = type === "info";
  const bg = isError ? "#2a0a0a" : isInfo ? "#0a1208" : "#0f1a0f";
  const border = isError ? "#c0392b" : isInfo ? "#2d4a2d" : "#4ade80";
  const icon = isError ? "⚠ " : isInfo ? "" : "✓ ";
  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9998,
        background: bg,
        color: "#e8dcc8",
        padding: "10px 20px",
        borderRadius: 24,
        fontSize: 13,
        border: `1px solid ${border}`,
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        whiteSpace: "nowrap",
        animation: "fadeSlideIn 0.3s var(--ease-out)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {icon}{msg}
    </div>
  );
}

type Tab = "dashboard" | "add" | "ledger" | "staff";

const TABS: { id: Tab; label: string; icon: string; short: string }[] = [
  { id: "dashboard", label: "Dashboard",    icon: "📊", short: "Home" },
  { id: "add",       label: "Record Entry", icon: "➕", short: "Add" },
  { id: "ledger",    label: "Ledger",       icon: "📋", short: "Ledger" },
  { id: "staff",     label: "Staff & Ops",  icon: "👥", short: "Staff" },
];

const STORAGE_KEY = "miru_ops_v5";

export default function App() {
  const isMobile = useIsMobile();

  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    transactions: [],
    activeDate: todayStr(),
    floats: {},
  }));
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  useEffect(() => {
    (async () => {
      const local = initState();
      const { state: loaded, source } = await apiGetState(local);
      dispatch({ type: "HYDRATE", state: loaded });
      setHydrated(true);
      if (source === "mongodb") {
        flash("🟢 Connected to database", "info", 2000);
      }
      try {
        const res = await fetch("/api/sheets/status");
        const { configured } = await res.json();
        if (configured) {
          flash("🟢 Synced to Google Sheets", "info", 2000);
        }
      } catch {
        // Sheets status check is non-critical — ignore failures silently.
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [state, hydrated]);

  function dispatchAndSync(action: AppAction) {
    switch (action.type) {
      case "ADD_TX": {
        const id = makeId();
        dispatch({ ...action, id });
        apiAddTransaction({ ...action.payload, id });
        break;
      }
      case "ADD_FLOAT_TOPUP": {
        const id = makeId();
        dispatch({ ...action, id });
        apiAddTransaction({
          id, kind: "float_topup", date: action.date,
          amount: action.amount, note: action.note || "Float top-up",
        });
        break;
      }
      case "DEL_TX":
        dispatch(action);
        apiDeleteTransaction(action.id);
        break;
      case "SET_FLOAT":
        dispatch(action);
        apiSetFloat(action.date, action.amount);
        break;
      default:
        dispatch(action);
    }
  }

  function flash(msg: string, type = "success", duration = 3000) {
    setToast({ msg, type });
    setTimeout(() => setToast(null), duration);
  }

  // ── Loading skeleton ───────────────────────────────────────────
  if (isMobile === null) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a1208", display: "flex",
        alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#4a7c59", fontSize: 28 }}>🍄</div>
      </div>
    );
  }

  const activeTabLabel = TABS.find((t) => t.id === tab)?.label ?? "";

  // ── SHARED HEADER ─────────────────────────────────────────────
  const header = (
    <header
      style={{
        background: "#111e0f",
        borderBottom: "1px solid #1e3320",
        padding: isMobile ? "12px 16px" : "0 28px",
        position: "sticky",
        top: 0,
        zIndex: 100,
        boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
      }}
    >
      {isMobile ? (
        /* ── Mobile header ── */
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>🍄</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: "bold", color: "#c8e6c9" }}>Miru Ops</div>
              <div style={{ fontSize: 10, color: "#4a7c59", letterSpacing: 1.5, textTransform: "uppercase" }}>Operations</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          </div>
        </div>
      ) : (
        /* ── Desktop header ── */
        <div style={{
          maxWidth: 1200, margin: "0 auto", display: "flex",
          alignItems: "center", justifyContent: "space-between", height: 64,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 28 }}>🍄</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: "bold", color: "#c8e6c9" }}>Miru Mushrooms</div>
              <div style={{ fontSize: 10, color: "#4a7c59", letterSpacing: 2, textTransform: "uppercase" }}>Operations Dashboard</div>
            </div>
          </div>

          {/* Desktop nav */}
          <nav style={{ display: "flex", gap: 2 }}>
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: "8px 18px", borderRadius: 8, border: "none",
                cursor: "pointer", fontSize: 13,
                background: tab === t.id ? "#4a7c59" : "transparent",
                color: tab === t.id ? "#fff" : "#9ab89a",
                fontWeight: tab === t.id ? "bold" : "normal",
                transition: "all 0.2s",
                fontFamily: "Georgia, serif",
              }}>
                {t.icon} {t.label}
              </button>
            ))}
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          </div>
        </div>
      )}
    </header>
  );

  // ── MOBILE LAYOUT ─────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a1208", color: "#e8dcc8", paddingBottom: 76 }}>
        {toast && <Toast {...toast} />}
        {header}

        <div style={{ padding: "16px 16px 0" }}>
          {!hydrated ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#4a7c59" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🍄</div>
              <div>Loading…</div>
            </div>
          ) : (
            <>
              {tab === "dashboard" && (
                <Dashboard state={state} dispatch={dispatchAndSync}
                  activeDate={state.activeDate} isMobile={true} onFlash={flash} />
              )}
              {tab === "add" && (
                <EntryFormPanel dispatch={dispatchAndSync}
                  activeDate={state.activeDate} onSaved={(m) => flash(m)} />
              )}
              {tab === "ledger" && (
                <Ledger state={state} dispatch={dispatchAndSync} isMobile={true} onFlash={flash} />
              )}
              {tab === "staff" && <StaffOps state={state} isMobile={true} />}
            </>
          )}
        </div>

        {/* Mobile bottom nav */}
        <nav style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: "#111e0f", borderTop: "1px solid #1e3320",
          display: "flex", zIndex: 100,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: "10px 0", border: "none", background: "transparent",
              cursor: "pointer", display: "flex", flexDirection: "column",
              alignItems: "center", gap: 3,
            }}>
              <span style={{ fontSize: 20 }}>{t.icon}</span>
              <span style={{
                fontSize: 10, color: tab === t.id ? "#4ade80" : "#6a9c6a",
                fontFamily: "Georgia, serif",
              }}>{t.short}</span>
              {tab === t.id && (
                <div style={{ width: 20, height: 2, borderRadius: 1, background: "#4ade80" }} />
              )}
            </button>
          ))}
        </nav>
      </div>
    );
  }

  // ── DESKTOP LAYOUT ────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#0a1208", color: "#e8dcc8" }}>
      {toast && <Toast {...toast} />}
      {header}

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>
        {!hydrated ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#4a7c59" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🍄</div>
            <div>Loading operations data…</div>
          </div>
        ) : (
          <>
            {tab === "dashboard" && (
              <Dashboard state={state} dispatch={dispatchAndSync}
                activeDate={state.activeDate} isMobile={false} onFlash={flash} />
            )}
            {tab === "add" && (
              <div style={{ maxWidth: 660, margin: "0 auto" }}>
                <EntryFormPanel dispatch={dispatchAndSync}
                  activeDate={state.activeDate} onSaved={(m) => flash(m)} />
              </div>
            )}
            {tab === "ledger" && (
              <Ledger state={state} dispatch={dispatchAndSync} isMobile={false} onFlash={flash} />
            )}
            {tab === "staff" && <StaffOps state={state} isMobile={false} />}
          </>
        )}
      </main>
    </div>
  );
}
