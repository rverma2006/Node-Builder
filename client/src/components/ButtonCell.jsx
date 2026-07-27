import { useState } from "react";
import { TYPE_COLORS } from "../constants";
import SmallInput from "./atoms/SmallInput";
import AddChildPopover from "./AddChildPopover";
import NestedBlockList from "./NestedBlockList";

export default function ButtonCell({
  btn, idx, type, blockId,
  onUpdateBtn, onUpdate, onRemove, onMove,
  onAddToBlock, onAddToButton, onAddToOption, onAddToBullet,
}) {
  const [childrenOpen, setChildrenOpen] = useState(false);
  const color = TYPE_COLORS[type];
  const hasChildren = btn.children && btn.children.length > 0;

  return (
    <div style={{
      background: "var(--surface)",
      border: `1px solid ${hasChildren ? color + "44" : "var(--border)"}`,
      borderRadius: 8, padding: 10,
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      {/* Button name row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{
          borderRadius: type === "radio" ? "50%" : 4,
          width: 13, height: 13,
          border: `2px solid ${color}`,
          flexShrink: 0,
        }} />
        <SmallInput
          value={btn.name}
          onChange={v => onUpdateBtn(idx, "name", v)}
          placeholder={`Button ${idx + 1}`}
        />
      </div>

      {/* Nested block controls */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderTop: "1px solid var(--border)", paddingTop: 6, marginTop: 2,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {hasChildren && (
            <button onClick={() => setChildrenOpen(o => !o)} style={{
              background: "none", border: "none", cursor: "pointer",
              color: color, fontSize: 11, fontWeight: 700, padding: 0,
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <span style={{
                display: "inline-block", transition: "transform 0.15s",
                transform: childrenOpen ? "rotate(90deg)" : "none",
              }}>▶</span>
              {btn.children.length} block{btn.children.length !== 1 ? "s" : ""}
            </button>
          )}
        </div>

        <AddChildPopover
          small
          label="Nest inside this button"
          onAdd={t => { onAddToButton(blockId, btn.id, t); setChildrenOpen(true); }}
        />
      </div>

      {childrenOpen && hasChildren && (
        <NestedBlockList
          blocks={btn.children}
          depth={1}
          onUpdate={onUpdate}
          onRemove={onRemove}
          onMove={onMove}
          onAddToBlock={onAddToBlock}
          onAddToButton={onAddToButton}
          onAddToOption={onAddToOption}
          onAddToBullet={onAddToBullet}
        />
      )}
    </div>
  );
}