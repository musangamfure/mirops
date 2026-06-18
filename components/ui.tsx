import type { ReactNode, CSSProperties } from "react";

export function Badge({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span style={{
      background: color + "22", color, border: `1px solid ${color}44`,
      borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      background: "#111e0f", borderRadius: 14, padding: "18px 20px",
      border: "1px solid #1e3320", ...style,
    }}>{children}</div>
  );
}

export function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ height: 6, background: "#1e3320", borderRadius: 4, overflow: "hidden" }}>
      <div style={{ width: pct + "%", height: "100%", background: color, borderRadius: 4, transition: "width .4s" }} />
    </div>
  );
}

export const labelSt: CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#9ab89a",
  textTransform: "uppercase", letterSpacing: 0.9, marginBottom: 6, display: "block",
};

export const inputSt: CSSProperties = {
  width: "100%", border: "1.5px solid #1e3320", borderRadius: 10,
  padding: "11px 14px", fontSize: 14, outline: "none",
  background: "#0a1208", color: "#e8dcc8", boxSizing: "border-box", fontFamily: "inherit",
};
