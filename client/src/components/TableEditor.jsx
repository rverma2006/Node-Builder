import { useState } from "react";
import SmallInput from "./atoms/SmallInput";
import FieldLabel from "./atoms/FieldLabel";
import NumberStepper from "./atoms/NumberStepper";

const selectStyle = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: 6, color: "var(--fg)", fontSize: 12, padding: "5px 8px",
  fontFamily: "inherit", outline: "none", width: "100%",
};

const labelStyle = {
  fontSize: 10, color: "var(--fg-muted)", fontWeight: 700,
  textTransform: "uppercase", letterSpacing: "0.06em",
};

const COLUMN_KINDS = [
  { value: "text",     label: "Text"     },
  { value: "int",      label: "Integer"  },
  { value: "decimal",  label: "Decimal"  },
  { value: "date",     label: "Date"     },
  { value: "time",     label: "Time"     },
  { value: "dropdown", label: "Dropdown" },
];

function ColumnConstraintEditor({ col, colIdx, onUpdateColumn }) {
  const kind       = col.kind || "text";
  const constraint = col.constraint || "none";

  const numericConstraintOptions = [
    { value: "none",       label: "No constraint"            },
    { value: "between",    label: "Between"                  },
    { value: "notbetween", label: "Not between"              },
    { value: "eq",         label: "Equal to"                 },
    { value: "neq",        label: "Not equal to"             },
    { value: "gt",         label: "Greater than"             },
    { value: "gte",        label: "Greater than or equal to" },
    { value: "lt",         label: "Less than"                },
    { value: "lte",        label: "Less than or equal to"    },
  ];

  const dateConstraintOptions = [
    { value: "none",       label: "No constraint"         },
    { value: "between",    label: "Between two dates"     },
    { value: "notbetween", label: "Not between two dates" },
    { value: "eq",         label: "Equal to date"         },
    { value: "gt",         label: "After date"            },
    { value: "gte",        label: "On or after date"      },
    { value: "lt",         label: "Before date"           },
    { value: "lte",        label: "On or before date"     },
  ];

  const timeConstraintOptions = [
    { value: "none",       label: "No constraint"          },
    { value: "between",    label: "Between two times"      },
    { value: "notbetween", label: "Not between two times"  },
    { value: "gt",         label: "After time"             },
    { value: "gte",        label: "At or after time"       },
    { value: "lt",         label: "Before time"            },
    { value: "lte",        label: "At or before time"      },
  ];

  const isBetween = constraint === "between" || constraint === "notbetween";

  if (kind === "int" || kind === "decimal") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={labelStyle}>Constraint</span>
        <select value={constraint}
          onChange={e => onUpdateColumn(colIdx, { constraint: e.target.value, constraintA: "", constraintB: "" })}
          style={selectStyle}>
          {numericConstraintOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {constraint !== "none" && (
          isBetween ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={labelStyle}>Min</span>
                <SmallInput value={col.constraintA || ""}
                  onChange={v => onUpdateColumn(colIdx, { constraintA: v })}
                  placeholder="0" style={{ width: 70 }} />
              </div>
              <span style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 16 }}>and</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={labelStyle}>Max</span>
                <SmallInput value={col.constraintB || ""}
                  onChange={v => onUpdateColumn(colIdx, { constraintB: v })}
                  placeholder="100" style={{ width: 70 }} />
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={labelStyle}>Value</span>
              <SmallInput value={col.constraintA || ""}
                onChange={v => onUpdateColumn(colIdx, { constraintA: v })}
                placeholder="e.g. 18" style={{ width: 90 }} />
            </div>
          )
        )}
      </div>
    );
  }

  if (kind === "date") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={labelStyle}>Date Constraint</span>
        <select value={constraint}
          onChange={e => onUpdateColumn(colIdx, { constraint: e.target.value, constraintA: "", constraintB: "" })}
          style={selectStyle}>
          {dateConstraintOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {constraint !== "none" && (
          isBetween ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={labelStyle}>From</span>
                <input type="date" value={col.constraintA || ""}
                  onChange={e => onUpdateColumn(colIdx, { constraintA: e.target.value })}
                  style={{ ...selectStyle, width: "auto" }} />
              </div>
              <span style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 16 }}>and</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={labelStyle}>To</span>
                <input type="date" value={col.constraintB || ""}
                  onChange={e => onUpdateColumn(colIdx, { constraintB: e.target.value })}
                  style={{ ...selectStyle, width: "auto" }} />
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={labelStyle}>Date</span>
              <input type="date" value={col.constraintA || ""}
                onChange={e => onUpdateColumn(colIdx, { constraintA: e.target.value })}
                style={{ ...selectStyle, width: "auto" }} />
            </div>
          )
        )}
      </div>
    );
  }

  if (kind === "time") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={labelStyle}>Time Constraint</span>
        <select value={constraint}
          onChange={e => onUpdateColumn(colIdx, { constraint: e.target.value, constraintA: "", constraintB: "" })}
          style={selectStyle}>
          {timeConstraintOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {constraint !== "none" && (
          isBetween ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={labelStyle}>From</span>
                <input type="time" value={col.constraintA || ""}
                  onChange={e => onUpdateColumn(colIdx, { constraintA: e.target.value })}
                  style={{ ...selectStyle, width: "auto" }} />
              </div>
              <span style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 16 }}>and</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={labelStyle}>To</span>
                <input type="time" value={col.constraintB || ""}
                  onChange={e => onUpdateColumn(colIdx, { constraintB: e.target.value })}
                  style={{ ...selectStyle, width: "auto" }} />
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={labelStyle}>Time</span>
              <input type="time" value={col.constraintA || ""}
                onChange={e => onUpdateColumn(colIdx, { constraintA: e.target.value })}
                style={{ ...selectStyle, width: "auto" }} />
            </div>
          )
        )}
      </div>
    );
  }

  if (kind === "text") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={labelStyle}>Max characters (optional)</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="number" min={1} max={9999}
            value={col.maxLength || ""}
            onChange={e => onUpdateColumn(colIdx, { maxLength: parseInt(e.target.value) || null })}
            placeholder="e.g. 255"
            style={{ ...selectStyle, width: 100 }} />
          {col.maxLength > 0 && (
            <span style={{ fontSize: 11, color: "var(--fg-muted)", fontStyle: "italic" }}>
              Max {col.maxLength} chars
            </span>
          )}
        </div>
      </div>
    );
  }

  return null;
}

