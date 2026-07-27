// A small Top / Inline layout toggle used by block editors that have a question + options.

export default function LayoutToggle({ value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--fg-muted)",
        textTransform: "uppercase", letterSpacing: "0.08em" }}>Layout</span>
      {["top", "inline"].map(opt => (
        <button key={opt} onClick={() => onChange(opt)}
          style={{ padding: "2px 10px", borderRadius: 5, fontSize: 11, fontWeight: 600,
            cursor: "pointer", border: "1px solid",
            borderColor: value === opt ? "var(--accent)" : "var(--border)",
            background: value === opt ? "var(--accent-soft)" : "transparent",
            color: value === opt ? "var(--accent)" : "var(--fg-muted)",
            textTransform: "capitalize" }}>
          {opt}
        </button>
      ))}
    </div>
  );
}