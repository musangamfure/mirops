"use client";

import { SITE_OPTIONS, type SiteId } from "@/lib/constants";

export function SiteToggle({ value, onChange }: { value: SiteId; onChange: (id: SiteId) => void }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {SITE_OPTIONS.map((s) => (
        <button key={s.id} type="button" onClick={() => onChange(s.id)} style={{
          flex: 1, padding: "10px 8px", borderRadius: 10,
          border: `2px solid ${value === s.id ? "#4a7c59" : "#1e3320"}`,
          background: value === s.id ? "#0f1a0f" : "transparent",
          fontWeight: 700, fontSize: 13, cursor: "pointer",
          color: value === s.id ? "#4ade80" : "#6a9c6a",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          fontFamily: "Georgia, serif", transition: "all 0.2s",
        }}>
          <span>{s.emoji}</span> {s.label}
        </button>
      ))}
    </div>
  );
}
