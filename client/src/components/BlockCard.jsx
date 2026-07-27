import { useState } from "react";
import { TYPES, TYPE_COLORS } from "../constants";
import { iconBtn } from "../styles/tokens";
import SmallInput from "./atoms/SmallInput";
import AddChildPopover from "./AddChildPopover";
import ButtonGridEditor from "./ButtonGridEditor";
import TextboxColumnEditor from "./TextboxColumnEditor";
import NestedBlockList from "./NestedBlockList";
import DropdownEditor from "./DropdownEditor";
import TableEditor from "./TableEditor";
import HeaderEditor from "./HeaderEditor";
import RichTextEditor from "./RichTextEditor";
import BreakLineEditor from "./BreakLineEditor";
import BulletsEditor from "./BulletsEditor";

export default function BlockCard({
  block, index, total, depth = 0,
  onUpdate, onRemove, onMove, onAddToBlock, onAddToButton, onAddToOption, onAddToBullet,
  units = [], validationTypes = [], validationDefinitions = [],
}) {
  const [open, setOpen] = useState(false);
  const accentColor = TYPE_COLORS[block.type];
  const typeInfo = TYPES.find(t => t.value === block.type);
  const isButton = block.type === "radio" || block.type === "multiselect";
  const isDropdown = block.type === "dropdown";
  const isTable    = block.type === "table";
  const isHeader   = block.type === "header";
  const isRichText = block.type === "richtext";
  const isBreak    = block.type === "breakline";
  const isBullets  = block.type === "bullets";
  const allowsSectionChildren = !isButton;
  const sectionChildren = block.children || [];

  return (
    <div style={{
      background: "var(--card-bg)", borderRadius: 10,
      border: `1px solid ${open ? accentColor + "55" : "var(--border)"}`,
      overflow: "visible",
      boxShadow: depth === 0 ? "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)" : "none",
      transition: "border-color 0.15s",
    }}>
      {/* Header */}
      <div onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center",
        gap: 6, padding: open ? "8px 10px" : "6px 10px",
        background: open ? `${accentColor}08` : "transparent",
        cursor: "pointer", userSelect: "none", transition: "all 0.15s",
        borderRadius: open ? "10px 10px 0 0" : 10 }}>

        <span style={{ fontSize: 9, color: accentColor,
          transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s",
          flexShrink: 0, width: 12, display: "inline-block", textAlign: "center" }}>▶</span>

        <span style={{ fontSize: 12, width: 22, height: 22, borderRadius: 5,
          background: `${accentColor}15`, color: accentColor,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {typeInfo.icon}
        </span>

        <div style={{ flex: 1, minWidth: 0 }} onClick={e => e.stopPropagation()}>
          <SmallInput value={block.title} onChange={v => onUpdate(block.id, { title: v })}
            placeholder={`${typeInfo.label}${!open && isButton ? ` · ${block.grid.rows * block.grid.cols} buttons` : ""}`}
            style={{ background: "transparent", border: "none", boxShadow: "none",
              fontSize: 12, fontWeight: 600, padding: "1px 0" }} />
        </div>

        {!open && isButton && (
          <span style={{ fontSize: 10, color: "var(--fg-muted)", flexShrink: 0, whiteSpace: "nowrap" }}>
            {block.grid.rows}×{block.grid.cols}
          </span>
        )}

        <span style={{ fontSize: 10, background: `${accentColor}12`, color: accentColor,
          borderRadius: 20, padding: "1px 7px", fontWeight: 700, letterSpacing: "0.06em",
          flexShrink: 0, whiteSpace: "nowrap" }}>{typeInfo.label}</span>

        <div style={{ display: "flex", gap: 3 }} onClick={e => e.stopPropagation()}>
          {allowsSectionChildren && (
            <AddChildPopover onAdd={t => onAddToBlock(block.id, t)} label="Nest after this section" />
          )}
          <button onClick={() => onMove(block.id, -1)} disabled={index === 0}
            style={{ ...iconBtn, width: 24, height: 24, opacity: index === 0 ? 0.2 : 0.5 }}>↑</button>
          <button onClick={() => onMove(block.id, 1)} disabled={index === total - 1}
            style={{ ...iconBtn, width: 24, height: 24, opacity: index === total - 1 ? 0.2 : 0.5 }}>↓</button>
          <button onClick={() => onRemove(block.id)}
            style={{ ...iconBtn, width: 24, height: 24, color: "#dc2626", borderColor: "#dc262633" }}>✕</button>
        </div>
      </div>

      {/* Body */}
      {open && (
        <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${accentColor}22`,
          overflow: "visible", borderRadius: "0 0 10px 10px" }}>
          <div style={{ paddingTop: 14 }}>
            {isButton && (
              <ButtonGridEditor block={block} onUpdate={onUpdate} onRemove={onRemove}
                onMove={onMove} onAddToBlock={onAddToBlock} onAddToButton={onAddToButton}
                onAddToOption={onAddToOption} onAddToBullet={onAddToBullet} />
            )}
            {block.type === "textbox" && (
              <TextboxColumnEditor block={block} onUpdate={onUpdate}
                units={units}
                validationTypes={validationTypes}
                validationDefinitions={validationDefinitions} />
            )}
            {isDropdown && (
              <DropdownEditor block={block} onUpdate={onUpdate} onRemove={onRemove}
                onMove={onMove} onAddToBlock={onAddToBlock} onAddToOption={onAddToOption}
                onAddToBullet={onAddToBullet} />
            )}
            {isTable && (
              <TableEditor block={block} onUpdate={onUpdate}
                units={units}
                validationTypes={validationTypes} />
            )}
            {isHeader && <HeaderEditor block={block} onUpdate={onUpdate} />}
            {isRichText && <RichTextEditor block={block} onUpdate={onUpdate} />}
            {isBreak && <BreakLineEditor />}
            {isBullets && (
              <BulletsEditor block={block} onUpdate={onUpdate} onRemove={onRemove}
                onMove={onMove} onAddToBlock={onAddToBlock} onAddToButton={onAddToButton}
                onAddToOption={onAddToOption} onAddToBullet={onAddToBullet} />
            )}
          </div>

          {allowsSectionChildren && sectionChildren.length > 0 && (
            <NestedBlockList blocks={sectionChildren} depth={depth + 1}
              onUpdate={onUpdate} onRemove={onRemove} onMove={onMove}
              onAddToBlock={onAddToBlock} onAddToButton={onAddToButton}
              onAddToOption={onAddToOption} onAddToBullet={onAddToBullet}
              units={units} validationTypes={validationTypes}
              validationDefinitions={validationDefinitions} />
          )}
        </div>
      )}
    </div>
  );
}