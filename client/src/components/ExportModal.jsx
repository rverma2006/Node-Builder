import { iconBtn, addRowBtn } from "../styles/tokens";
import { KIND_TO_DESCRIPTION, CONSTRAINT_TO_DESCRIPTION } from "../constants";

export default function ExportModal({ blocks, onClose, onClear, validationTypes, validationDefinitions, definitionTypes, units }) {

  // Look up a validation type ID by matching description to kind
  const getValidationTypeId = (kind) => {
    const desc = KIND_TO_DESCRIPTION[kind];
    const match = validationTypes.find(t =>
      t.description?.toLowerCase() === desc?.toLowerCase()
    );
    return match?.id ?? null;
  };

  // Look up a validation definition ID by constraint string
  const getValidationDefinitionId = (constraint) => {
    const desc = CONSTRAINT_TO_DESCRIPTION[constraint];
    const match = validationDefinitions.find(d =>
      d.description?.toLowerCase() === desc?.toLowerCase()
    );
    return match?.id ?? null;
  };

  // Look up a definition type ID by label (minimum / maximum / value)
  const getDefinitionTypeId = (label) => {
    const match = definitionTypes.find(d =>
      d.description?.toLowerCase() === label.toLowerCase()
    );
    return match?.id ?? null;
  };

  // Look up a unit ID by unit string (m, km, cm, inch, s, min, hour, day, month)
  const getUnitId = (unitStr) => {
    if (!unitStr || unitStr === "none") return null;
    const match = units.find(u => u.unit?.toLowerCase() === unitStr?.toLowerCase());
    return match?.id ?? null;
  };

  // Lookup an element ID string
  const getElementTypeId = (blockType) => {
    const typeLabel = TYPE_TO_ELEMENT_DESCRIPTION[blockType];
    const match = elementTypes.find(e =>
      e.type?.toLowerCase() === typeLabel?.toLowerCase()
    );
    return match?.id ?? null;
  };



  // Serialize a textbox field with DB IDs
  const serializeTextbox = (tb) => {
    const validationTypeId = getValidationTypeId(tb.kind);

    // Build constraint definition values if one is set
    let validationDefinition = null;
    if (tb.constraint && tb.constraint !== "none") {
      const definitionId = getValidationDefinitionId(tb.constraint);
      const isBetween = tb.constraint === "between" || tb.constraint === "notbetween";

      validationDefinition = {
        id: definitionId,
        values: isBetween
          ? [
              { definitionTypeId: getDefinitionTypeId("minimum"), value: tb.constraintA ?? null },
              { definitionTypeId: getDefinitionTypeId("maximum"), value: tb.constraintB ?? null },
            ]
          : [
              { definitionTypeId: getDefinitionTypeId("value"), value: tb.constraintA ?? null },
            ],
      };
    }

    return {
      id: tb.id,
      question: tb.question || null,
      placeholder: tb.placeholder || null,
      kind: tb.kind,
      validationTypeId,
      unit: getUnitId(tb.unit),
      layout: tb.layout,
      validationDefinition,
    };
  };

  function serializeBtn(btn) {
    return {
      id: btn.id,
      name: btn.name,
      comment: btn.comment || null,
      children: serializeBlocks(btn.children || []),
    };
  }

  function serializeBlocks(bs) {
    return bs.map(b => {
      const base = {
        id: b.id,
        type: b.type,
        title: b.title || null,
        layout: b.layout || null,
      };

      switch (b.type) {
        case "textbox":
          return {
            ...base,
            textboxRows: b.textboxRows,
            textboxCols: b.textboxCols,
            textboxes: (b.textboxes || []).map(serializeTextbox),
            children: serializeBlocks(b.children || []),
          };

        case "dropdown":
          return {
            ...base,
            // Dropdown options map to List type
            validationTypeId: getValidationTypeId("dropdown"),
            options: (b.options || []).map(opt => ({
              id: opt.id,
              label: opt.label,
              comment: opt.comment || null,
              children: serializeBlocks(opt.children || []),
            })),
            children: serializeBlocks(b.children || []),
          };

        case "radio":
        case "multiselect":
          return {
            ...base,
            grid: b.grid,
            buttons: (b.buttons || []).slice(0, b.grid.rows * b.grid.cols).map(serializeBtn),
          };

        case "table":
          return {
            ...base,
            table: {
              ...b.table,
              // Attach validation type IDs to each column
              columns: (b.table.columns || []).map(col => ({
                ...col,
                validationTypeId: getValidationTypeId(col.kind),
              })),
            },
            children: serializeBlocks(b.children || []),
          };

        case "bullets":
          return {
            ...base,
            bulletRows: b.bulletRows,
            bulletCols: b.bulletCols,
            bullets: (b.bullets || []).map(bullet => ({
              id: bullet.id,
              text: bullet.text,
              children: serializeBlocks(bullet.children || []),
            })),
            children: serializeBlocks(b.children || []),
          };

        case "header":
        case "richtext":
        case "breakline":
          return {
            ...base,
            content: b.content || null,
            children: serializeBlocks(b.children || []),
          };

        default:
          return base;
      }
    });
  }

  const json = JSON.stringify(serializeBlocks(blocks), null, 2);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 999, backdropFilter: "blur(2px)",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--card-bg)", borderRadius: 12, padding: 24,
        width: "min(640px, 92vw)", maxHeight: "80vh",
        display: "flex", flexDirection: "column", gap: 12,
        border: "1px solid var(--border)", boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 800, fontSize: 16, color: "var(--fg)" }}>Module JSON</span>
          <button onClick={onClose} style={iconBtn}>✕</button>
        </div>

        <pre style={{
          flex: 1, overflow: "auto", background: "var(--surface)", borderRadius: 8,
          padding: 14, fontSize: 12, color: "var(--fg)",
          fontFamily: "'Geist Mono', monospace",
          border: "1px solid var(--border)", lineHeight: 1.6,
        }}>
          {json}
        </pre>

        <div style={{ display: "flex", gap: 8, alignSelf: "flex-end" }}>
          <button onClick={onClear}
            style={{ ...addRowBtn, borderColor: "#dc2626", color: "#dc2626" }}>
            Clear canvas
          </button>
          <button onClick={() => navigator.clipboard?.writeText(json)} style={addRowBtn}>
            Copy to clipboard
          </button>
        </div>
      </div>
    </div>
  );
}