"use client";

import { useEffect, useReducer, useState } from "react";
import { reducer, initState, todayStr, makeId } from "@/lib/store";
import { apiGetState, apiAddTransaction, apiDeleteTransaction, apiSetFloat, type DataSource } from "@/lib/api";
import type { AppAction } from "@/lib/types";
import { Dashboard } from "./Dashboard";
import { EntryFormPanel } from "./EntryFormPanel";
import { Ledger } from "./Ledger";
import { StaffOps } from "./StaffOps";

type Tab = "dashboard" | "add" | "ledger" | "staff";

const TABS: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "📊 Dashboard" },
  { id: "add", label: "➕ Record Entry" },
  { id: "ledger", label: "📋 Ledger" },
  { id: "staff", label: "👥 Staff & Ops" },
];

const STORAGE_KEY = "miru_ops_v5";

export default function App() {
  // Lazily init from localStorage only after mount (avoids SSR/client mismatch)
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    transactions: [],
    activeDate: todayStr(),
    floats: {},
  }));
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [msg, setMsg] = useState("");
  const [dataSource, setDataSource] = useState<DataSource | null>(null);

  // Hydrate on mount: try the database first, fall back to localStorage
  useEffect(() => {
    (async () => {
      const local = initState();
      const { state: loaded, source } = await apiGetState(local);
      dispatch({ type: "HYDRATE", state: loaded });
      setDataSource(source);
      setHydrated(true);
    })();
  }, []);

  // Persist to localStorage whenever state changes (after hydration) — this
  // remains the offline cache / fallback regardless of data source.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage unavailable (private mode, quota exceeded, etc.)
    }
  }, [state, hydrated]);

  /**
   * Wraps `dispatch` so that data-mutating actions are also persisted to the
   * database (with id pre-generation so local state and the DB record share
   * the same id). UI updates happen immediately via `dispatch`; the API call
   * runs in the background and silently falls back to localStorage-only
   * persistence (already handled by the effect above) if the database is
   * unreachable.
   */
  function dispatchAndSync(action: AppAction) {
    switch (action.type) {
      case "ADD_TX": {
        const id = makeId();
        dispatch({ ...action, id });
        apiAddTransaction({ ...action.payload, id }).then(setDataSource);
        break;
      }
      case "ADD_FLOAT_TOPUP": {
        const id = makeId();
        dispatch({ ...action, id });
        apiAddTransaction({
          id,
          kind: "float_topup",
          date: action.date,
          amount: action.amount,
          note: action.note || "Float top-up",
        }).then(setDataSource);
        break;
      }
      case "DEL_TX":
        dispatch(action);
        apiDeleteTransaction(action.id).then(setDataSource);
        break;
      case "SET_FLOAT":
        dispatch(action);
        apiSetFloat(action.date, action.amount).then(setDataSource);
        break;
      default:
        dispatch(action);
    }
  }

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(""), 2500);
  }

  const tabStyle = (active: boolean) => ({
    padding: "8px 16px",
    borderRadius: 30,
    border: "none",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
    letterSpacing: 0.3,
    background: active ? "#1B4332" : "transparent",
    color: active ? "#fff" : "#555",
    transition: "all .2s",
  });

  return (
    <div
      style={{
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        background: "#F4F7F4",
        minHeight: "100vh",
        color: "#1a1a1a",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          background: "#1B4332",
          color: "#fff",
          padding: "14px 22px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 2px 8px #0002",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 26 }}>🍄</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: -0.5 }}>Miru Mushrooms</div>
            <div style={{ fontSize: 10, opacity: 0.65, letterSpacing: 1.2 }}>
              OPERATIONS DASHBOARD
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {dataSource && (
            <div
              title={
                dataSource === "mongodb"
                  ? "Connected to the shared database"
                  : "Offline — saving to this device only"
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                fontWeight: 700,
                padding: "5px 10px",
                borderRadius: 20,
                background: dataSource === "mongodb" ? "#40916C33" : "#f59e0b33",
                color: dataSource === "mongodb" ? "#d8f3dc" : "#fde68a",
                whiteSpace: "nowrap",
              }}
            >
              <span>{dataSource === "mongodb" ? "🟢" : "🟡"}</span>
              {dataSource === "mongodb" ? "Database" : "Offline"}
            </div>
          )}
          <div style={{ textAlign: "right", fontSize: 12, opacity: 0.8 }}>
            <div style={{ fontSize: 10 }}>Viewing</div>
            <div style={{ fontWeight: 700 }}>{state.activeDate}</div>
          </div>
          <input
            type="date"
            value={state.activeDate}
            onChange={(e) => dispatch({ type: "SET_DATE", date: e.target.value })}
            style={{
              border: "1px solid #ffffff44",
              borderRadius: 8,
              padding: "6px 10px",
              background: "#ffffff15",
              color: "#fff",
              fontSize: 13,
              cursor: "pointer",
            }}
          />
        </div>
      </div>

      {/* TABS */}
      <div
        style={{
          background: "#fff",
          borderBottom: "1px solid #eee",
          padding: "8px 22px",
          display: "flex",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} style={tabStyle(tab === t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "22px 16px" }}>
        {msg && (
          <div
            style={{
              background: "#2D6A4F",
              color: "#fff",
              borderRadius: 10,
              padding: "10px 18px",
              marginBottom: 16,
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {msg}
          </div>
        )}

        {!hydrated ? (
          <div style={{ textAlign: "center", color: "#aaa", padding: "60px 0" }}>Loading…</div>
        ) : (
          <>
            {tab === "dashboard" && (
              <Dashboard state={state} dispatch={dispatchAndSync} activeDate={state.activeDate} />
            )}
            {tab === "add" && (
              <EntryFormPanel dispatch={dispatchAndSync} activeDate={state.activeDate} onSaved={flash} />
            )}
            {tab === "ledger" && <Ledger state={state} dispatch={dispatchAndSync} />}
            {tab === "staff" && <StaffOps state={state} />}
          </>
        )}
      </div>
    </div>
  );
}
