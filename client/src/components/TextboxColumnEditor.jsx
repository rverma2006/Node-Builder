import LayoutToggle from "./atoms/LayoutToggle";
import { makeTextbox } from "../utils/factories";
import FieldLabel from "./atoms/FieldLabel";
import SmallInput from "./atoms/SmallInput";
import NumberStepper from "./atoms/NumberStepper";
import { DESCRIPTION_TO_KIND, DESCRIPTION_TO_CONSTRAINT } from "../constants";

const moveBtn = {
  width: 22, height: 22, borderRadius: 4, border: "1px solid var(--border)",
  background: "var(--card-bg)", color: "var(--fg-muted)", cursor: "pointer",
  fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center",
  padding: 0, lineHeight: 1,
};

function resizeTextboxes(textboxes, total) {
  const out = [...textboxes];
  while (out.length < total) out.push(makeTextbox());
  return out.slice(0, total);
}

export default function TextboxColumnEditor({ block, onUpdate, units = [], validationTypes = [], validationDefinitions = [] }) {
  const { id, textboxRows = 1, textboxCols = 1, textboxes, layout = "inline" } = block;
  const total = textboxRows * textboxCols;

  const setRows = r => {
    const n = r * textboxCols;
    onUpdate(id, { textboxRows: r, textboxes: resizeTextboxes(textboxes, n) });
  };

  const setCols = c => {
    const n = textboxRows * c;
    onUpdate(id, { textboxCols: c, textboxes: resizeTextboxes(textboxes, n) });
  };

  const update = (idx, patch) =>
    onUpdate(id, { textboxes: textboxes.map((t, i) => i === idx ? { ...t, ...patch } : t) });

  const move = (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= total) return;
    const next = [...textboxes];
    [next[idx], next[target]] = [next[target], next[idx]];
    onUpdate(id, { textboxes: next });
  };

  // Exclude "List" — dropdowns are their own block type
  const textboxValidationTypes = validationTypes.filter(vt =>
    vt.description?.toLowerCase() !== "list"
  );

  const isNumericKind = (kind) => kind === "int" || kind === "float";

  const constraintHint = (constraint) => {
    switch (constraint) {
      case "eq":         return "Input must exactly equal this value";
      case "neq":        return "Input must not equal this value";
      case "gt":         return "Input must be greater than this value";
      case "gte":        return "Input must be this value or greater";
      case "lt":         return "Input must be less than this value";
      case "lte":        return "Input must be this value or less";
      case "between":    return "Input must be between the minimum and maximum values";
      case "notbetween": return "Input must be outside the minimum and maximum values";
      default:           return "";
    }
  };

  const selectStyle = {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 6, color: "var(--fg)", fontSize: 12, padding: "5px 8px",
    fontFamily: "inherit", outline: "none",
  };

  const labelStyle = {
    fontSize: 10, color: "var(--fg-muted)", fontWeight: 700,
    textTransform: "uppercase", letterSpacing: "0.06em",
  };

  const dateConstraintOptions = [
    { value: "none",       label: "No constraint"            },
    { value: "between",    label: "Between two dates"        },
    { value: "notbetween", label: "Not between two dates"    },
    { value: "eq",         label: "Equal to date"            },
    { value: "neq",        label: "Not equal to date"        },
    { value: "gt",         label: "After date"               },
    { value: "gte",        label: "On or after date"         },
    { value: "lt",         label: "Before date"              },
    { value: "lte",        label: "On or before date"        },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap",
        background: "var(--surface2)", border: "1px solid var(--border)",
        borderRadius: 8, padding: "10px 14px" }}>
        <NumberStepper label="Rows" value={textboxRows} min={1} max={2} onChange={setRows} />
        <NumberStepper label="Cols" value={textboxCols} min={1} max={32} onChange={setCols} />
        <LayoutToggle value={layout} onChange={v => onUpdate(id, { layout: v })} />
        <span style={{ fontSize: 12, color: "var(--fg-muted)", alignSelf: "center" }}>
          = {total} field{total !== 1 ? "s" : ""}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {textboxes.slice(0, total).map((tb, idx) => (
          <div key={tb.id} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>

            <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 6, flexShrink: 0 }}>
              <button onClick={() => move(idx, -1)} disabled={idx === 0}
                style={{ ...moveBtn, opacity: idx === 0 ? 0.2 : 0.6 }}>↑</button>
              <button onClick={() => move(idx, 1)} disabled={idx >= total - 1}
                style={{ ...moveBtn, opacity: idx >= total - 1 ? 0.2 : 0.6 }}>↓</button>
            </div>

            <div style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <FieldLabel>Field {idx + 1}</FieldLabel>
              </div>

              <SmallInput value={tb.question || ""} onChange={v => update(idx, { question: v })}
                placeholder="Question / label…" />

              <SmallInput value={tb.placeholder || ""} onChange={v => update(idx, { placeholder: v })}
                placeholder="Placeholder text (optional)…" />

              {/* Kind pills */}
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                {textboxValidationTypes.length > 0 ? (
                  textboxValidationTypes.map(vt => {
                    const kindKey = DESCRIPTION_TO_KIND[vt.description?.toLowerCase()];
                    if (!kindKey) return null;
                    const isActive = tb.kind === kindKey;
                    return (
                      <button key={vt.id}
                        onClick={() => update(idx, {
                          kind: kindKey, validationTypeId: vt.id,
                          constraint: "none", constraintA: "", constraintB: "", maxLength: null,
                        })}
                        style={{ padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600,
                          cursor: "pointer", border: "1px solid",
                          borderColor: isActive ? "var(--accent)" : "var(--border)",
                          background: isActive ? "var(--accent-soft)" : "transparent",
                          color: isActive ? "var(--accent)" : "var(--fg-muted)" }}>
                        {vt.description}
                      </button>
                    );
                  })
                ) : (
                  ["text", "int", "float", "date", "time"].map(k => (
                    <button key={k}
                      onClick={() => update(idx, {
                        kind: k,
                        constraint: "none", constraintA: "", constraintB: "", maxLength: null,
                      })}
                      style={{ padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600,
                        cursor: "pointer", border: "1px solid",
                        borderColor: tb.kind === k ? "var(--accent)" : "var(--border)",
                        background: tb.kind === k ? "var(--accent-soft)" : "transparent",
                        color: tb.kind === k ? "var(--accent)" : "var(--fg-muted)" }}>
                      {k}
                    </button>
                  ))
                )}
              </div>

              {/* ── Numeric constraint ── */}
              {isNumericKind(tb.kind) && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <FieldLabel>Constraint</FieldLabel>
                  <select value={tb.constraint || "none"}
                    onChange={e => update(idx, { constraint: e.target.value, constraintA: "", constraintB: "" })}
                    style={selectStyle}>
                    <option value="none">No constraint</option>
                    {validationDefinitions.length > 0 ? (
                      validationDefinitions.map(vd => {
                        const constraintKey = DESCRIPTION_TO_CONSTRAINT[vd.description?.toLowerCase()];
                        return constraintKey ? (
                          <option key={vd.id} value={constraintKey}>{vd.description}</option>
                        ) : null;
                      })
                    ) : (
                      [
                        { value: "eq",         label: "Equal to"                 },
                        { value: "neq",        label: "Not equal to"             },
                        { value: "gt",         label: "Greater than"             },
                        { value: "gte",        label: "Greater than or equal to" },
                        { value: "lt",         label: "Less than"                },
                        { value: "lte",        label: "Less than or equal to"    },
                        { value: "between",    label: "Between two values"       },
                        { value: "notbetween", label: "Not between two values"   },
                      ].map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))
                    )}
                  </select>
                  {tb.constraint && tb.constraint !== "none" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {(tb.constraint === "between" || tb.constraint === "notbetween") ? (
                        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <span style={labelStyle}>Minimum</span>
                            <SmallInput value={tb.constraintA || ""}
                              onChange={v => update(idx, { constraintA: v })}
                              placeholder="e.g. 0" style={{ width: 90 }} />
                          </div>
                          <span style={{ fontSize: 13, color: "var(--fg-muted)", paddingBottom: 6 }}>and</span>
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <span style={labelStyle}>Maximum</span>
                            <SmallInput value={tb.constraintB || ""}
                              onChange={v => update(idx, { constraintB: v })}
                              placeholder="e.g. 100" style={{ width: 90 }} />
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          <span style={labelStyle}>Value</span>
                          <SmallInput value={tb.constraintA || ""}
                            onChange={v => update(idx, { constraintA: v })}
                            placeholder="e.g. 18" style={{ width: 90 }} />
                        </div>
                      )}
                      <span style={{ fontSize: 11, color: "var(--fg-muted)", fontStyle: "italic" }}>
                        {constraintHint(tb.constraint)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* ── Date constraint ── */}
              {tb.kind === "date" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <FieldLabel>Date Constraint</FieldLabel>
                  <select value={tb.constraint || "none"}
                    onChange={e => update(idx, { constraint: e.target.value, constraintA: "", constraintB: "" })}
                    style={selectStyle}>
                    {dateConstraintOptions.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {tb.constraint && tb.constraint !== "none" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {(tb.constraint === "between" || tb.constraint === "notbetween") ? (
                        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <span style={labelStyle}>From date</span>
                            <input type="date" value={tb.constraintA || ""}
                              onChange={e => update(idx, { constraintA: e.target.value })}
                              style={{ ...selectStyle, padding: "4px 8px" }} />
                          </div>
                          <span style={{ fontSize: 13, color: "var(--fg-muted)", paddingBottom: 6 }}>and</span>
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <span style={labelStyle}>To date</span>
                            <input type="date" value={tb.constraintB || ""}
                              onChange={e => update(idx, { constraintB: e.target.value })}
                              style={{ ...selectStyle, padding: "4px 8px" }} />
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          <span style={labelStyle}>Date</span>
                          <input type="date" value={tb.constraintA || ""}
                            onChange={e => update(idx, { constraintA: e.target.value })}
                            style={{ ...selectStyle, padding: "4px 8px" }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Time constraint ── */}
              {tb.kind === "time" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <FieldLabel>Time Constraint</FieldLabel>
                  <select value={tb.constraint || "none"}
                    onChange={e => update(idx, { constraint: e.target.value, constraintA: "", constraintB: "" })}
                    style={selectStyle}>
                    <option value="none">No constraint</option>
                    <option value="between">Between two times</option>
                    <option value="notbetween">Not between two times</option>
                    <option value="gt">After time</option>
                    <option value="gte">At or after time</option>
                    <option value="lt">Before time</option>
                    <option value="lte">At or before time</option>
                  </select>
                  {tb.constraint && tb.constraint !== "none" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {(tb.constraint === "between" || tb.constraint === "notbetween") ? (
                        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <span style={labelStyle}>From time</span>
                            <input type="time" value={tb.constraintA || ""}
                              onChange={e => update(idx, { constraintA: e.target.value })}
                              style={{ ...selectStyle, padding: "4px 8px" }} />
                          </div>
                          <span style={{ fontSize: 13, color: "var(--fg-muted)", paddingBottom: 6 }}>and</span>
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <span style={labelStyle}>To time</span>
                            <input type="time" value={tb.constraintB || ""}
                              onChange={e => update(idx, { constraintB: e.target.value })}
                              style={{ ...selectStyle, padding: "4px 8px" }} />
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          <span style={labelStyle}>Time</span>
                          <input type="time" value={tb.constraintA || ""}
                            onChange={e => update(idx, { constraintA: e.target.value })}
                            style={{ ...selectStyle, padding: "4px 8px" }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Significant entries — whole number, decimal, date, time only */}
              {(tb.kind === "int" || tb.kind === "float" ||
                tb.kind === "date" || tb.kind === "time") && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <FieldLabel>Significant entries</FieldLabel>
                  {(tb.significantEntries || []).map((entry, ei) => {
                    const sigCompOpts = tb.kind === "date"
                      ? [ { value: "between", label: "Between two dates" }, { value: "notbetween", label: "Not between" },
                          { value: "eq", label: "Equal to" }, { value: "gt", label: "After" }, { value: "gte", label: "On or after" },
                          { value: "lt", label: "Before" }, { value: "lte", label: "On or before" } ]
                      : tb.kind === "time"
                      ? [ { value: "between", label: "Between two times" }, { value: "notbetween", label: "Not between" },
                          { value: "gt", label: "After" }, { value: "gte", label: "At or after" },
                          { value: "lt", label: "Before" }, { value: "lte", label: "At or before" } ]
                      : [ { value: "between", label: "Between" }, { value: "notbetween", label: "Not between" },
                          { value: "eq", label: "Equal to" }, { value: "neq", label: "Not equal to" },
                          { value: "gt", label: "Greater than" }, { value: "gte", label: "Greater than or equal to" },
                          { value: "lt", label: "Less than" }, { value: "lte", label: "Less than or equal to" } ];
                    const entryIsBetween = entry.comparator === "between" || entry.comparator === "notbetween";
                    const inputType = tb.kind === "date" ? "date" : tb.kind === "time" ? "time" : "text";
                    return (
                      <div key={ei} style={{ display: "flex", flexDirection: "column", gap: 4,
                        padding: 6, background: "var(--card-bg)", borderRadius: 6,
                        border: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <select value={entry.comparator || sigCompOpts[0]?.value}
                            onChange={e => {
                              const next = (tb.significantEntries || []).map((en, i) =>
                                i === ei ? { ...en, comparator: e.target.value, valueA: "", valueB: "" } : en
                              );
                              update(idx, { significantEntries: next });
                            }}
                            style={{ ...selectStyle, flex: 1 }}>
                            {sigCompOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          <button
                            onClick={() => {
                              const next = (tb.significantEntries || []).filter((_, i) => i !== ei);
                              update(idx, { significantEntries: next });
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
                                const next = (tb.significantEntries || []).map((en, i) =>
                                  i === ei ? { ...en, valueA: e.target.value } : en
                                );
                                update(idx, { significantEntries: next });
                              }}
                              placeholder="Min / From" style={{ ...selectStyle, flex: 1 }} />
                            <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>and</span>
                            <input type={inputType} value={entry.valueB || ""}
                              onChange={e => {
                                const next = (tb.significantEntries || []).map((en, i) =>
                                  i === ei ? { ...en, valueB: e.target.value } : en
                                );
                                update(idx, { significantEntries: next });
                              }}
                              placeholder="Max / To" style={{ ...selectStyle, flex: 1 }} />
                          </div>
                        ) : (
                          <input type={inputType} value={entry.valueA || ""}
                            onChange={e => {
                              const next = (tb.significantEntries || []).map((en, i) =>
                                i === ei ? { ...en, valueA: e.target.value } : en
                              );
                              update(idx, { significantEntries: next });
                            }}
                            placeholder="Value" />
                        )}
                      </div>
                    );
                  })}
                  {(tb.significantEntries || []).length === 0 && (
                    <button
                      onClick={() => {
                        const next = [{ comparator: tb.kind === "int" || tb.kind === "float" ? "eq" : "gt", valueA: "", valueB: "" }];
                        update(idx, { significantEntries: next });
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

              {/*  Text length  */}
              {tb.kind === "text" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <FieldLabel>Max characters (optional)</FieldLabel>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      value={tb.maxLength || ""}
                      onChange={e => {
                        const val = parseInt(e.target.value);
                        update(idx, { maxLength: isNaN(val) ? null : val });
                      }}
                      placeholder="e.g. 255"
                      style={{ ...selectStyle, width: 100 }}
                    />
                    {tb.maxLength > 0 && (
                      <span style={{ fontSize: 11, color: "var(--fg-muted)", fontStyle: "italic" }}>
                        Max {tb.maxLength} characters allowed
                      </span>
                    )}
                    {tb.maxLength > 0 && (
                      <button
                        onClick={() => update(idx, { maxLength: null })}
                        style={{ background: "none", border: "none", cursor: "pointer",
                          color: "var(--fg-muted)", fontSize: 12 }}>
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ── Unit ── */}
              {true && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <FieldLabel>Unit {units.length === 0 && "(loading…)"}</FieldLabel>
                  <select
                    value={tb.unitId != null ? String(tb.unitId) : "none"}
                    onChange={e => {
                      const raw = e.target.value;
                      if (raw === "none") {
                        update(idx, { unitId: null, unit: "none" });
                      } else {
                        const unitId = parseInt(raw);
                        const unitObj = units.find(u => u.id === unitId);
                        update(idx, { unitId, unit: unitObj?.unit || "none" });
                      }
                    }}
                    style={selectStyle}>
                    <option value="none">No unit</option>
                    {units.map(u => (
                      <option key={u.id} value={String(u.id)}>{u.unit}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Preview mock */}
              <div style={{ background: "var(--card-bg)", borderRadius: 6,
                border: "1px dashed var(--border-mid)", height: 32,
                display: "flex", alignItems: "center", paddingLeft: 8, gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--fg-muted)",
                  background: "var(--surface2)", borderRadius: 3, padding: "1px 4px",
                  textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {tb.kind}
                  {tb.maxLength ? ` · max ${tb.maxLength}` : ""}
                  {tb.unit && tb.unit !== "none" ? ` · ${tb.unit}` : ""}
                </span>
                <span style={{ fontSize: 12, color: "var(--fg-muted)", opacity: 0.5 }}>
                  {tb.placeholder || "User types here…"}
                </span>
              </div>

            </div>
          </div>
        ))}
      </div>
    </div>
  );
}