"use client";

import { SITES, type SiteId } from "@/lib/constants";

export function SiteToggle({
  value,
  onChange,
}: {
  value: SiteId;
  onChange: (id: SiteId) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {SITES.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onChange(s.id)}
          style={{
            flex: 1,
            padding: "10px 8px",
            borderRadius: 10,
            border: `2px solid ${value === s.id ? "#1B4332" : "#eee"}`,
            background: value === s.id ? "#1B433215" : "#fff",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            color: value === s.id ? "#1B4332" : "#888",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <span>{s.emoji}</span> {s.label}
        </button>
      ))}
    </div>
  );
}
