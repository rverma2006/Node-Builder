// Editor for a Break Line block — no configuration needed.
import FieldLabel from "./atoms/FieldLabel";

export default function BreakLineEditor() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <FieldLabel>Break Line</FieldLabel>
      <div style={{ borderTop: "2px dashed var(--border-mid)", margin: "6px 0" }} />
      <span style={{ fontSize: 11, color: "var(--fg-muted)", opacity: 0.6 }}>
        Renders as a horizontal divider in preview. No configuration needed.
      </span>
    </div>
  );
}