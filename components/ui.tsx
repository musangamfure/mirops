import type { ReactNode, CSSProperties } from "react";

// ─── BADGE ────────────────────────────────────────────────────────────────────
export function Badge({
  color,
  children,
}: {
  color: string;
  children: ReactNode;
}) {
  return (
    <span
      style={{
        background: color + "22",
        color,
        border: `1px solid ${color}44`,
        borderRadius: 6,
        padding: "2px 8px",
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

// ─── CARD ─────────────────────────────────────────────────────────────────────
export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 14,
        padding: "20px 22px",
        boxShadow: "0 1px 4px #0000000d",
        border: "1px solid #eee",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── MINI BAR (small horizontal progress bar for dept comparisons) ────────────
export function MiniBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      style={{
        height: 6,
        background: "#f0f0f0",
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: pct + "%",
          height: "100%",
          background: color,
          borderRadius: 4,
          transition: "width .4s",
        }}
      />
    </div>
  );
}

// ─── SHARED FORM STYLES ─────────────────────────────────────────────────────────
export const labelSt: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#555",
  textTransform: "uppercase",
  letterSpacing: 0.9,
  marginBottom: 6,
  display: "block",
};

export const inputSt: CSSProperties = {
  width: "100%",
  border: "1.5px solid #e5e5e5",
  borderRadius: 10,
  padding: "11px 14px",
  fontSize: 14,
  outline: "none",
  background: "#fafafa",
  boxSizing: "border-box",
  fontFamily: "inherit",
};
