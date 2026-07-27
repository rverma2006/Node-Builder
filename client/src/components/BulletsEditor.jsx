import { useState } from "react";
import { makeBullet } from "../utils/factories";
import { iconBtn } from "../styles/tokens";
import SmallInput from "./atoms/SmallInput";
import NumberStepper from "./atoms/NumberStepper";
import AddChildPopover from "./AddChildPopover";
import NestedBlockList from "./NestedBlockList";
import LayoutToggle from "./atoms/LayoutToggle";

// Small up/down arrow button for reordering
const moveBtn = {
  width: 22, height: 22, borderRadius: 4, border: "1px solid var(--border)",
  background: "var(--card-bg)", color: "var(--fg-muted)", cursor: "pointer",
  fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center",
  padding: 0, lineHeight: 1,
};

function BulletRow({
  bullet, idx, blockId,
  onUpdate, onRemove,
  onUpdateBlock, onRemoveBlock, onMoveBlock,
  onAddToBlock, onAddToButton, onAddToOption, onAddToBullet,
}) {
  const [childrenOpen, setChildrenOpen] = useState(false);
  const hasChildren = bullet.children && bullet.children.length > 0;

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 8, padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 16, color: "var(--fg-muted)", flexShrink: 0,
          width: 16, textAlign: "center", lineHeight: 1 }}>•</span>
        <SmallInput value={bullet.text} onChange={v => onUpdate(idx, { text: v })}
          placeholder={`Bullet item ${idx + 1}…`} />
        <button onClick={() => onRemove(idx)} style={{ ...iconBtn, opacity: 0.6 }}>✕</button>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        borderTop: "1px solid var(--border)", paddingTop: 5, marginTop: 2 }}>
        {hasChildren ? (
          <button onClick={() => setChildrenOpen(o => !o)} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--accent)", fontSize: 11, fontWeight: 700, padding: 0,
            display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ display: "inline-block", transition: "transform 0.15s",
              transform: childrenOpen ? "rotate(90deg)" : "none" }}>▶</span>
            {bullet.children.length} block{bullet.children.length !== 1 ? "s" : ""}
          </button>
        ) : <span />}
        <AddChildPopover small label="Nest inside this bullet"
          onAdd={t => { onAddToBullet(blockId, bullet.id, t); setChildrenOpen(true); }} />
      </div>

      {childrenOpen && hasChildren && (
        <NestedBlockList blocks={bullet.children} depth={1}
          onUpdate={onUpdateBlock} onRemove={onRemoveBlock} onMove={onMoveBlock}
          onAddToBlock={onAddToBlock} onAddToButton={onAddToButton}
          onAddToOption={onAddToOption} onAddToBullet={onAddToBullet} />
      )}
    </div>
  );
}

export default function BulletsEditor({
  block, onUpdate, onRemove, onMove,
  onAddToBlock, onAddToButton, onAddToOption, onAddToBullet,
}) {
  const { id, bulletRows = 2, bulletCols = 1, bullets, layout = "inline" } = block;
  const total = bulletRows * bulletCols;

  const setRows = r => {
    const next = [...bullets];
    while (next.length < r * bulletCols) next.push(makeBullet());
    onUpdate(id, { bulletRows: r, bullets: next.slice(0, r * bulletCols) });
  };

  const setCols = c => {
    const next = [...bullets];
    while (next.length < bulletRows * c) next.push(makeBullet());
    onUpdate(id, { bulletCols: c, bullets: next.slice(0, bulletRows * c) });
  };

  const updateBullet = (idx, patch) =>
    onUpdate(id, { bullets: bullets.map((b, i) => i === idx ? { ...b, ...patch } : b) });

  const removeBullet = (idx) => {
    if (bullets.length <= 1) return;
    const next = bullets.filter((_, i) => i !== idx);
    onUpdate(id, { bullets: next, bulletRows: Math.max(1, Math.ceil(next.length / bulletCols)) });
  };

  // Swap a bullet with the one above or below it
  const moveBullet = (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= total) return;
    const next = [...bullets];
    [next[idx], next[target]] = [next[target], next[idx]];
    onUpdate(id, { bullets: next });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      <div style={{ marginBottom: 4 }}>
        <LayoutToggle value={layout} onChange={v => onUpdate(id, { layout: v })} />
      </div>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap",
        background: "var(--surface2)", border: "1px solid var(--border)",
        borderRadius: 8, padding: "10px 14px" }}>
        <NumberStepper label="Rows" value={bulletRows} min={1} max={32} onChange={setRows} />
        <NumberStepper label="Cols" value={bulletCols} min={1} max={32} onChange={setCols} />
        <span style={{ fontSize: 12, color: "var(--fg-muted)", alignSelf: "center" }}>
          = {total} item{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Bullet list with move controls */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {bullets.slice(0, total).map((bullet, idx) => (
          <div key={bullet.id} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>

            {/* Up / down arrows */}
            <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 6, flexShrink: 0 }}>
              <button onClick={() => moveBullet(idx, -1)} disabled={idx === 0}
                style={{ ...moveBtn, opacity: idx === 0 ? 0.2 : 0.6 }}>↑</button>
              <button onClick={() => moveBullet(idx, 1)} disabled={idx >= total - 1}
                style={{ ...moveBtn, opacity: idx >= total - 1 ? 0.2 : 0.6 }}>↓</button>
            </div>

            <div style={{ flex: 1 }}>
              <BulletRow
                bullet={bullet} idx={idx} blockId={id}
                onUpdate={updateBullet} onRemove={removeBullet}
                onUpdateBlock={onUpdate} onRemoveBlock={onRemove} onMoveBlock={onMove}
                onAddToBlock={onAddToBlock} onAddToButton={onAddToButton}
                onAddToOption={onAddToOption} onAddToBullet={onAddToBullet}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}