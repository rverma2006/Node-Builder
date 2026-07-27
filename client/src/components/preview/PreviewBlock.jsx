import { TYPES, TYPE_COLORS } from "../../constants";
import PreviewNestedBlocks from "./PreviewNestedBlocks";

const CONSTRAINT_LABELS = {
  eq: "equal to", neq: "not equal to",
  gt: ">", gte: "≥", lt: "<", lte: "≤",
};

const inputStyle = {
  background: "#fff",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  color: "#111",
  fontSize: 14,
  padding: "8px 12px",
  outline: "none",
  width: "100%",
  fontFamily: "inherit",
  boxSizing: "border-box",
  wordBreak: "break-word",
};

function QLabel({ children, required }) {
  if (!children) return null;
  return (
    <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a18", marginBottom: 6 }}>
      {children}
      {required && <span style={{ color: "#dc2626", marginLeft: 3 }}>*</span>}
    </div>
  );
}

export default function PreviewBlock({ block, state, dispatch, defaultOpen = false, indent = 0, units = [] }) {
  const accentColor = TYPE_COLORS[block.type] || "#2563eb";
  const isButton = block.type === "radio" || block.type === "multiselect";

  const radioSel    = state.radios?.[block.id];
  const multiSel    = state.multis?.[block.id] || {};
  const textVals    = state.texts || {};
  const dropdownVal = state.dropdowns?.[block.id] || "";

  const setRadio    = btnId => dispatch({ type: "radio",    blockId: block.id, btnId });
  const toggleMulti = btnId => dispatch({ type: "multi",    blockId: block.id, btnId });
  const setText     = (tbId, val) => dispatch({ type: "text", blockId: block.id, tbId, val });
  const setDropdown = val => dispatch({ type: "dropdown",  blockId: block.id, val });

  const layout   = block.layout || "inline";
  const isInline = layout === "inline";
  const title    = block.title || "";

  // ── Section Header ────────────────────────────────────────────────────────
  if (block.type === "header") {
    return (
      <div style={{ fontSize: 18, fontWeight: 800, color: "#111",
        letterSpacing: "-0.02em", lineHeight: 1.3, paddingBottom: 4,
        borderBottom: "2px solid #e5e7eb", marginBottom: 4 }}>
        {block.content || block.title || ""}
      </div>
    );
  }

  // ── Rich Text ─────────────────────────────────────────────────────────────
  if (block.type === "richtext") {
    return (
      <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
        {block.content || block.title || ""}
      </div>
    );
  }

  // ── Break Line ────────────────────────────────────────────────────────────
  if (block.type === "breakline") {
    return <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "4px 0" }} />;
  }

  // ── Radio / Multiselect ───────────────────────────────────────────────────
  if (isButton) {
    const total = (block.grid?.rows || 0) * (block.grid?.cols || 0);

    // Clicking selected radio unselects it; clicking again reselects
    const handleRadioClick = (btnId) => {
      radioSel === btnId ? setRadio(null) : setRadio(btnId);
    };

    return (
      <div style={{
        display: isInline ? "flex" : "block",
        alignItems: isInline ? "flex-start" : undefined,
        gap: isInline ? 24 : undefined,
      }}>
        {title && (
          <div style={{
            fontSize: 13, fontWeight: 600, color: "#1a1a18",
            flexShrink: isInline ? 0 : undefined,
            width: isInline ? 180 : undefined,
            marginBottom: isInline ? 0 : 8,
            paddingTop: isInline ? 2 : undefined,
          }}>
            {title}
          </div>
        )}
        <div style={{ flex: isInline ? 1 : undefined, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "grid",
            gridTemplateColumns: `repeat(${block.grid?.cols || 1}, auto)`,
            gap: "6px 20px", justifyContent: "start" }}>
            {block.buttons.slice(0, total).map(btn => {
              const sel = block.type === "radio"
                ? (radioSel === btn.id || !!multiSel[btn.id])
                : !!multiSel[btn.id];
              const btnChildren = btn.children || [];
              const handleClick = () => block.type === "radio"
                ? handleRadioClick(btn.id)
                : toggleMulti(btn.id);

              return (
                <div key={btn.id}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8,
                    cursor: "pointer", fontSize: 14, color: "#1a1a18", userSelect: "none" }}>
                    {/* Radio / checkbox indicator */}
                    <div onClick={handleClick} style={{
                      width: 16, height: 16, flexShrink: 0,
                      borderRadius: block.type === "radio" ? "50%" : 4,
                      border: `2px solid ${sel ? accentColor : "#9ca3af"}`,
                      background: sel ? accentColor : "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.1s",
                    }}>
                      {sel && block.type === "multiselect" && (
                        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                          <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.8"
                            strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                      {sel && block.type === "radio" && (
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />
                      )}
                    </div>
                    {/* Button name — was missing from your version */}
                    <span style={{ fontWeight: sel ? 600 : 400 }} onClick={handleClick}>
                      {btn.name || "(unnamed)"}
                    </span>
                  </label>

                  {/* Comment shown below when selected */}
                  {sel && btn.comment && (
                    <div style={{ marginLeft: 24, marginTop: 2, fontSize: 12,
                      color: "#6b7280", fontStyle: "italic" }}>
                      {btn.comment}
                    </div>
                  )}

                  {/* Nested blocks under this button */}
                  {sel && btnChildren.length > 0 && (
                    <div style={{ marginLeft: 24, marginTop: 8 }}>
                      <PreviewNestedBlocks blocks={btnChildren} units={units} state={state}
                        dispatch={dispatch} defaultOpen indent={indent + 1} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Textbox grid ──────────────────────────────────────────────────────────
  if (block.type === "textbox") {
    const cols = block.textboxCols || 1;
    const rows = block.textboxRows || 1;
    const textboxes = (block.textboxes || []).slice(0, rows * cols);

    return (
      <div>
        {title && (
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a18", marginBottom: 10 }}>
            {title}
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>
          {textboxes.map(tb => {
            const val = textVals[`${block.id}_${tb.id}`] || "";
            const tbLayout  = tb.layout || "inline";
            const tbInline  = tbLayout === "inline";
            const isHidden  = tb._active === false;

            const validateConstraint = (v) => {
              if (!tb.constraint || tb.constraint === "none") return true;
              const n = parseFloat(v), a = parseFloat(tb.constraintA), b = parseFloat(tb.constraintB);
              if (isNaN(n)) return true;
              switch (tb.constraint) {
                case "eq":         return n === a;
                case "neq":        return n !== a;
                case "gt":         return n > a;
                case "gte":        return n >= a;
                case "lt":         return n < a;
                case "lte":        return n <= a;
                case "between":    return n >= a && n <= b;
                case "notbetween": return n < a || n > b;
                default:           return true;
              }
            };
            const isValid = validateConstraint(val);

            return (
              <div key={tb.id} style={{
                display: "flex",
                flexDirection: tbInline ? "row" : "column",
                alignItems: tbInline ? "center" : undefined,
                gap: tbInline ? 8 : 4,
                opacity: isHidden ? 0.35 : 1,
                pointerEvents: isHidden ? "none" : undefined,
              }}>
                {/* Question label — left when inline, above when top.
                    No fixed width when multi-col so labels don't crowd inputs. */}
                {tb.question && (
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: "#1a1a18",
                    flexShrink: 0,
                    width: tbInline && cols === 1 ? 160 : undefined,
                    whiteSpace: "normal",
                    wordBreak: "break-word",
                    marginBottom: tbInline ? 0 : 2,
                    textDecoration: isHidden ? "line-through" : "none",
                  }}>
                    {tb.question}
                  </div>
                )}

                {/* Input grows to fill remaining space */}
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                  {tb.kind === "date" ? (
                    <input type="date" value={val}
                      onChange={e => setText(tb.id, e.target.value)} style={inputStyle} />
                  ) : tb.kind === "time" ? (
                    <input type="time" value={val}
                      onChange={e => setText(tb.id, e.target.value)} style={inputStyle} />
                  ) : (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input value={val}
                        onChange={e => {
                          const v = e.target.value;
                          if (tb.kind === "int"   && v !== "" && !/^-?\d*$/.test(v))       return;
                          if (tb.kind === "float" && v !== "" && !/^-?\d*\.?\d*$/.test(v)) return;
                          setText(tb.id, v);
                        }}
                        placeholder={tb.placeholder || (tb.kind === "int" ? "0" : tb.kind === "float" ? "0.0" : "")}
                        inputMode={tb.kind === "int" ? "numeric" : tb.kind === "float" ? "decimal" : "text"}
                        style={{ ...inputStyle, borderColor: !isValid ? "#dc2626" : "#d1d5db" }}
                      />
                      {(tb.unit && tb.unit !== "none" || tb.unitId > 0) && (
                        <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 600,
                          flexShrink: 0, whiteSpace: "nowrap" }}>
                          {tb.unit && tb.unit !== "none"
                            ? tb.unit
                            : units.find(u => u.id === tb.unitId)?.unit || ""}
                        </span>
                      )}
                    </div>
                  )}
                  {!isValid && val !== "" && (
                    <span style={{ fontSize: 11, color: "#dc2626" }}>
                      {tb.constraint === "between"
                        ? `Must be between ${tb.constraintA} and ${tb.constraintB}`
                        : tb.constraint === "notbetween"
                        ? `Must not be between ${tb.constraintA} and ${tb.constraintB}`
                        : `Must be ${CONSTRAINT_LABELS[tb.constraint]} ${tb.constraintA}`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Dropdown ──────────────────────────────────────────────────────────────
  if (block.type === "dropdown") {
    const selectedOpt = block.options.find(o => o.id === dropdownVal);
    const optChildren = selectedOpt?.children || [];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{
          display: isInline ? "flex" : "block",
          alignItems: isInline ? "center" : undefined,
          gap: isInline ? 24 : undefined,
        }}>
          {title && (
            <div style={{
              fontSize: 13, fontWeight: 600, color: "#1a1a18",
              flexShrink: isInline ? 0 : undefined,
              width: isInline ? 180 : undefined,
              marginBottom: isInline ? 0 : 6,
            }}>
              {title}
            </div>
          )}
          <select value={dropdownVal} onChange={e => setDropdown(e.target.value)}
            style={{ ...inputStyle, flex: isInline ? 1 : undefined,
              width: isInline ? undefined : "100%", cursor: "pointer", appearance: "auto" }}>
            <option value="">Select…</option>
            {block.options.map(o => (
              <option key={o.id} value={o.id}>{o.label || "(empty)"}</option>
            ))}
          </select>
        </div>
        {selectedOpt?.comment && (
          <div style={{ fontSize: 12, color: "#6b7280", fontStyle: "italic",
            paddingLeft: isInline ? 204 : 0 }}>
            {selectedOpt.comment}
          </div>
        )}
        {optChildren.length > 0 && (
          <div style={{ paddingLeft: isInline ? 204 : 0 }}>
            <PreviewNestedBlocks blocks={optChildren} units={units} state={state}
              dispatch={dispatch} defaultOpen indent={indent + 1} />
          </div>
        )}
      </div>
    );
  }

  // ── Table ─────────────────────────────────────────────────────────────────
  if (block.type === "table") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {title && <QLabel>{title}</QLabel>}
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13, tableLayout: "fixed" }}>
            <tbody>
              {block.table.cells.map((row, r) => (
                <tr key={r}>
                  {row.map((val, c) => {
                    const isHeader = (block.table.headerRow && r === 0) ||
                                     (block.table.headerCol && c === 0);
                    const Tag = isHeader ? "th" : "td";
                    if (isHeader) {
                      return (
                        <Tag key={c} style={{ border: "1px solid #e5e7eb", padding: "8px 12px",
                          textAlign: "left", background: "#f9fafb", fontWeight: 700, color: "#111" }}>
                          {val || "—"}
                        </Tag>
                      );
                    }
                    const colCfg = block.table.columns?.[c] || { kind: "text", options: [] };
                    const cellVal = (state.tableCells?.[block.id]?.[`${r}_${c}`]) ?? val;
                    const setCellVal = v => dispatch({ type: "tableCell", blockId: block.id, r, c, val: v });
                    const cellInputStyle = { width: "100%", border: "none", outline: "none",
                      background: "transparent", fontSize: 13, color: "#111",
                      padding: "7px 10px", fontFamily: "inherit",
                      wordBreak: "break-word", whiteSpace: "normal" };
                    return (
                      <Tag key={c} style={{ border: "1px solid #e5e7eb", padding: 0 }}>
                        {colCfg.kind === "dropdown" ? (
                          <select value={cellVal} onChange={e => setCellVal(e.target.value)}
                            style={{ ...cellInputStyle, cursor: "pointer" }}>
                            <option value="">—</option>
                            {colCfg.options.map(o => (
                              <option key={o.id} value={o.label}>{o.label || "(empty)"}</option>
                            ))}
                          </select>
                        ) : colCfg.kind === "date" ? (
                          <input type="date" value={cellVal}
                            onChange={e => setCellVal(e.target.value)} style={cellInputStyle} />
                        ) : (
                          <input value={cellVal}
                            onChange={e => {
                              const v = e.target.value;
                              if (colCfg.kind === "int"   && v !== "" && !/^-?\d*$/.test(v))       return;
                              if (colCfg.kind === "float" && v !== "" && !/^-?\d*\.?\d*$/.test(v)) return;
                              setCellVal(v);
                            }}
                            inputMode={colCfg.kind === "int" ? "numeric" : colCfg.kind === "float" ? "decimal" : "text"}
                            placeholder={colCfg.kind === "int" ? "0" : colCfg.kind === "float" ? "0.0" : ""}
                            style={cellInputStyle} />
                        )}
                      </Tag>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Bullet Points ─────────────────────────────────────────────────────────
  if (block.type === "bullets") {
    return (
      <div style={{
        display: isInline ? "flex" : "block",
        alignItems: isInline ? "flex-start" : undefined,
        gap: isInline ? 24 : undefined,
      }}>
        {title && (
          <div style={{
            fontSize: 13, fontWeight: 600, color: "#1a1a18",
            flexShrink: isInline ? 0 : undefined,
            width: isInline ? 180 : undefined,
            marginBottom: isInline ? 0 : 8,
          }}>
            {title}
          </div>
        )}
        <div style={{ flex: isInline ? 1 : undefined, display: "grid",
          gridTemplateColumns: `repeat(${block.bulletCols || 1}, 1fr)`, gap: 4 }}>
          {(block.bullets || []).map(bullet => (
            <div key={bullet.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ color: accentColor, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>•</span>
                <span style={{ fontSize: 14, color: "#1a1a18", lineHeight: 1.5 }}>
                  {bullet.text || ""}
                </span>
              </div>
              {bullet.children && bullet.children.length > 0 && (
                <div style={{ marginLeft: 16 }}>
                  <PreviewNestedBlocks blocks={bullet.children} units={units} state={state}
                    dispatch={dispatch} defaultOpen indent={indent + 1} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Fallback ───────────────────────────────────────────────────────────────
  return null;
}