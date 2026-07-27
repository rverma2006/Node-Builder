// Editor for a Dropdown block: a list of options plus an optional comment shown alongside it.

import { makeOption } from "../utils/factories";
import { iconBtn, addRowBtn } from "../styles/tokens";
import FieldLabel from "./atoms/FieldLabel";
import SmallInput from "./atoms/SmallInput";
import AddChildPopover from "./AddChildPopover";
import NestedBlockList from "./NestedBlockList";
import { useState } from "react";
import LayoutToggle from "./atoms/LayoutToggle";

// Small up/down arrow button for reordering
const moveBtn = {
  width: 22, height: 22, borderRadius: 4, border: "1px solid var(--border)",
  background: "var(--card-bg)", color: "var(--fg-muted)", cursor: "pointer",
  fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center",
  padding: 0, lineHeight: 1,
};

function OptionRow({
  opt, idx, canRemove, blockId,
  onUpdate, onRemoveOpt, onAddChild,
  onUpdateBlock, onRemoveBlock, onMoveBlock,
  onAddToBlock, onAddToButton, onAddToOption, onAddToBullet,
}) {
  const [childrenOpen, setChildrenOpen] = useState(false);
  const hasChildren = opt.children && opt.children.length > 0;

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--fg-muted)", width: 18, flexShrink: 0 }}>
          {idx + 1}.
        </span>
        <SmallInput value={opt.label} onChange={v => onUpdate({ label: v })}
          placeholder={`Option ${idx + 1}`} />
        <button onClick={onRemoveOpt} disabled={!canRemove}
          style={{ ...iconBtn, opacity: canRemove ? 0.7 : 0.3 }}>✕</button>
      </div>


      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        borderTop: "1px solid var(--border)", paddingTop: 6, marginTop: 2 }}>
        {hasChildren ? (
          <button onClick={() => setChildrenOpen(o => !o)} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--accent)", fontSize: 11, fontWeight: 700, padding: 0,
            display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ display: "inline-block", transition: "transform 0.15s",
              transform: childrenOpen ? "rotate(90deg)" : "none" }}>▶</span>
            {opt.children.length} block{opt.children.length !== 1 ? "s" : ""}
          </button>
        ) : <span />}
        <AddChildPopover small label="Nest inside this option"
          onAdd={t => { onAddChild(blockId, opt.id, t); setChildrenOpen(true); }} />
      </div>

      {childrenOpen && hasChildren && (
        <NestedBlockList blocks={opt.children} depth={1}
          onUpdate={onUpdateBlock} onRemove={onRemoveBlock} onMove={onMoveBlock}
          onAddToBlock={onAddToBlock} onAddToButton={onAddToButton}
          onAddToOption={onAddToOption} onAddToBullet={onAddToBullet} />
      )}
    </div>
  );
}

export default function DropdownEditor({ block, onUpdate, onRemove, onMove, onAddToBlock, onAddToButton, onAddToOption, onAddToBullet }) {
  const { options, id, layout = "inline" } = block;

  const add = () => onUpdate(id, { options: [...options, makeOption()] });

  const remove = oid => {
    if (options.length === 1) return;
    onUpdate(id, { options: options.filter(o => o.id !== oid) });
  };

  const update = (oid, patch) =>
    onUpdate(id, { options: options.map(o => o.id === oid ? { ...o, ...patch } : o) });

  // Swap an option with the one above or below it
  const move = (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= options.length) return;
    const next = [...options];
    [next[idx], next[target]] = [next[target], next[idx]];
    onUpdate(id, { options: next });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      <div style={{ marginBottom: 4 }}>
        <LayoutToggle value={layout} onChange={v => onUpdate(id, { layout: v })} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <FieldLabel>Options</FieldLabel>
        {options.map((opt, idx) => (
          <div key={opt.id} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>

            {/* Up / down arrows */}
            <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 6, flexShrink: 0 }}>
              <button onClick={() => move(idx, -1)} disabled={idx === 0}
                style={{ ...moveBtn, opacity: idx === 0 ? 0.2 : 0.6 }}>↑</button>
              <button onClick={() => move(idx, 1)} disabled={idx === options.length - 1}
                style={{ ...moveBtn, opacity: idx === options.length - 1 ? 0.2 : 0.6 }}>↓</button>
            </div>

            <div style={{ flex: 1 }}>
              <OptionRow
                opt={opt} idx={idx} canRemove={options.length > 1} blockId={id}
                onUpdate={(patch) => update(opt.id, patch)}
                onRemoveOpt={() => remove(opt.id)}
                onAddChild={onAddToOption}
                onUpdateBlock={onUpdate} onRemoveBlock={onRemove} onMoveBlock={onMove}
                onAddToBlock={onAddToBlock} onAddToButton={onAddToButton}
                onAddToOption={onAddToOption} onAddToBullet={onAddToBullet}
              />
            </div>
          </div>
        ))}
        <button onClick={add} style={addRowBtn}>+ Add Option</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <FieldLabel>Preview</FieldLabel>
        <select disabled style={{ background: "var(--card-bg)", border: "1px dashed var(--border-mid)",
          borderRadius: 6, color: "var(--fg-muted)", fontSize: 13,
          padding: "7px 10px", outline: "none", width: "100%", fontFamily: "inherit" }}>
          <option>Select an option…</option>
          {options.map(o => <option key={o.id}>{o.label || "(empty)"}</option>)}
        </select>
      </div>
    </div>
  );
}