export default function TableEditor({ block, onUpdate }) {
  const { id, table } = block;
  const [expandedCol, setExpandedCol] = useState(null);

  const cols      = table?.cols      || 1;
  const rows      = table?.rows      || 1;
  const cells     = table?.cells     || [];
  const columns   = table?.columns   || [];
  const headerRow = table?.headerRow ?? true;
  const headerCol = table?.headerCol ?? false;

  const updateTable = patch =>
    onUpdate(id, { table: { ...table, ...patch } });

  const updateCell = (r, c, val) => {
    const next = cells.map(row => [...row]);
    if (!next[r]) next[r] = [];
    next[r][c] = val;
    updateTable({ cells: next });
  };

  const updateColumn = (colIdx, patch) => {
    const next = columns.map((col, i) =>
      i === colIdx ? { ...col, ...patch } : col
    );
    updateTable({ columns: next });
  };

  const moveCol = (c, dir) => {
    const target = c + dir;
    if (target < 0 || target >= cols) return;
    const newCells = cells.map(row => {
      const newRow = [...row];
      [newRow[c], newRow[target]] = [newRow[target], newRow[c]];
      return newRow;
    });
    const newColumns = [...columns];
    [newColumns[c], newColumns[target]] = [newColumns[target], newColumns[c]];
    updateTable({ cells: newCells, columns: newColumns });
  };

  const moveRow = (r, dir) => {
    const cellRowIdx       = headerRow ? r + 1 : r;
    const targetCellRowIdx = cellRowIdx + dir;
    if (targetCellRowIdx < (headerRow ? 1 : 0) || targetCellRowIdx >= cells.length) return;
    const newCells = [...cells.map(row => [...row])];
    [newCells[cellRowIdx], newCells[targetCellRowIdx]] = [newCells[targetCellRowIdx], newCells[cellRowIdx]];
    updateTable({ cells: newCells });
  };

  const setRows = r => {
    const newCells = Array.from({ length: r }, (_, ri) =>
      Array.from({ length: cols }, (_, ci) =>
        cells[ri]?.[ci] || ""
      )
    );
    updateTable({ rows: r, cells: newCells });
  };
    
  const setCols = c => {
    const newCells = cells.map(row =>
      Array.from({ length: c }, (_, ci) => row[ci] || "")
    );
    const newColumns = Array.from({ length: c }, (_, ci) =>
      columns[ci] || { kind: "text", options: [], constraint: "none", constraintA: "", constraintB: "", maxLength: null }
    );
    updateTable({ cols: c, cells: newCells, columns: newColumns });
  };

  const addDropdownOption = (colIdx, label) => {
    const col  = columns[colIdx] || {};
    const opts = [...(col.options || []), { label }];
    updateColumn(colIdx, { options: opts });
  };

  const removeDropdownOption = (colIdx, optIdx) => {
    const col  = columns[colIdx] || {};
    const opts = (col.options || []).filter((_, i) => i !== optIdx);
    updateColumn(colIdx, { options: opts });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Grid size controls */}
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap",
        background: "var(--surface2)", border: "1px solid var(--border)",
        borderRadius: 8, padding: "10px 14px" }}>
        <NumberStepper label="Rows" value={rows} min={1} max={32} onChange={setRows} />
        <NumberStepper label="Cols" value={cols} min={1} max={20} onChange={setCols} />
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <label style={{ display: "flex", gap: 5, alignItems: "center",
            fontSize: 12, color: "var(--fg-muted)", cursor: "pointer" }}>
            <input type="checkbox" checked={headerRow}
              onChange={e => updateTable({ headerRow: e.target.checked })} />
            Header row
          </label>
          <label style={{ display: "flex", gap: 5, alignItems: "center",
            fontSize: 12, color: "var(--fg-muted)", cursor: "pointer" }}>
            <input type="checkbox" checked={headerCol}
              onChange={e => updateTable({ headerCol: e.target.checked })} />
            Header col
          </label>
        </div>
      </div>

      {/* Column configuration */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--fg-muted)",
          textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Column Configuration
        </div>
        {Array.from({ length: cols }, (_, c) => {
          const col    = columns[c] || { kind: "text", options: [] };
          const isOpen = expandedCol === c;
          const header = headerRow ? (cells[0]?.[c] || `Col ${c + 1}`) : `Col ${c + 1}`;
          return (
            <div key={c} style={{ background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 8, overflow: "hidden" }}>
              {/* Column header bar */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
                background: isOpen ? "var(--surface2)" : "var(--surface)" }}>
                {/* Move buttons */}
                <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                  <button onClick={e => { e.stopPropagation(); moveCol(c, -1); }}
                    disabled={c === 0}
                    style={{ background: "none", border: "1px solid var(--border)",
                      borderRadius: 4, cursor: c === 0 ? "default" : "pointer",
                      color: c === 0 ? "var(--border)" : "var(--fg-muted)",
                      fontSize: 11, padding: "1px 5px", lineHeight: 1 }}>←</button>
                  <button onClick={e => { e.stopPropagation(); moveCol(c, 1); }}
                    disabled={c === cols - 1}
                    style={{ background: "none", border: "1px solid var(--border)",
                      borderRadius: 4, cursor: c === cols - 1 ? "default" : "pointer",
                      color: c === cols - 1 ? "var(--border)" : "var(--fg-muted)",
                      fontSize: 11, padding: "1px 5px", lineHeight: 1 }}>→</button>
                </div>
                <span onClick={() => setExpandedCol(isOpen ? null : c)}
                  style={{ fontSize: 12, fontWeight: 600, color: "var(--fg)", flex: 1, cursor: "pointer" }}>
                  {header}
                </span>
                <span onClick={() => setExpandedCol(isOpen ? null : c)}
                  style={{ fontSize: 10, background: "var(--accent-soft)", cursor: "pointer",
                    color: "var(--accent)", borderRadius: 20, padding: "1px 7px",
                    fontWeight: 700, textTransform: "uppercase" }}>
                  {col.kind || "text"}
                </span>
                {col.constraint && col.constraint !== "none" && (
                  <span style={{ fontSize: 10, background: "#f59e0b22", color: "#f59e0b",
                    borderRadius: 20, padding: "1px 7px", fontWeight: 700 }}>
                    {col.constraint}
                  </span>
                )}
                {col.maxLength > 0 && (
                  <span style={{ fontSize: 10, background: "#f59e0b22", color: "#f59e0b",
                    borderRadius: 20, padding: "1px 7px", fontWeight: 700 }}>
                    max {col.maxLength}
                  </span>
                )}
                <span onClick={() => setExpandedCol(isOpen ? null : c)}
                  style={{ fontSize: 12, color: "var(--fg-muted)", cursor: "pointer" }}>
                  {isOpen ? "▲" : "▼"}
                </span>
              </div>

              {/* Expanded column config */}
              {isOpen && (
                <div style={{ padding: "10px 12px", display: "flex",
                  flexDirection: "column", gap: 10,
                  borderTop: "1px solid var(--border)" }}>

                  {/* Header text */}
                  {headerRow && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={labelStyle}>Header text</span>
                      <SmallInput
                        value={cells[0]?.[c] || ""}
                        onChange={v => updateCell(0, c, v)}
                        placeholder={`Column ${c + 1} header`}
                      />
                    </div>
                  )}

                  {/* Kind selector */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={labelStyle}>Type</span>
                    <select
                      value={col.kind || "text"}
                      onChange={e => updateColumn(c, {
                        kind: e.target.value,
                        options: [],
                        constraint: "none",
                        constraintA: "",
                        constraintB: "",
                        maxLength: null,
                      })}
                      style={selectStyle}>
                      {COLUMN_KINDS.map(k => (
                        <option key={k.value} value={k.value}>{k.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Constraint editor */}
                  <ColumnConstraintEditor
                    col={col}
                    colIdx={c}
                    onUpdateColumn={updateColumn}
                  />

                  {/* Significant entries — whole number, decimal, date, time only */}
                  {(col.kind === "int" || col.kind === "float" ||
                    col.kind === "date" || col.kind === "time") && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={labelStyle}>Significant entries</span>
                      {(col.significantEntries || []).map((entry, ei) => {
                        const sigCompOpts = col.kind === "date"
                          ? [ { value: "between", label: "Between two dates" }, { value: "notbetween", label: "Not between" },
                              { value: "eq", label: "Equal to" }, { value: "gt", label: "After" }, { value: "gte", label: "On or after" },
                              { value: "lt", label: "Before" }, { value: "lte", label: "On or before" } ]
                          : col.kind === "time"
                          ? [ { value: "between", label: "Between two times" }, { value: "notbetween", label: "Not between" },
                              { value: "gt", label: "After" }, { value: "gte", label: "At or after" },
                              { value: "lt", label: "Before" }, { value: "lte", label: "At or before" } ]
                          : [ { value: "between", label: "Between" }, { value: "notbetween", label: "Not between" },
                              { value: "eq", label: "Equal to" }, { value: "neq", label: "Not equal to" },
                              { value: "gt", label: "Greater than" }, { value: "gte", label: "Greater than or equal to" },
                              { value: "lt", label: "Less than" }, { value: "lte", label: "Less than or equal to" } ];
                        const entryIsBetween = entry.comparator === "between" || entry.comparator === "notbetween";
                        const inputType = col.kind === "date" ? "date" : col.kind === "time" ? "time" : "text";
                        return (
                          <div key={ei} style={{ display: "flex", flexDirection: "column", gap: 4,
                            padding: 6, background: "var(--card-bg)", borderRadius: 6,
                            border: "1px solid var(--border)" }}>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <select value={entry.comparator || sigCompOpts[0]?.value}
                                onChange={e => {
                                  const next = (col.significantEntries || []).map((en, i) =>
                                    i === ei ? { ...en, comparator: e.target.value, valueA: "", valueB: "" } : en
                                  );
                                  updateColumn(c, { significantEntries: next });
                                }}
                                style={{ ...selectStyle, flex: 1 }}>
                                {sigCompOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                              <button
                                onClick={() => {
                                  const next = (col.significantEntries || []).filter((_, i) => i !== ei);
                                  updateColumn(c, { significantEntries: next });
                                }}
                                style={{ background: "none", border: "none", cursor: "pointer",
                                  color: "#dc2626", fontSize: 14, flexShrink: 0 }}>
                                ✕
                              </button>
                            </div>
                            {entryIsBetween ? (
                              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <input type={inputType} value={entry.valueA || ""}
                                  onChange={e => {
                                    const next = (col.significantEntries || []).map((en, i) =>
                                      i === ei ? { ...en, valueA: e.target.value } : en
                                    );
                                    updateColumn(c, { significantEntries: next });
                                  }}
                                  placeholder="Min / From" style={{ ...selectStyle, flex: 1 }} />
                                <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>and</span>
                                <input type={inputType} value={entry.valueB || ""}
                                  onChange={e => {
                                    const next = (col.significantEntries || []).map((en, i) =>
                                      i === ei ? { ...en, valueB: e.target.value } : en
                                    );
                                    updateColumn(c, { significantEntries: next });
                                  }}
                                  placeholder="Max / To" style={{ ...selectStyle, flex: 1 }} />
                              </div>
                            ) : (
                              <input type={inputType} value={entry.valueA || ""}
                                onChange={e => {
                                  const next = (col.significantEntries || []).map((en, i) =>
                                    i === ei ? { ...en, valueA: e.target.value } : en
                                  );
                                  updateColumn(c, { significantEntries: next });
                                }}
                                placeholder="Value" />
                            )}
                          </div>
                        );
                      })}
                      {(col.significantEntries || []).length === 0 && (
                        <button
                          onClick={() => {
                            const next = [{ comparator: col.kind === "int" || col.kind === "float" ? "eq" : "gt", valueA: "", valueB: "" }];
                            updateColumn(c, { significantEntries: next });
                          }}
                          style={{ background: "none", border: "1px solid var(--border)",
                            borderRadius: 6, cursor: "pointer", color: "var(--accent)",
                            fontSize: 11, fontWeight: 600, padding: "3px 10px",
                            alignSelf: "flex-start" }}>
                          + Add Significant Entry
                        </button>
                      )}
                    </div>
                  )}

                  {/* Dropdown options */}
                  {col.kind === "dropdown" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={labelStyle}>Options</span>
                      {(col.options || []).map((opt, oi) => (
                        <div key={oi} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <SmallInput
                            value={opt.label || ""}
                            onChange={v => {
                              const opts = (col.options || []).map((o, i) =>
                                i === oi ? { ...o, label: v } : o
                              );
                              updateColumn(c, { options: opts });
                            }}
                            placeholder={`Option ${oi + 1}`}
                          />
                          <button
                            onClick={() => removeDropdownOption(c, oi)}
                            style={{ background: "none", border: "none", cursor: "pointer",
                              color: "#dc2626", fontSize: 14, flexShrink: 0 }}>
                            ✕
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => addDropdownOption(c, "")}
                        style={{ background: "none", border: "1px solid var(--border)",
                          borderRadius: 6, cursor: "pointer", color: "var(--accent)",
                          fontSize: 11, fontWeight: 600, padding: "3px 10px",
                          alignSelf: "flex-start" }}>
                        + Add Option
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Table preview */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
          <tbody>
            {cells.map((row, r) => (
              <tr key={r}>
                {/* Row move buttons — skip header row */}
                {(r > 0 || !headerRow) ? (
                  <td style={{ border: "none", padding: "0 4px", background: "transparent",
                    width: 28, verticalAlign: "middle" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <button
                        onClick={() => moveRow(headerRow ? r - 1 : r, -1)}
                        disabled={headerRow ? r <= 1 : r === 0}
                        style={{ background: "none", border: "1px solid var(--border)",
                          borderRadius: 3, padding: "0 3px", lineHeight: 1.2, fontSize: 10,
                          cursor: (headerRow ? r <= 1 : r === 0) ? "default" : "pointer",
                          color: (headerRow ? r <= 1 : r === 0) ? "var(--border)" : "var(--fg-muted)" }}>
                        ▲
                      </button>
                      <button
                        onClick={() => moveRow(headerRow ? r - 1 : r, 1)}
                        disabled={r === cells.length - 1}
                        style={{ background: "none", border: "1px solid var(--border)",
                          borderRadius: 3, padding: "0 3px", lineHeight: 1.2, fontSize: 10,
                          cursor: r === cells.length - 1 ? "default" : "pointer",
                          color: r === cells.length - 1 ? "var(--border)" : "var(--fg-muted)" }}>
                        ▼
                      </button>
                    </div>
                  </td>
                ) : (
                  <td style={{ border: "none", width: 28 }} />
                )}
                {Array.from({ length: cols }, (_, c) => {
                  const isHeader = (headerRow && r === 0) || (headerCol && c === 0);
                  return (
                    <td key={c} style={{
                      border: "1px solid var(--border)",
                      padding: "4px 6px",
                      background: isHeader ? "var(--surface2)" : "var(--surface)",
                      minWidth: 80,
                    }}>
                      {isHeader ? (
                        <SmallInput
                          value={cells[r]?.[c] || ""}
                          onChange={v => updateCell(r, c, v)}
                          placeholder={r === 0 ? `Col ${c + 1}` : `Row ${r}`}
                        />
                      ) : (
                        <div style={{ height: 22, background: "var(--card-bg)",
                          borderRadius: 4, border: "1px dashed var(--border-mid)" }} />
                      )}
                    </td>
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