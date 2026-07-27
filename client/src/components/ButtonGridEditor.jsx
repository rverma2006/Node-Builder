import { makeButton } from "../utils/factories";
import NumberStepper from "./atoms/NumberStepper";
import ButtonCell from "./ButtonCell";
import LayoutToggle from "./atoms/LayoutToggle";


export default function ButtonGridEditor({
  block, onUpdate, onRemove, onMove, onAddToBlock, onAddToButton, onAddToOption, onAddToBullet,
}) {
  const { grid, buttons, type, id: blockId, layout = "top" } = block;
  const total = grid.rows * grid.cols;

  /**
   * Ensures the buttons array matches the grid size.
   * - Adds new default buttons if the grid grows.
   * - Removes excess buttons if the grid shrinks.
   */
  const syncButtons = (newGrid, old) => {
    const n = newGrid.rows * newGrid.cols;
    const updated = [...old];
    while (updated.length < n) updated.push(makeButton());
    return updated.slice(0, n);
  };

  const setRows = r => {
    const g = { ...grid, rows: r };
    onUpdate(blockId, { grid: g, buttons: syncButtons(g, buttons) });
  };

  const setCols = c => {
    const g = { ...grid, cols: c };
    onUpdate(blockId, { grid: g, buttons: syncButtons(g, buttons) });
  };

  const updateBtn = (idx, field, val) =>
    onUpdate(blockId, {
      buttons: buttons.map((b, i) => (i === idx ? { ...b, [field]: val } : b)),
    });

  const moveBtn = {
    width: 22, height: 22, borderRadius: 4, border: "1px solid var(--border)",
    background: "var(--card-bg)", color: "var(--fg-muted)", cursor: "pointer",
    fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center",
    padding: 0, lineHeight: 1,
  };


  return (
    <div>
      {/* Layout toggle */}
      <div style={{ marginBottom: 12 }}>
        <LayoutToggle value={layout} onChange={v => onUpdate(blockId, { layout: v })} />
      </div>
      {/* Grid size controls */}
      <div
        style={{
          display: "flex",
          gap: 24,
          marginBottom: 14,
          background: "var(--surface2)",
          borderRadius: 8,
          padding: "10px 14px",
          flexWrap: "wrap",
          border: "1px solid var(--border)",
        }}
      >
        <NumberStepper label="Rows" value={grid.rows} min={1} max={8} onChange={setRows} />
        <NumberStepper label="Cols" value={grid.cols} min={1} max={8} onChange={setCols} />
        <span
          style={{
            fontSize: 12,
            color: "var(--fg-muted)",
            alignSelf: "center",
          }}
        >
          = {total} button{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Button grid */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {buttons.slice(0, total).map((btn, idx) => (
          <div key={btn.id} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
            {/* Move up/down controls */}
            <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 2, flexShrink: 0 }}>
              <button
                onClick={() => {
                  if (idx === 0) return;
                  const b = [...buttons];
                  [b[idx - 1], b[idx]] = [b[idx], b[idx - 1]];
                  onUpdate(blockId, { buttons: b });
                }}
                disabled={idx === 0}
                style={{ ...moveBtn, opacity: idx === 0 ? 0.2 : 0.6 }}>↑</button>
              <button
                onClick={() => {
                  if (idx >= total - 1) return;
                  const b = [...buttons];
                  [b[idx], b[idx + 1]] = [b[idx + 1], b[idx]];
                  onUpdate(blockId, { buttons: b });
                }}
                disabled={idx >= total - 1}
                style={{ ...moveBtn, opacity: idx >= total - 1 ? 0.2 : 0.6 }}>↓</button>
            </div>
            <div style={{ flex: 1 }}>
              <ButtonCell
                btn={btn} idx={idx} type={type} blockId={blockId}
                onUpdateBtn={updateBtn}
                onUpdate={onUpdate} onRemove={onRemove} onMove={onMove}
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