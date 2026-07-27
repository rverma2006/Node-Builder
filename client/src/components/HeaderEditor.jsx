// Editor for a Section Header block — just a bold large-text input.
import SmallInput from "./atoms/SmallInput";
import FieldLabel from "./atoms/FieldLabel";

export default function HeaderEditor({ block, onUpdate }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <FieldLabel>Header text</FieldLabel>
      <SmallInput
        value={block.content || ""}
        onChange={v => onUpdate(block.id, { content: v })}
        placeholder="Section heading…"
        style={{ fontSize: 15, fontWeight: 700 }}
      />
      <span style={{ fontSize: 11, color: "var(--fg-muted)", opacity: 0.6 }}>
        Renders as a bold heading in preview. No interaction.
      </span>
    </div>
  );
}