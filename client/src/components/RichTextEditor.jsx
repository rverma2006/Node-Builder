// Editor for a plain Text block — a textarea for freeform text shown in preview.
import FieldLabel from "./atoms/FieldLabel";
import SmallTextarea from "./atoms/SmallTextarea";

export default function RichTextEditor({ block, onUpdate }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <FieldLabel>Text content</FieldLabel>
      <SmallTextarea
        value={block.content || ""}
        onChange={v => onUpdate(block.id, { content: v })}
        placeholder="Write some text…"
        rows={4}
      />
      <span style={{ fontSize: 11, color: "var(--fg-muted)", opacity: 0.6 }}>
        Renders as plain text in preview. No interaction.
      </span>
    </div>
  );
}