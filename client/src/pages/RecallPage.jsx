import { useState, useEffect, useRef } from "react";
import { fetchRecallModules, fetchRecallModule, saveRecallChanges,
  patchRecallRelativePosition, patchRecallAttrRelativePosition,
  toggleRecallAttrStatus, toggleValidationEntryStatus,
  addValidationEntry, fetchValidationEntries,
  toggleRecallDefStatus, BASE } from "../api";
import { TYPES, TYPE_COLORS, DESCRIPTION_TO_CONSTRAINT } from "../constants";
import { makeBlock } from "../utils/factories";
import {
  treeMap, treeFilter, treeMoveInList,
  treeAddToBlock, treeAddToButton, treeAddToOption, treeAddToBullet,
} from "../utils/treeHelpers";
import BlockCard from "../components/BlockCard";
import Preview from "../components/preview/Preview";
import useLookups from "../hooks/useLookups";
import AddChildPopover from "../components/AddChildPopover";

const actionBtn = {
  padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
  cursor: "pointer", border: "1px solid var(--border)",
  background: "var(--card-bg)", color: "var(--fg-muted)",
};
const accentBtn = {
  ...actionBtn, color: "var(--accent)",
  border: "1px solid var(--accent)44", background: "var(--accent-soft)",
};

const ELEMENT_ID_TO_TYPE = {
  1: "textbox", 2: "header", 3: "richtext", 4: "radio",
  5: "multiselect", 6: "table", 7: "breakline", 8: "bullets",
};

const COLUMN_KINDS = [
  { value: "text",     label: "Text" },
  { value: "int",      label: "Integer" },
  { value: "decimal",  label: "Decimal" },
  { value: "date",     label: "Date" },
  { value: "time",     label: "Time" },
  { value: "dropdown", label: "Dropdown" },
];

function decodeSignificantEntries(rows) {
  const sorted = [...rows].sort((a, b) => a.id - b.id);
  const out = [];
  let i = 0;
  while (i < sorted.length) {
    const row = sorted[i];
    const comparator = DESCRIPTION_TO_CONSTRAINT[row.comparator_description?.toLowerCase()];
    const role = row.role_description?.toLowerCase();
    if (!comparator) { i++; continue; }

    if (role === "minimum") {
      const next = sorted[i + 1];
      const nextComparator = next ? DESCRIPTION_TO_CONSTRAINT[next.comparator_description?.toLowerCase()] : null;
      const nextRole = next?.role_description?.toLowerCase();
      if (next && nextComparator === comparator && nextRole === "maximum") {
        out.push({
          ids: [row.id, next.id], _isNew: false, _active: row.status !== 2,
          comparator, valueA: row.description, valueB: next.description,
        });
        i += 2;
        continue;
      }
    }
    out.push({
      ids: [row.id], _isNew: false, _active: row.status !== 2,
      comparator, valueA: row.description, valueB: "",
    });
    i += 1;
  }
  return out;
}

function reconstruct(definitions, attributes, validationEntries = [], significantEntries = []) {
  if (!definitions.length) return [];

  const entriesByAttr = {};
  for (const entry of validationEntries) {
    const key = entry.module_elements_attribute_uin;
    if (!entriesByAttr[key]) entriesByAttr[key] = [];
    entriesByAttr[key].push(entry);
  }

  const sigEntriesByAttr = {};
  for (const entry of significantEntries) {
    const key = entry.module_elements_attribute_uin;
    if (!sigEntriesByAttr[key]) sigEntriesByAttr[key] = [];
    sigEntriesByAttr[key].push(entry);
  }

  const attrsByDef = {};
  for (const attr of attributes) {
    const key = attr.ehr_module_elements_definition_uin;
    if (!attrsByDef[key]) attrsByDef[key] = [];
    attrsByDef[key].push(attr);
  }

  // defNestingPath[defUin] = attrib_nesting_id of that def's own attr rows
  const defNestingPath = {};
  for (const attr of attributes) {
    const defUin = attr.ehr_module_elements_definition_uin;
    if (!defNestingPath[defUin]) {
      defNestingPath[defUin] = attr.attrib_nesting_id;
    }
  }

  // tableRowDefUins = defs tagged group_id=1 that are NOT the table's own def
  // (the table def itself also has group_id=1, but row defs are self-referential
  // AND have group_id=1 AND are not top-level table container defs — identified
  // by having attrs with R[2+]C* naming, which only row defs have)
  const tableRowDefUins = new Set();
  for (const def of definitions) {
    if (def.group_id !== 1) continue;
    const defAttrs = attributes.filter(a => a.ehr_module_elements_definition_uin === def.uin);
    const isRowDef = defAttrs.some(a => a.attribute_name?.match(/^R[2-9]\d*C\d+$/) ||
                                          a.attribute_name?.match(/^R[1-9]\d+C\d+$/));
    if (isRowDef) tableRowDefUins.add(def.uin);
  }

  const sectionRoots = definitions
    .filter(d => d.nesting_id === d.uin && d.status !== 2 && !tableRowDefUins.has(d.uin))
    .sort((a, b) => a.relative_position - b.relative_position);
  const defsByNesting = {};
  for (const def of definitions) {
    if (!defsByNesting[def.nesting_id]) defsByNesting[def.nesting_id] = [];
    defsByNesting[def.nesting_id].push(def);
  }

  // childDefUins = defs whose attrs have a dotted nesting path
// childDefUins = defs whose attrs have a dotted nesting path (nested radio children)
  const childDefUins = new Set();
  for (const attr of attributes) {
    const parts = attr.attrib_nesting_id.split(".");
    if (parts.length > 1) {
      childDefUins.add(attr.ehr_module_elements_definition_uin);
    }
  }

  // Also exclude textbox field defs that nest under a textbox container
  // These have nesting_id = containerUin (not self-referential) and are textbox type
  for (const def of definitions) {
    if (def.nesting_id !== def.uin &&
        ELEMENT_ID_TO_TYPE[def.ehr_module_elements_id] === "textbox") {
      // Check if the parent is also a textbox (container)
      const parent = definitions.find(d => d.uin === def.nesting_id);
      if (parent && ELEMENT_ID_TO_TYPE[parent.ehr_module_elements_id] === "textbox") {
        childDefUins.add(def.uin);
      }
    }
  }

  const blocks = [];

  for (const root of sectionRoots) {
    const siblings = (defsByNesting[root.uin] || [])
      .filter(d => d.uin !== root.uin && !childDefUins.has(d.uin) && !tableRowDefUins.has(d.uin) && d.status !== 2)
      .sort((a, b) => a.relative_position - b.relative_position);

    const rootBlock = buildBlock(
      root, attrsByDef, definitions, entriesByAttr, defNestingPath, childDefUins, null, tableRowDefUins, sigEntriesByAttr
    );

    if (rootBlock) blocks.push(rootBlock);

    for (const sib of siblings) {
      const sibBlock = buildBlock(
        sib, attrsByDef, definitions, entriesByAttr, defNestingPath, childDefUins, null, tableRowDefUins, sigEntriesByAttr
      );
      if (sibBlock) blocks.push(sibBlock);
    }
  }

  return blocks;
}

function buildBlock(def, attrsByDef, allDefs, entriesByAttr = {}, defNestingPath = {}, childDefUins = new Set(), currentPath = null, tableRowDefUins = new Set(), sigEntriesByAttr = {}) {
  const type  = ELEMENT_ID_TO_TYPE[def.ehr_module_elements_id] || "textbox";
  const attrs = (attrsByDef[def.uin] || []).sort((a, b) => a.relative_position - b.relative_position);

  const base = {
    id:     `recalled_${def.uin}`,
    _uin:   def.uin,
    _isNew: false,
    type,
    title:  (type === "textbox" || type === "bullets") ? "" : (def.question || ""),
    layout: "inline",
    children: [],
  };

  if (type === "radio" || type === "multiselect") {
    // pathPrefix: for root blocks = def.uin, for nested blocks = the path that led here
    const pathPrefix = currentPath !== null ? currentPath : `${def.uin}`;

    const buttons = attrs.map(attr => {
      const btnPath = `${pathPrefix}.${attr.uin}`;

      const childDefs = allDefs.filter(d => {
        if (!childDefUins.has(d.uin)) return false;
        const path = defNestingPath[d.uin] || "";
        return path === btnPath;
      }).sort((a, b) => a.relative_position - b.relative_position);

      const children = childDefs.map(cd =>
        buildBlock(cd, attrsByDef, allDefs, entriesByAttr, defNestingPath, childDefUins, btnPath, tableRowDefUins, sigEntriesByAttr)
      ).filter(Boolean);

      return {
        id:      `recalled_btn_${attr.uin}`,
        _uin:    attr.uin,
        _isAttr: true,
        _isNew:  false,
        _active: attr.status !== 2,
        name:    attr.attribute_name || "",
        comment: "",
        children,
      };
    });

    return {
      ...base,
      grid:    { rows: def.row_count || 1, cols: def.column_count || 1 },
      buttons,
    };

  } else if (type === "textbox") {
    const fieldDefs = allDefs
      .filter(d =>
        d.nesting_id === def.uin &&
        d.uin !== def.uin &&
        ELEMENT_ID_TO_TYPE[d.ehr_module_elements_id] === "textbox"
      )
      .sort((a, b) => a.relative_position - b.relative_position);

    const buildTextboxField = (d) => {
      const fieldAttr  = (attrsByDef[d.uin] || [])[0];
      const storedKind = fieldAttr?.attribute_value || "text";

      const entries       = fieldAttr ? (entriesByAttr[fieldAttr.uin] || []) : [];
      const activeEntries = entries.filter(e => e.status !== 2);
      const hasEntries    = activeEntries.length > 0;

      let constraint  = "none";
      let constraintA = "";
      let constraintB = "";
      let maxLength   = null;

      if (storedKind === "text") {
        if (hasEntries) maxLength = parseInt(activeEntries[0]?.description) || null;
      } else if (hasEntries) {
        constraint  = activeEntries.length === 2 ? "between" : "eq";
        constraintA = activeEntries[0]?.description || "";
        constraintB = activeEntries[1]?.description || "";
      }

      const significantEntries = fieldAttr
        ? decodeSignificantEntries(sigEntriesByAttr[fieldAttr.uin] || [])
        : [];

      return {
        id:          `recalled_tb_${d.uin}`,
        _uin:        d.uin,
        _attrUin:    fieldAttr?.uin || null,
        _isNew:      false,
        _active:     d.status !== 2,
        question:    d.question || "",
        placeholder: "",
        kind:        storedKind,
        constraint, constraintA, constraintB, maxLength,
        significantEntries,
        layout:      String(d.question_type) === "1" ? "top" : "inline",
        unit:        "none",
        unitId:      fieldAttr?.unit || null,
      };
    };

    const textboxes = fieldDefs.length > 0
      ? fieldDefs.map(d => buildTextboxField(d))
      : [buildTextboxField(def)];
    return {
      ...base,
      title:       def.question || "",
      textboxRows: def.row_count    || 1,
      textboxCols: def.column_count || 1,
      layout:      String(def.question_type) === "1" ? "top" : "inline",
      textboxes,
    };

  } else if (type === "bullets") {
    const siblingDefs = allDefs
      .filter(d =>
        d.nesting_id === def.nesting_id &&
        d.uin !== def.uin &&
        ELEMENT_ID_TO_TYPE[d.ehr_module_elements_id] === "bullets" &&
        !childDefUins.has(d.uin)
      )
      .sort((a, b) => a.relative_position - b.relative_position);

    const bullets = [def, ...siblingDefs].map(d => ({
      id:       `recalled_bullet_${d.uin}`,
      _uin:     d.uin,
      _isNew:   false,
      _active:  d.status !== 2,
      text:     d.question || "",
      children: [],
    }));

    return {
      ...base,
      bulletRows: def.row_count    || 1,
      bulletCols: def.column_count || 1,
      bullets,
    };

  } else if (type === "header" || type === "richtext") {
    return { ...base, content: def.question || "" };

  } else if (type === "breakline") {
    return base;

  } else if (type === "table") {
    const sortedAttrs = attrs.sort((a, b) => a.relative_position - b.relative_position);

    // Header row attrs (R1C*) — belong directly to this table def
    const allR1Attrs = sortedAttrs
      .filter(a => a.attribute_name?.match(/^R1C\d+$/))
      .sort((a, b) => a.relative_position - b.relative_position);

    // Data row defs nest under THIS table's uin — scoped per table, not global
    const dataRowDefs = allDefs
      .filter(d => d.nesting_id === def.uin && tableRowDefUins.has(d.uin) && d.status !== 2)
      .sort((a, b) => a.relative_position - b.relative_position);

    // hasHeaderRow: any active R1C* has non-blank heading
    const hasHeaderRow = allR1Attrs
      .filter(a => a.status !== 2)
      .some(a => a.attribute_heading?.trim());

    // Build cells
    const cells = [];
    if (hasHeaderRow) {
      cells.push(allR1Attrs.map(a => a.attribute_heading || ""));
    }

    // Build tableRows from data row defs
    const tableRows = dataRowDefs.map((rowDef, ri) => {
      const rowDefAttrs = (attrsByDef[rowDef.uin] || [])
        .sort((a, b) => a.relative_position - b.relative_position);

      const c1Attr = rowDefAttrs.find(a => a.attribute_name?.match(/^R\d+C1$/));
      const rowNum = parseInt(c1Attr?.attribute_name?.match(/^R(\d+)/)?.[1] || (ri + 2));

      // Build row cells in column order matching allR1Attrs
      const rowCells = allR1Attrs.map(r1a => {
        const colNum = parseInt(r1a.attribute_name.match(/C(\d+)$/)?.[1]);
        const cellAttr = rowDefAttrs.find(a => {
          const m = a.attribute_name?.match(/^R\d+C(\d+)$/);
          return m && parseInt(m[1]) === colNum;
        });
        return cellAttr?.attribute_heading || "";
      });

      cells.push(rowCells);

      return {
        _rowIdx:           ri,
        _rowNum:           rowNum,
        _defUin:           rowDef.uin,
        _isNew:            false,
        _active:           rowDef.status !== 2,
        _attrUin:          c1Attr?.uin || null,
        _relativePosition: rowDef.relative_position,
        cells:             rowCells,
      };
    });

    const hasHeaderCol = !!(tableRows[0]?.cells?.[0]?.trim());

    // Build tableAttrs from R1C* header attrs
    const tableAttrs = allR1Attrs.map(a => {
      const entries       = (entriesByAttr[a.uin] || []);
      const activeEntries = entries.filter(e => e.status !== 2);
      const hasEntries    = activeEntries.length > 0;
      const allEntriesAreList = hasEntries && activeEntries.every(
        e => e.attribute_validation_type_details_id === 0 ||
             e.attribute_validation_type_details_id === null
      );
      const isDropdown = hasEntries && allEntriesAreList;
      const storedKind = a.attribute_value || "text";
      const kind       = isDropdown ? "dropdown" : storedKind;
      let constraint  = "none";
      let constraintA = "";
      let constraintB = "";
      if (!isDropdown && hasEntries) {
        constraint  = activeEntries.length === 2 ? "between" : "eq";
        constraintA = activeEntries[0]?.description || "";
        constraintB = activeEntries[1]?.description || "";
      }
      return {
        _uin:        a.uin,
        _isNew:      false,
        _active:     a.status !== 2,
        _kindLocked: true,
        _attrName:   a.attribute_name || "",
        heading:     a.attribute_heading || "",
        kind, constraint, constraintA, constraintB,
        maxLength:   null,
        _entryIds:   activeEntries.map(e => e.id),
        options:     (isDropdown ? activeEntries : []).map(e => ({
          id: e.id, description: e.description,
          _active: e.status !== 2, _isNew: false,
        })),
        significantEntries: decodeSignificantEntries(sigEntriesByAttr[a.uin] || []),
      };
    });

    return {
      ...base,
      _tableAttrs: tableAttrs,
      _tableRows:  tableRows,
      table: {
        rows:      tableRows.length,
        cols:      allR1Attrs.length,
        headerRow: hasHeaderRow,
        headerCol: hasHeaderCol,
        cells,
        columns:   Array.from({ length: allR1Attrs.length }, () => ({ kind: "text", options: [] })),
      },
    };
  }

  return null;
}

function collectUins(blocks) {
  const uins = [];
  for (const block of blocks) {
    if (block._uin && !block._isNew) uins.push({ uin: block._uin, isAttr: !!block._isAttr });
    if (block._tableAttrs) {
      for (const a of block._tableAttrs) {
        if (a._uin && !a._isNew && a._active) uins.push({ uin: a._uin, isAttr: true });
      }
    }
    if (block.buttons)   for (const b of block.buttons)   { if (b._uin && !b._isNew) uins.push({ uin: b._uin, isAttr: true }); uins.push(...collectUins(b.children || [])); }
    if (block.textboxes) for (const tb of block.textboxes) { if (tb._uin && !tb._isNew) uins.push({ uin: tb._uin, isAttr: false }); }
    if (block.bullets)   for (const b of block.bullets)    { if (b._uin && !b._isNew) uins.push({ uin: b._uin, isAttr: false }); }
    if (block.children)  uins.push(...collectUins(block.children));
  }
  return uins;
}

function setChildrenActive(blocks, active) {
  return blocks.map(block => ({
    ...block,
    _active:   active,
    buttons:   (block.buttons   || []).map(b => ({ ...b, _active: active, children: setChildrenActive(b.children || [], active) })),
    bullets:   (block.bullets   || []).map(b => ({ ...b, _active: active })),
    textboxes: (block.textboxes || []).map(t => ({ ...t, _active: active })),
    children:  setChildrenActive(block.children || [], active),
  }));
}

function isBlockNew(id, block) {
  if (block.id === id) return !!block._isNew;
  for (const btn of (block.buttons || [])) {
    const found = findInChildren(id, btn.children || []);
    if (found !== null) return found;
  }
  for (const child of (block.children || [])) {
    const r = isBlockNew(id, child);
    if (r !== null) return r;
  }
  return true;
}

function findInChildren(id, children) {
  for (const child of children) {
    if (child.id === id) return !!child._isNew;
    const nested = findInChildren(id, child.buttons?.flatMap(b => b.children || []) || []);
    if (nested !== null) return nested;
    const inChildren = findInChildren(id, child.children || []);
    if (inChildren !== null) return inChildren;
  }
  return null;
}

function findButtons(id, block) {
  if (block.id === id) return block.buttons;
  for (const btn of (block.buttons || [])) {
    for (const child of (btn.children || [])) {
      const found = findButtons(id, child);
      if (found !== null) return found;
    }
  }
  for (const child of (block.children || [])) {
    const found = findButtons(id, child);
    if (found !== null) return found;
  }
  return null;
}

function findTextboxes(id, block) {
  if (block.id === id) return block.textboxes;
  for (const btn of (block.buttons || [])) {
    for (const child of (btn.children || [])) {
      const found = findTextboxes(id, child);
      if (found !== null) return found;
    }
  }
  for (const child of (block.children || [])) {
    const found = findTextboxes(id, child);
    if (found !== null) return found;
  }
  return null;
}

function findBullets(id, block) {
  if (block.id === id) return block.bullets;
  for (const btn of (block.buttons || [])) {
    for (const child of (btn.children || [])) {
      const found = findBullets(id, child);
      if (found !== null) return found;
    }
  }
  for (const child of (block.children || [])) {
    const found = findBullets(id, child);
    if (found !== null) return found;
  }
  return null;
}

function collectNestedNewButtons(blocks, addedSubItems, nestingPath, sectionUin) {
  for (const block of blocks) {
    if (block._isNew) {
      addedSubItems.push({
        _type:        "nested_block",
        _nestingPath: nestingPath,
        _sectionUin:  sectionUin,
        type:         block.type,
        title:        block.title,
        content:      block.content,
        grid:         block.grid,
        buttons:      block.buttons,
        textboxes:    block.textboxes,
        textboxRows:  block.textboxRows,
        textboxCols:  block.textboxCols,
        bullets:      block.bullets,
        bulletRows:   block.bulletRows,
        bulletCols:   block.bulletCols,
        table:        block.table,
        options:      block.options,
        validationTypeId: block.validationTypeId,
      });
      continue;
    }

    if ((block.type === "radio" || block.type === "multiselect") && block._uin) {
      const newButtons = (block.buttons || []).filter(b => !b._uin || b._isNew);
      if (newButtons.length > 0) {
        addedSubItems.push({
          _parentUin:   block._uin,
          _nestingPath: nestingPath,
          _sectionUin:  sectionUin,
          _type:        "buttons",
          type:         block.type,
          grid:         block.grid,
          buttons:      newButtons,
        });
      }
      for (const btn of (block.buttons || [])) {
        if (btn._uin) {
          collectNestedNewButtons(
            btn.children || [], addedSubItems,
            `${nestingPath}.${btn._uin}`, sectionUin
          );
        }
      }
    }

    if (block.type === "bullets" && block._uin) {
      const newBullets = (block.bullets || []).filter(b => !b._uin || b._isNew);
      if (newBullets.length > 0) {
        addedSubItems.push({
          _parentUin:  block._uin,
          _sectionUin: sectionUin,
          _type:       "bullet_items",
          type:        "bullets",
          bullets:     newBullets,
          bulletCols:  block.bulletCols || 1,
        });
      }
    }
  }
}

// ── Table editor ──────────────────────────────────────────────────────────
function RecallColumnConstraintEditor({ attr, colIdx, onSave, onClose }) {
  const [constraint,  setConstraint]  = useState(attr.constraint  || "none");
  const [constraintA, setConstraintA] = useState(attr.constraintA || "");
  const [constraintB, setConstraintB] = useState(attr.constraintB || "");
  const [maxLength,   setMaxLength]   = useState(attr.maxLength   || null);
  const [sigEntries,  setSigEntries]  = useState(attr.significantEntries || []);
  const kind = attr.kind || "text";
  const isSigKind = kind === "int" || kind === "float" || kind === "date" || kind === "time";

  const inputStyle = {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 6, color: "var(--fg)", fontSize: 12,
    padding: "4px 8px", fontFamily: "inherit", outline: "none",
  };

  const numericOpts = [
    { value: "none", label: "No constraint" },
    { value: "between", label: "Between" }, { value: "notbetween", label: "Not between" },
    { value: "eq", label: "Equal to" }, { value: "neq", label: "Not equal to" },
    { value: "gt", label: "Greater than" }, { value: "gte", label: "≥" },
    { value: "lt", label: "Less than" }, { value: "lte", label: "≤" },
  ];
  const dateOpts = [
    { value: "none", label: "No constraint" },
    { value: "between", label: "Between two dates" }, { value: "notbetween", label: "Not between" },
    { value: "eq", label: "Equal to date" }, { value: "gt", label: "After" },
    { value: "gte", label: "On or after" }, { value: "lt", label: "Before" },
    { value: "lte", label: "On or before" },
  ];
  const timeOpts = [
    { value: "none", label: "No constraint" },
    { value: "between", label: "Between two times" }, { value: "notbetween", label: "Not between" },
    { value: "gt", label: "After" }, { value: "gte", label: "At or after" },
    { value: "lt", label: "Before" }, { value: "lte", label: "At or before" },
  ];

  const opts      = kind === "date" ? dateOpts : kind === "time" ? timeOpts : numericOpts;
  const sigOpts   = opts.filter(o => o.value !== "none");
  const isBetween = constraint === "between" || constraint === "notbetween";
  const inputType = kind === "date" ? "date" : kind === "time" ? "time" : "text";

  return (
    <div style={{ background: "var(--surface)", borderRadius: 8,
      border: "1px solid var(--accent)44", padding: 12,
      display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-muted)",
          textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Constraint — "{attr.heading}"
        </div>
        <button onClick={onClose}
          style={{ background: "none", border: "none", cursor: "pointer",
            color: "var(--fg-muted)", fontSize: 14 }}>✕</button>
      </div>

      {kind === "text" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 10, color: "var(--fg-muted)", fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Max characters (optional)
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="number" min={1} max={9999}
              value={maxLength || ""}
              onChange={e => setMaxLength(parseInt(e.target.value) || null)}
              placeholder="e.g. 255" style={{ ...inputStyle, width: 100 }} />
            {maxLength > 0 && (
              <span style={{ fontSize: 11, color: "var(--fg-muted)", fontStyle: "italic" }}>
                Max {maxLength} chars
              </span>
            )}
          </div>
        </div>
      ) : (
        <>
          <select value={constraint}
            onChange={e => { setConstraint(e.target.value); setConstraintA(""); setConstraintB(""); }}
            style={{ ...inputStyle, width: "100%" }}>
            {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {constraint !== "none" && (
            isBetween ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input type={inputType} value={constraintA}
                  onChange={e => setConstraintA(e.target.value)}
                  placeholder="Min / From" style={{ ...inputStyle, flex: 1 }} />
                <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>and</span>
                <input type={inputType} value={constraintB}
                  onChange={e => setConstraintB(e.target.value)}
                  placeholder="Max / To" style={{ ...inputStyle, flex: 1 }} />
              </div>
            ) : (
              <input type={inputType} value={constraintA}
                onChange={e => setConstraintA(e.target.value)}
                placeholder="Value" style={{ ...inputStyle }} />
            )
          )}
        </>
      )}

      {isSigKind && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6,
          borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 4 }}>
          <div style={{ fontSize: 10, color: "var(--fg-muted)", fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Significant entry
          </div>
          {sigEntries.length > 0 ? (
            (() => {
              const entry = sigEntries[0];
              const entryIsBetween = entry.comparator === "between" || entry.comparator === "notbetween";
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 4,
                  padding: 6, background: "var(--card-bg)", borderRadius: 6,
                  border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <select value={entry.comparator || sigOpts[0]?.value}
                      onChange={e => setSigEntries([{ ...entry, comparator: e.target.value, valueA: "", valueB: "" }])}
                      style={{ ...inputStyle, flex: 1 }}>
                      {sigOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <button onClick={() => setSigEntries([])}
                      style={{ background: "none", border: "none", cursor: "pointer",
                        color: "#dc2626", fontSize: 14 }}>✕</button>
                  </div>
                  {entryIsBetween ? (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input type={inputType} value={entry.valueA || ""}
                        onChange={e => setSigEntries([{ ...entry, valueA: e.target.value }])}
                        placeholder="Min / From" style={{ ...inputStyle, flex: 1 }} />
                      <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>and</span>
                      <input type={inputType} value={entry.valueB || ""}
                        onChange={e => setSigEntries([{ ...entry, valueB: e.target.value }])}
                        placeholder="Max / To" style={{ ...inputStyle, flex: 1 }} />
                    </div>
                  ) : (
                    <input type={inputType} value={entry.valueA || ""}
                      onChange={e => setSigEntries([{ ...entry, valueA: e.target.value }])}
                      placeholder="Value" style={{ ...inputStyle }} />
                  )}
                </div>
              );
            })()
          ) : (
            <button onClick={() => setSigEntries([{ comparator: sigOpts[0]?.value, valueA: "", valueB: "" }])}
              style={{ background: "none", border: "1px solid var(--border)",
                borderRadius: 6, cursor: "pointer", color: "var(--accent)",
                fontSize: 11, fontWeight: 600, padding: "3px 10px", alignSelf: "flex-start" }}>
              + Add Significant Entry
            </button>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onClose} style={{ ...accentBtn, fontSize: 11 }}>
          Cancel
        </button>
          <button
          onClick={() => onSave(colIdx, { constraint, constraintA, constraintB, maxLength, kind,
            significantEntries: sigEntries })}
          style={{ padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            cursor: "pointer", border: "none", background: "var(--accent)", color: "#fff" }}>
          Save Constraint
        </button>
      </div>
    </div>
  );
}

function RecallTableEditor({ block, editing, onToggleColumn, onAddColumn,
  onMoveColumn, onToggleValidationEntry, onAddValidationEntry, onUpdateNewCol,
  onAddRow, onToggleRow, onMoveRow, onUpdateRow }) {
  const [newColName,        setNewColName]        = useState("");
  const [newColKind,        setNewColKind]        = useState("text");
  const [newColOptions,     setNewColOptions]     = useState([]);
  const [newOptionText,     setNewOptionText]     = useState("");
  const [expandedCol,            setExpandedCol]            = useState(null);
  const [expandedConstraintCol,  setExpandedConstraintCol]  = useState(null);
  const [newColConstraint,  setNewColConstraint]  = useState("none");
  const [newColConstraintA, setNewColConstraintA] = useState("");
  const [newColConstraintB, setNewColConstraintB] = useState("");
  const [newColMaxLength,   setNewColMaxLength]   = useState(null);

  const resetNewCol = () => {
    setNewColName(""); setNewColKind("text"); setNewColOptions([]);
    setNewColConstraint("none"); setNewColConstraintA(""); setNewColConstraintB("");
    setNewColMaxLength(null);
  };

  const allAttrs = Array.isArray(block._tableAttrs) ? block._tableAttrs : [];

  const inputStyle = {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 6, color: "var(--fg)", fontSize: 12,
    padding: "4px 8px", fontFamily: "inherit", outline: "none",
  };

  // Reset expanded panels if they go out of bounds after a move
  if (expandedCol !== null && expandedCol >= allAttrs.length) {
    setExpandedCol(null);
  }
  if (expandedConstraintCol !== null && expandedConstraintCol >= allAttrs.length) {
    setExpandedConstraintCol(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
          {editing && (
            <thead>
              <tr>
                <th style={{ border: "none", width: 70 }} />
                {allAttrs.map((attr, idx) => (
                  <th key={`cb_${attr._uin ?? 'new'}_${idx}`} style={{
                    border: "1px solid var(--border)", padding: "4px 8px",
                    background: "var(--surface2)", textAlign: "center", minWidth: 80,
                  }}>
                    <input type="checkbox" checked={!!attr._active}
                      disabled={block.table?.headerCol && idx === 0}
                      onChange={() => !(block.table?.headerCol && idx === 0) && onToggleColumn(attr)}
                      style={{
                        cursor: (block.table?.headerCol && idx === 0) ? "default" : "pointer",
                        width: 14, height: 14, opacity: (block.table?.headerCol && idx === 0) ? 0.4 : 1
                      }} />
                  </th>
                ))}
              </tr>
              <tr>
                <th style={{ border: "none", width: 70 }} />
                {allAttrs.map((attr, idx) => (
                  <th key={`mv_${attr._uin ?? 'new'}_${idx}`} style={{
                    border: "1px solid var(--border)", padding: "2px 4px",
                    background: "var(--surface2)", textAlign: "center",
                  }}>
                    <div style={{ display: "flex", justifyContent: "center", gap: 2 }}>
                      <button onClick={() => onMoveColumn(idx, -1)}
                        disabled={idx === 0 || (block.table?.headerCol && idx === 1)}
                        style={{ background: "none", border: "none",
                          cursor: (idx === 0 || (block.table?.headerCol && idx === 1)) ? "default" : "pointer",
                          color: (idx === 0 || (block.table?.headerCol && idx === 1)) ? "var(--border)" : "var(--fg-muted)",
                          fontSize: 11, padding: "0 2px" }}>←</button>
                      <button onClick={() => onMoveColumn(idx, 1)}
                        disabled={idx === allAttrs.length - 1 || (block.table?.headerCol && idx === 0)}
                        style={{ background: "none", border: "none",
                          cursor: (idx === allAttrs.length - 1 || (block.table?.headerCol && idx === 0)) ? "default" : "pointer",
                          color: (idx === allAttrs.length - 1 || (block.table?.headerCol && idx === 0)) ? "var(--border)" : "var(--fg-muted)",
                          fontSize: 11, padding: "0 2px" }}>→</button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            <tr>
              <td style={{ border: "none", width: 70 }} />
              {allAttrs.map((attr, idx) => (
                <td key={`h_${attr._uin ?? 'new'}_${idx}`} style={{
                  border: "1px solid var(--border)", padding: "6px 10px",
                  background: "var(--surface)", fontWeight: 700,
                  color: attr._active ? "var(--fg)" : "var(--fg-muted)",
                  textDecoration: attr._active ? "none" : "line-through",
                  opacity: attr._active ? 1 : 0.4, minWidth: 80, verticalAlign: "top",
                }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span>{attr.heading || `Col ${idx + 1}`}</span>
                    <span style={{ fontSize: 9, fontWeight: 700,
                      color: attr.kind === "dropdown" ? "var(--accent)" : "var(--fg-muted)",
                      textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {attr.kind || "text"}{attr._kindLocked ? " 🔒" : ""}
                    </span>
                    {/* Constraint editor toggle for recalled non-dropdown, non-new columns */}
                    {editing && !attr._isNew && attr.kind !== "dropdown" && (
                      <button
                        onClick={() => setExpandedConstraintCol(
                          expandedConstraintCol === idx ? null : idx
                        )}
                        style={{ background: "none", border: "1px solid var(--border)",
                          borderRadius: 4, cursor: "pointer", fontSize: 10,
                          color: attr.constraint && attr.constraint !== "none"
                            ? "var(--accent)" : "var(--fg-muted)",
                          padding: "1px 4px", textAlign: "left" }}>
                        {attr.constraint && attr.constraint !== "none"
                          ? `✓ ${attr.constraint}` : "Set constraint"}
                      </button>
                    )}
                    {attr.kind === "dropdown" && editing && !attr._isNew && (
                      <button onClick={() => setExpandedCol(expandedCol === idx ? null : idx)}                        style={{ background: "none", border: "1px solid var(--border)",
                          borderRadius: 4, cursor: "pointer", fontSize: 10,
                          color: "var(--accent)", padding: "1px 4px", textAlign: "left" }}>
                        {expandedCol === idx ? "Hide options" : `Options (${attr.options?.length || 0})`}
                      </button>
                    )}
                    {attr._isNew && editing && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <select value={attr.kind || "text"}
                          onChange={e => onUpdateNewCol(idx, { kind: e.target.value, options: [] })}
                          style={{ ...inputStyle, fontSize: 10 }}>
                          {COLUMN_KINDS.map(k => (
                            <option key={k.value} value={k.value}>{k.label}</option>
                          ))}
                        </select>
                        {attr.kind === "dropdown" && (
                          <button onClick={() => setExpandedCol(expandedCol === idx ? null : idx)}
                            style={{ background: "none", border: "1px solid var(--border)",
                              borderRadius: 4, cursor: "pointer", fontSize: 10,
                              color: "var(--accent)", padding: "1px 4px" }}>
                            {expandedCol === idx ? "Hide options" : `Options (${attr.options?.length || 0})`}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </td>
              ))}
            </tr>
            {/* Data rows */}
            {(Array.isArray(block._tableRows) ? block._tableRows : []).map((row, ri) => (
              <tr key={`row_${ri}`} style={{ opacity: row && row._active !== false ? 1 : 0.4 }}>
                {allAttrs.map((attr, c) => (
                  <td key={`d_${attr._uin ?? 'new'}_${c}`} style={{
                    border: "1px solid var(--border)", padding: "4px 6px",
                    opacity: attr._active ? 1 : 0.3,
                    background: row._isNew ? "var(--accent-soft)" : "var(--surface)",
                    minWidth: 80,
                  }}>
                    {row._isNew && block.table?.headerCol && c === 0 ? (
                      <input
                        value={row.cells?.[c] || ""}
                        onChange={e => {
                          const newRows = (block._tableRows || []).map((r, rIdx) => {
                            if (rIdx !== ri) return r;
                            const newCells = [...(r.cells || [])];
                            newCells[c] = e.target.value;
                            return { ...r, cells: newCells };
                          });
                          onUpdateRow(ri, newRows);
                        }}
                        style={{ background: "transparent", border: "none",
                          borderBottom: "1px solid var(--border)", color: "var(--fg)",
                          fontSize: 12, fontFamily: "inherit", outline: "none",
                          padding: "2px 4px", width: "100%" }}
                        placeholder={`Row ${ri + 1}, Col ${c + 1}`}
                      />
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--fg)",
                        padding: "2px 4px", display: "block" }}>
                        {row.cells?.[c] || "—"}
                      </span>
                    )}
                  </td>
                ))}
                {/* Row controls */}
                {editing && (
                  <td style={{ border: "1px solid var(--border)", padding: "2px 4px",
                    background: "var(--surface2)", width: 70, verticalAlign: "middle" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {/* Visibility checkbox */}
                      <input
                        type="checkbox"
                        checked={row._active !== false}
                        onChange={() => onToggleRow(ri)}
                        title={row._active !== false ? "Hide row" : "Show row"}
                        style={{ cursor: "pointer", width: 13, height: 13, flexShrink: 0 }}
                      />
                      {/* Move buttons */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        <button
                          onClick={() => onMoveRow(ri, -1)}
                          disabled={ri === 0}
                          style={{ background: "none", border: "none", padding: 0,
                            cursor: ri === 0 ? "default" : "pointer", lineHeight: 1,
                            color: ri === 0 ? "var(--border)" : "var(--fg-muted)",
                            fontSize: 10 }}>▲</button>
                        <button
                          onClick={() => onMoveRow(ri, 1)}
                          disabled={ri === (block._tableRows || []).length - 1}
                          style={{ background: "none", border: "none", padding: 0,
                            cursor: ri === (block._tableRows || []).length - 1 ? "default" : "pointer",
                            lineHeight: 1,
                            color: ri === (block._tableRows || []).length - 1 ? "var(--border)" : "var(--fg-muted)",
                            fontSize: 10 }}>▼</button>
                      </div>
                    </div>
                  </td>
                )}
              </tr>
            ))}

            {/* Add row button row */}
            {editing && (
              <tr>
                <td style={{ border: "none", width: 70 }} />
                <td colSpan={allAttrs.length} style={{ border: "1px solid var(--border)",
                  padding: "4px 8px", background: "var(--surface2)", textAlign: "center" }}>
                  <button
                    onClick={onAddRow}                    style={{ background: "none", border: "none", cursor: "pointer",
                      color: "var(--accent)", fontSize: 12, fontWeight: 600, padding: 0 }}>
                    + Add Row
                  </button>
                </td>
                <td style={{ border: "1px solid var(--border)", background: "var(--surface2)", width: 60 }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Constraint editor panel for recalled columns */}
      {expandedConstraintCol !== null &&
       expandedConstraintCol < allAttrs.length &&
       allAttrs[expandedConstraintCol] &&
       !allAttrs[expandedConstraintCol]._isNew &&
       allAttrs[expandedConstraintCol].kind !== "dropdown" &&
       editing && (
        <RecallColumnConstraintEditor
          attr={allAttrs[expandedConstraintCol]}
          colIdx={expandedConstraintCol}
          onSave={(colIdx, data) => {
            onUpdateNewCol(colIdx, {
              constraint:          data.constraint,
              constraintA:         data.constraintA,
              constraintB:         data.constraintB,
              maxLength:           data.maxLength,
              significantEntries:  data.significantEntries,
            });
            setExpandedConstraintCol(null);
          }}
          onClose={() => setExpandedConstraintCol(null)}
        />
      )}

      {expandedCol !== null && allAttrs[expandedCol] && (
        <div style={{ background: "var(--surface)", borderRadius: 8,
          border: "1px solid var(--border)", padding: 12,
          display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-muted)",
            textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Options for "{allAttrs[expandedCol].heading || `Col ${expandedCol + 1}`}"
          </div>
          {(allAttrs[expandedCol].options || []).map((opt, oi) => (
            <div key={opt.id || oi} style={{ display: "flex", alignItems: "center", gap: 8,
              padding: "5px 8px", background: "var(--card-bg)", borderRadius: 6,
              border: "1px solid var(--border)", opacity: opt._active ? 1 : 0.5 }}>
              <input type="checkbox" checked={!!opt._active} disabled={!!opt._isNew}
                onChange={() => !opt._isNew && onToggleValidationEntry(expandedCol, opt)}
                style={{ cursor: opt._isNew ? "default" : "pointer", width: 13, height: 13 }} />
              {opt._isNew ? (
                <input value={opt.description}
                  onChange={e => {
                    const updatedAttrs = allAttrs.map((a, ai) => {
                      if (ai !== expandedCol) return a;
                      return { ...a, options: (a.options || []).map((o, oi2) =>
                        oi2 === oi ? { ...o, description: e.target.value } : o) };
                    });
                    onUpdateNewCol(expandedCol, { options: updatedAttrs[expandedCol].options });
                  }}
                  style={{ ...inputStyle, flex: 1 }} placeholder="Option text…" />
              ) : (
                <span style={{ fontSize: 12, color: "var(--fg)", flex: 1,
                  textDecoration: opt._active ? "none" : "line-through" }}>
                  {opt.description}
                </span>
              )}
            </div>
          ))}
          {editing && (
            <div style={{ display: "flex", gap: 8 }}>
              <input value={newOptionText} onChange={e => setNewOptionText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && newOptionText.trim()) {
                    onAddValidationEntry(expandedCol, newOptionText.trim());
                    setNewOptionText("");
                  }
                }}
                placeholder="New option…" style={{ ...inputStyle, flex: 1 }} />
              <button onClick={() => {
                if (!newOptionText.trim()) return;
                onAddValidationEntry(expandedCol, newOptionText.trim());
                setNewOptionText("");
              }} style={{ ...accentBtn, fontSize: 11 }}>Add</button>
            </div>
          )}
        </div>
      )}

      {editing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8,
          background: "var(--surface)", borderRadius: 8,
          border: "1px solid var(--border)", padding: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--fg-muted)",
            textTransform: "uppercase", letterSpacing: "0.06em" }}>
            New Column
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {block.table?.headerRow && (
              <input
                value={newColName}
                onChange={e => setNewColName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    onAddColumn(block.table?.headerRow ? newColName.trim() : "", newColKind,
                      newColKind === "dropdown" ? newColOptions : [],
                      { constraint: newColConstraint, constraintA: newColConstraintA,
                        constraintB: newColConstraintB, maxLength: newColMaxLength });
                    resetNewCol();
                  }
                }}
                placeholder="Column name…"
                style={{ ...inputStyle, flex: 1, minWidth: 120 }}
              />
            )}
            <select value={newColKind}
              onChange={e => {
                setNewColKind(e.target.value);
                setNewColOptions([]);
                setNewColConstraint("none");
                setNewColConstraintA("");
                setNewColConstraintB("");
                setNewColMaxLength(null);
              }}
              style={{ ...inputStyle }}>
              {COLUMN_KINDS.map(k => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
            <button
              onClick={() => {
                if (block.table?.headerRow && !newColName.trim()) return;
                onAddColumn(block.table?.headerRow ? newColName.trim() : "", newColKind,
                  newColKind === "dropdown" ? newColOptions : [],
                  { constraint: newColConstraint, constraintA: newColConstraintA,
                    constraintB: newColConstraintB, maxLength: newColMaxLength });
                resetNewCol();
              }}
              style={{ ...accentBtn, fontSize: 11 }}>
              Add Column
            </button>
          </div>

          {/* Numeric constraint */}
          {(newColKind === "int" || newColKind === "decimal") && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 10, color: "var(--fg-muted)", fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.06em" }}>Constraint</div>
              <select value={newColConstraint}
                onChange={e => { setNewColConstraint(e.target.value); setNewColConstraintA(""); setNewColConstraintB(""); }}
                style={{ ...inputStyle }}>
                <option value="none">No constraint</option>
                <option value="between">Between</option>
                <option value="notbetween">Not between</option>
                <option value="eq">Equal to</option>
                <option value="neq">Not equal to</option>
                <option value="gt">Greater than</option>
                <option value="gte">Greater than or equal to</option>
                <option value="lt">Less than</option>
                <option value="lte">Less than or equal to</option>
              </select>
              {newColConstraint !== "none" && (
                (newColConstraint === "between" || newColConstraint === "notbetween") ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input value={newColConstraintA}
                      onChange={e => setNewColConstraintA(e.target.value)}
                      placeholder="Min" style={{ ...inputStyle, width: 80 }} />
                    <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>and</span>
                    <input value={newColConstraintB}
                      onChange={e => setNewColConstraintB(e.target.value)}
                      placeholder="Max" style={{ ...inputStyle, width: 80 }} />
                  </div>
                ) : (
                  <input value={newColConstraintA}
                    onChange={e => setNewColConstraintA(e.target.value)}
                    placeholder="Value" style={{ ...inputStyle, width: 80 }} />
                )
              )}
            </div>
          )}

          {/* Date constraint */}
          {newColKind === "date" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 10, color: "var(--fg-muted)", fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.06em" }}>Date Constraint</div>
              <select value={newColConstraint}
                onChange={e => { setNewColConstraint(e.target.value); setNewColConstraintA(""); setNewColConstraintB(""); }}
                style={{ ...inputStyle }}>
                <option value="none">No constraint</option>
                <option value="between">Between two dates</option>
                <option value="notbetween">Not between two dates</option>
                <option value="eq">Equal to date</option>
                <option value="gt">After date</option>
                <option value="gte">On or after date</option>
                <option value="lt">Before date</option>
                <option value="lte">On or before date</option>
              </select>
              {newColConstraint !== "none" && (
                (newColConstraint === "between" || newColConstraint === "notbetween") ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <input type="date" value={newColConstraintA}
                      onChange={e => setNewColConstraintA(e.target.value)}
                      style={{ ...inputStyle }} />
                    <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>and</span>
                    <input type="date" value={newColConstraintB}
                      onChange={e => setNewColConstraintB(e.target.value)}
                      style={{ ...inputStyle }} />
                  </div>
                ) : (
                  <input type="date" value={newColConstraintA}
                    onChange={e => setNewColConstraintA(e.target.value)}
                    style={{ ...inputStyle }} />
                )
              )}
            </div>
          )}

          {/* Time constraint */}
          {newColKind === "time" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 10, color: "var(--fg-muted)", fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.06em" }}>Time Constraint</div>
              <select value={newColConstraint}
                onChange={e => { setNewColConstraint(e.target.value); setNewColConstraintA(""); setNewColConstraintB(""); }}
                style={{ ...inputStyle }}>
                <option value="none">No constraint</option>
                <option value="between">Between two times</option>
                <option value="notbetween">Not between two times</option>
                <option value="gt">After time</option>
                <option value="gte">At or after time</option>
                <option value="lt">Before time</option>
                <option value="lte">At or before time</option>
              </select>
              {newColConstraint !== "none" && (
                (newColConstraint === "between" || newColConstraint === "notbetween") ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="time" value={newColConstraintA}
                      onChange={e => setNewColConstraintA(e.target.value)}
                      style={{ ...inputStyle }} />
                    <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>and</span>
                    <input type="time" value={newColConstraintB}
                      onChange={e => setNewColConstraintB(e.target.value)}
                      style={{ ...inputStyle }} />
                  </div>
                ) : (
                  <input type="time" value={newColConstraintA}
                    onChange={e => setNewColConstraintA(e.target.value)}
                    style={{ ...inputStyle }} />
                )
              )}
            </div>
          )}

          {/* Text max length */}
          {newColKind === "text" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 10, color: "var(--fg-muted)", fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Max characters (optional)
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="number" min={1} max={9999}
                  value={newColMaxLength || ""}
                  onChange={e => setNewColMaxLength(parseInt(e.target.value) || null)}
                  placeholder="e.g. 255"
                  style={{ ...inputStyle, width: 100 }} />
                {newColMaxLength > 0 && (
                  <span style={{ fontSize: 11, color: "var(--fg-muted)", fontStyle: "italic" }}>
                    Max {newColMaxLength} chars
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Dropdown options */}
          {newColKind === "dropdown" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 10, color: "var(--fg-muted)" }}>Options for new dropdown column:</div>
              {newColOptions.map((opt, oi) => (
                <div key={oi} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input value={opt.description}
                    onChange={e => setNewColOptions(prev =>
                      prev.map((o, i) => i === oi ? { ...o, description: e.target.value } : o))}
                    style={{ ...inputStyle, flex: 1 }} placeholder={`Option ${oi + 1}`} />
                  <button onClick={() => setNewColOptions(prev => prev.filter((_, i) => i !== oi))}
                    style={{ background: "none", border: "none", cursor: "pointer",
                      color: "#dc2626", fontSize: 14 }}>✕</button>
                </div>
              ))}
              <button onClick={() => setNewColOptions(prev => [...prev, { description: "" }])}
                style={{ ...accentBtn, fontSize: 11, alignSelf: "flex-start" }}>
                + Add Option
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Recall Block Card ─────────────────────────────────────────────────────
function RecallBlockCard({ block, editing, index, total, depth, onUpdate, onRemove, onMove,
  onAddToBlock, onAddToButton, onAddToOption, onAddToBullet,
  units, validationTypes, validationDefinitions }) {

  const isNew = !!block._isNew;

  const handleAddColumn = (heading, kind, options, constraintData = {}) => {
    const updatedAttrs = [
      ...(block._tableAttrs || []),
      {
        _uin:        null,
        _isNew:      true,
        _active:     true,
        _kindLocked: false,
        heading,
        kind:        kind || "text",
        constraint:  constraintData.constraint  || "none",
        constraintA: constraintData.constraintA || "",
        constraintB: constraintData.constraintB || "",
        maxLength:   constraintData.maxLength   || null,
        options:     (options || []).map(o => ({
          description: o.description || "", _isNew: true, _active: true,
        })),
      },
    ];
    const activeAttrs = updatedAttrs.filter(a => a._active);
    const newCols     = activeAttrs.length;
    const newCells    = Array.from({ length: (block.table?.rows || 1) + 1 }, (_, r) =>
      activeAttrs.map(a => r === 0 ? (a.heading || "") : "")
    );
    onUpdate(block.id, {
      _tableAttrs: updatedAttrs,
      table: { ...block.table, cols: newCols, cells: newCells,
        columns: Array.from({ length: newCols }, () => ({ kind: "text", options: [] })) },
    });
  };

  const handleToggleColumn = (attr) => {
    if (attr._isNew) {
      const updatedAttrs = (block._tableAttrs || []).map(a =>
        a === attr ? { ...a, _active: !attr._active } : a
      );
      onUpdate(block.id, { _tableAttrs: updatedAttrs });
      return;
    }
    if (!attr._uin) return;
    const updatedAttrs = (block._tableAttrs || []).map(a =>
      a._uin === attr._uin ? { ...a, _active: !attr._active } : a
    );
    onUpdate(block.id, { _tableAttrs: updatedAttrs });
  };

  const handleMoveColumn = (idx, dir) => {
    const target   = idx + dir;
    const allAttrs = block._tableAttrs || [];
    if (target < 0 || target >= allAttrs.length) return;

    const buildCellIdx = (attrs, attrIdx) => {
      let count = 0;
      for (let i = 0; i < attrs.length; i++) {
        if (attrs[i]._active) {
          if (i === attrIdx) return count;
          count++;
        }
      }
      return -1;
    };

    const newAttrs = [...allAttrs];
    [newAttrs[idx], newAttrs[target]] = [newAttrs[target], newAttrs[idx]];
    const tempName       = newAttrs[idx]._attrName;
    newAttrs[idx]        = { ...newAttrs[idx],    _attrName: newAttrs[target]._attrName,
      _swapCount: (newAttrs[idx]._swapCount || 0) + 1 };
    newAttrs[target]     = { ...newAttrs[target], _attrName: tempName,
      _swapCount: (newAttrs[target]._swapCount || 0) + 1 };

    const cellIdxFrom = buildCellIdx(allAttrs, idx);
    const cellIdxTo   = buildCellIdx(allAttrs, target);
    const newCells    = (block.table?.cells || []).map(row => {
      const newRow = [...row];
      if (cellIdxFrom !== -1 && cellIdxTo !== -1) {
        [newRow[cellIdxFrom], newRow[cellIdxTo]] = [newRow[cellIdxTo], newRow[cellIdxFrom]];
      }
      return newRow;
    });

    onUpdate(block.id, { _tableAttrs: newAttrs, table: { ...block.table, cells: newCells } });
  };

  const handleToggleRow = (ri) => {
    const currentRows = block._tableRows || [];
    const row = currentRows[ri];
    if (!row) return;
    const newActive = row._active === false ? true : false;

    if (row._isNew) {
      const updated = currentRows.filter((_, i) => i !== ri);
      onUpdate(block.id, {
        _tableRows: updated,
        table: { ...block.table, rows: Math.max(1, (block.table?.rows || 1) - 1) },
      });
      return;
    }

    const updated = currentRows.map((r, i) =>
      i === ri ? { ...r, _active: newActive } : r
    );
    onUpdate(block.id, { _tableRows: updated });
  };

  const handleMoveRow = (ri, dir) => {
    const currentRows = block._tableRows || [];
    const target = ri + dir;
    if (target < 0 || target >= currentRows.length) return;
    const newRows = [...currentRows];
    [newRows[ri], newRows[target]] = [newRows[target], newRows[ri]];
    // Track swap: increment swapCount on both rows
    newRows[ri]     = { ...newRows[ri],     _swapCount: (newRows[ri]._swapCount     || 0) + 1 };
    newRows[target] = { ...newRows[target], _swapCount: (newRows[target]._swapCount || 0) + 1 };
    onUpdate(block.id, { _tableRows: newRows });
  };
  
  const handleAddRow = () => {
    const currentRows = block._tableRows || [];
    const newRow = {
      _rowIdx:    currentRows.length,
      _isNew:     true,
      _active:    true,
      _swapCount: 0,
      cells:      Array.from({ length: (block._tableAttrs || []).length }, () => ""),
    };
    onUpdate(block.id, {
      _tableRows: [...currentRows, newRow],
      table: { ...block.table, rows: (block.table?.rows || 1) + 1 },
    });
  };

  const handleUpdateRow = (ri, newRows) => {
    onUpdate(block.id, { _tableRows: newRows });
  };

  const handleToggleValidationEntry = (colIdx, opt) => {
    if (!opt.id) return;
    const updatedAttrs = (block._tableAttrs || []).map((a, ai) => {
      if (ai !== colIdx) return a;
      return { ...a, options: (a.options || []).map(o =>
        o.id === opt.id ? { ...o, _active: !opt._active } : o) };
    });
    onUpdate(block.id, { _tableAttrs: updatedAttrs });
  };

  const handleAddValidationEntry = (colIdx, description) => {
    const attr = (block._tableAttrs || [])[colIdx];
    if (!attr) return;
    const updatedAttrs = (block._tableAttrs || []).map((a, ai) => {
      if (ai !== colIdx) return a;
      return { ...a, options: [...(a.options || []), { description, _isNew: true, _active: true }] };
    });
    onUpdate(block.id, { _tableAttrs: updatedAttrs });
  };
  const handleUpdateNewCol = (colIdx, patch) => {
    const updatedAttrs = (block._tableAttrs || []).map((a, ai) =>
      ai === colIdx ? { ...a, ...patch } : a
    );
    onUpdate(block.id, { _tableAttrs: updatedAttrs });
  };

  const handleToggleButton = (btn) => {
    if (!btn._uin || btn._isNew) return;
    const updatedButtons = (block.buttons || []).map(b => {
      if (b._uin !== btn._uin) return b;
      return { ...b, _active: !btn._active, children: setChildrenActive(b.children || [], !btn._active) };
    });
    onUpdate(block.id, { buttons: updatedButtons });
  };

  const handleToggleBullet = (bullet) => {
    if (!bullet._uin || bullet._isNew) return;
    const updatedBullets = (block.bullets || []).map(b =>
      b._uin === bullet._uin ? { ...b, _active: !bullet._active } : b
    );
    onUpdate(block.id, { bullets: updatedBullets });
  };

  const handleMoveButton = (idx, dir) => {
    const buttons = block.buttons || [];
    const target  = idx + dir;
    if (target < 0 || target >= buttons.length) return;
    const newButtons = [...buttons];
    [newButtons[idx], newButtons[target]] = [newButtons[target], newButtons[idx]];
    onUpdate(block.id, { buttons: newButtons });
  };

  const handleMoveBullet = (idx, dir) => {
    const bullets = block.bullets || [];
    const target  = idx + dir;
    if (target < 0 || target >= bullets.length) return;
    const newBullets = [...bullets];
    [newBullets[idx], newBullets[target]] = [newBullets[target], newBullets[idx]];
    onUpdate(block.id, { bullets: newBullets });
  };

  const safeUpdate = (id, patch) => {
    const targetIsNew = isBlockNew(id, block);
    if (!targetIsNew) {
      const { title, content, ...rest } = patch;

      if (rest.table !== undefined || rest._tableAttrs !== undefined) {
        const safeTable    = rest.table ? { ...rest.table } : undefined;
        const newColCount  = safeTable?.cols || (safeTable?.cells?.[0]?.length || 0);
        const origColCount = block._tableAttrs?.length || 0;
        if (safeTable?.cells?.[0]) {
          safeTable.cells = safeTable.cells.map((row, r) => {
            if (r === 0) {
              return row.map((cell, c) => {
                const origAttr = block._tableAttrs?.[c];
                if (origAttr && origAttr._uin && !origAttr._isNew) return origAttr.heading;
                return cell;
              });
            }
            return row;
          });
        }
        const updatedAttrs = rest._tableAttrs
          || (safeTable
            ? Array.from({ length: newColCount }, (_, c) => {
                if (c < origColCount) return block._tableAttrs[c];
                return { _isNew: true, _active: true, _kindLocked: false,
                  heading: safeTable?.cells?.[0]?.[c] || "", kind: "text", options: [] };
              })
            : undefined);
        const updatePatch = { ...rest };
        if (safeTable)    updatePatch.table       = safeTable;
        if (updatedAttrs) updatePatch._tableAttrs = updatedAttrs;
        onUpdate(id, updatePatch);
        return;
      }

      if (rest.buttons) {
        const origButtons = findButtons(id, block);
        const safeBtns = rest.buttons.map(btn => {
          const orig = origButtons?.find(b => b.id === btn.id);
          if (orig && orig._uin && !orig._isNew) return { ...btn, name: orig.name };
          return btn;
        });
        const origOrder    = (origButtons || []).map(b => b.id);
        const newOrder     = safeBtns.map(b => b.id);
        const orderChanged = origOrder.some((oid, i) => oid !== newOrder[i]);
        if (orderChanged && id === block.id) {
          safeBtns.forEach((btn, i) => {
            const orig = origButtons?.find(b => b.id === btn.id);
            if (orig && orig._uin && !orig._isNew) {
              const origIdx = origOrder.indexOf(btn.id);
              if (origIdx !== i) {
                const displacedBtn = origButtons?.[i];
                if (displacedBtn?._uin && !displacedBtn._isNew) {
                  patchRecallAttrRelativePosition(btn._uin, i + 1);
                  patchRecallAttrRelativePosition(displacedBtn._uin, origIdx + 1);
                }
              }
            }
          });
        }
        onUpdate(id, { ...rest, buttons: safeBtns });
        return;
      }

      if (rest.textboxes) {
        const origTextboxes = findTextboxes(id, block);
        const safeTbs = rest.textboxes.map(tb => {
          const orig = origTextboxes?.find(t => t.id === tb.id);
          if (orig && orig._uin && !orig._isNew) return { ...tb, question: orig.question };
          return tb;
        });
        const origOrder    = (origTextboxes || []).map(t => t.id);
        const newOrder     = safeTbs.map(t => t.id);
        const orderChanged = origOrder.some((oid, i) => oid !== newOrder[i]);
        if (orderChanged && id === block.id) {
          safeTbs.forEach((tb, i) => {
            const orig = origTextboxes?.find(t => t.id === tb.id);
            if (orig && orig._uin && !orig._isNew) {
              const origIdx = origOrder.indexOf(tb.id);
              if (origIdx !== i) {
                const displacedTb = origTextboxes?.[i];
                if (displacedTb?._uin && !displacedTb._isNew) {
                  patchRecallRelativePosition(tb._uin, i + 1);
                  patchRecallRelativePosition(displacedTb._uin, origIdx + 1);
                }
              }
            }
          });
        }
        onUpdate(id, { ...rest, textboxes: safeTbs });
        return;
      }

      if (rest.bullets) {
        const origBullets = findBullets(id, block);
        const safeBullets = rest.bullets.map(b => {
          const orig = origBullets?.find(x => x.id === b.id);
          if (orig && orig._uin && !orig._isNew) return { ...b, text: orig.text };
          return b;
        });
        const origOrder    = (origBullets || []).map(b => b.id);
        const newOrder     = safeBullets.map(b => b.id);
        const orderChanged = origOrder.some((oid, i) => oid !== newOrder[i]);
        if (orderChanged && id === block.id) {
          safeBullets.forEach((b, i) => {
            const orig = origBullets?.find(x => x.id === b.id);
            if (orig && orig._uin && !orig._isNew) {
              const origIdx = origOrder.indexOf(b.id);
              if (origIdx !== i) {
                const displacedB = origBullets?.[i];
                if (displacedB?._uin && !displacedB._isNew) {
                  patchRecallRelativePosition(b._uin, i + 1);
                  patchRecallRelativePosition(displacedB._uin, origIdx + 1);
                }
              }
            }
          });
        }
        onUpdate(id, { ...rest, bullets: safeBullets });
        return;
      }

      // Prevent reducing rows/cols for recalled textbox blocks
      if (rest.textboxRows !== undefined || rest.textboxCols !== undefined) {
        const safeRest = { ...rest };
        if (rest.textboxRows !== undefined && rest.textboxRows < (block.textboxRows || 1)) {
          safeRest.textboxRows = block.textboxRows;
        }
        if (rest.textboxCols !== undefined && rest.textboxCols < (block.textboxCols || 1)) {
          safeRest.textboxCols = block.textboxCols;
        }
        // Also prevent removing textboxes when rows/cols decrease
        if (safeRest.textboxes && safeRest.textboxes.length < (block.textboxes || []).length) {
          safeRest.textboxes = block.textboxes;
        }
        onUpdate(id, safeRest);
        return;
      }

      if (rest.children) { onUpdate(id, rest); return; }
      if (Object.keys(rest).length > 0) onUpdate(id, rest);
      return;
    }
    onUpdate(id, patch);
  };

  const handleMove = (id, dir) => {
    onMove(id, dir);
  };

  // ── Radio / Multiselect custom renderer ───────────────────────────────
  if ((block.type === "radio" || block.type === "multiselect") && !isNew) {
    const color = block.type === "radio" ? "#2563eb" : "#7c3aed";

    const handleAddButton = () => {
      const newBtn = {
        id: `new_btn_${Date.now()}`, _uin: null, _isNew: true, _active: true,
        name: "", comment: "", children: [],
      };
      onUpdate(block.id, { buttons: [...(block.buttons || []), newBtn] });
    };

    const handleToggleNewButton = (btn) => {
      onUpdate(block.id, { buttons: (block.buttons || []).filter(b => b.id !== btn.id) });
    };

    const handleRenameNewButton = (btnId, name) => {
      onUpdate(block.id, { buttons: (block.buttons || []).map(b =>
        b.id === btnId ? { ...b, name } : b) });
    };

    return (
      <div style={{ position: "relative" }}>
        <div style={{ background: "var(--card-bg)", borderRadius: 10,
          border: `1px solid var(--border)`, overflow: "visible" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8,
            padding: "8px 12px", background: "var(--surface)",
            borderBottom: "1px solid var(--border)",
            borderRadius: "10px 10px 0 0" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--fg)", flex: 1 }}>
              {block.title || `(${block.type})`}
            </span>
            <span style={{ fontSize: 10, background: `${color}22`, color,
              borderRadius: 20, padding: "1px 7px", fontWeight: 700 }}>
              {block.type === "radio" ? "Radio" : "Multi-Select"}
            </span>
            {editing && (
              <>
                <button onClick={handleAddButton}
                  title="Add new option"
                  style={{ background: "none", border: `1px solid ${color}44`,
                    borderRadius: 6, cursor: "pointer", color,
                    fontSize: 16, lineHeight: 1, padding: "2px 8px", fontWeight: 700 }}>
                  +
                </button>
                <button
                  onClick={() => {
                    if (!confirm("Delete this block?")) return;
                    onRemove(block.id);
                  }}                  title="Delete this block"
                  style={{ background: "none", border: "1px solid #dc262633",
                    borderRadius: 6, cursor: "pointer", color: "#dc2626",
                    fontSize: 12, lineHeight: 1, padding: "2px 8px", fontWeight: 700 }}>
                  ✕
                </button>
              </>
            )}
          </div>

          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            {(block.buttons || []).map((btn, bi) => (
              <div key={btn.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 10px", borderRadius: 6,
                  background: "var(--surface)", border: "1px solid var(--border)",
                  opacity: btn._active !== false ? 1 : 0.4 }}>
                  {editing && (
                    <input type="checkbox" checked={btn._active !== false}
                      onChange={() => btn._isNew ? handleToggleNewButton(btn) : handleToggleButton(btn)}
                      style={{ cursor: "pointer", width: 14, height: 14, flexShrink: 0 }} />
                  )}
                  {editing && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 }}>
                      <button onClick={() => handleMoveButton(bi, -1)} disabled={bi === 0}
                        style={{ background: "none", border: "none", padding: 0,
                          cursor: bi === 0 ? "default" : "pointer", lineHeight: 1,
                          color: bi === 0 ? "var(--border)" : "var(--fg-muted)", fontSize: 10 }}>▲</button>
                      <button onClick={() => handleMoveButton(bi, 1)}
                        disabled={bi === (block.buttons || []).length - 1}
                        style={{ background: "none", border: "none", padding: 0,
                          cursor: bi === (block.buttons || []).length - 1 ? "default" : "pointer",
                          lineHeight: 1,
                          color: bi === (block.buttons || []).length - 1 ? "var(--border)" : "var(--fg-muted)",
                          fontSize: 10 }}>▼</button>
                    </div>
                  )}
                  <div style={{ width: 12, height: 12, flexShrink: 0,
                    borderRadius: block.type === "radio" ? "50%" : 3,
                    border: `2px solid ${color}`,
                    background: btn._active === false ? "#e5e7eb" : "transparent" }} />
                  {btn._isNew ? (
                    <input value={btn.name} onChange={e => handleRenameNewButton(btn.id, e.target.value)}
                      placeholder="Option name…" autoFocus
                      style={{ flex: 1, background: "transparent", border: "none",
                        borderBottom: `1px solid ${color}`, color: "var(--fg)",
                        fontSize: 13, fontFamily: "inherit", outline: "none", padding: "0 2px" }} />
                  ) : (
                    <span style={{ fontSize: 13, color: "var(--fg)", flex: 1,
                      textDecoration: btn._active !== false ? "none" : "line-through" }}>
                      {btn.name || `Option ${bi + 1}`}
                    </span>
                  )}
                  {btn._isNew && (
                    <span style={{ fontSize: 9, fontWeight: 800, color: "#059669",
                      background: "#d1fae5", borderRadius: 3, padding: "1px 4px", flexShrink: 0 }}>
                      NEW
                    </span>
                  )}
                </div>

                {/* Nested children + AddChildPopover */}
                {btn._active !== false && (
                  <div style={{ marginLeft: 28, display: "flex", flexDirection: "column", gap: 4,
                    borderLeft: `2px solid ${color}22`, paddingLeft: 8, position: "relative", zIndex: 10 }}>
                    {(btn.children || []).map((child, ci) => (
                      <RecallBlockCard
                        key={child.id}
                        block={child}
                        index={ci}
                        total={(btn.children || []).length}
                        depth={(depth || 0) + 1}
                        editing={editing}
                        onUpdate={(id, patch) => {
                          const updatedButtons = (block.buttons || []).map(b => {
                            if (b.id !== btn.id) return b;
                            return { ...b, children: (b.children || []).map(c =>
                              c.id === id ? { ...c, ...patch } : c) };
                          });
                          onUpdate(block.id, { buttons: updatedButtons });
                        }}
                        onRemove={(id) => {
                          const updatedButtons = (block.buttons || []).map(b => {
                            if (b.id !== btn.id) return b;
                            return { ...b, children: (b.children || []).filter(c => c.id !== id) };
                          });
                          onUpdate(block.id, { buttons: updatedButtons });
                        }}
                        onMove={() => {}}
                        onAddToBlock={onAddToBlock}
                        onAddToButton={onAddToButton}
                        onAddToOption={onAddToOption}
                        onAddToBullet={onAddToBullet}
                        units={units}
                        validationTypes={validationTypes}
                        validationDefinitions={validationDefinitions}
                      />
                    ))}
                    {editing && (
                      <div style={{ position: "relative", zIndex: 100,
                        display: "flex", alignItems: "center", gap: 6, padding: "4px 0" }}>
                        <span style={{ fontSize: 10, color: "var(--fg-muted)", fontStyle: "italic" }}>
                          nest inside "{btn.name || `option ${bi + 1}`}":
                        </span>
                        <AddChildPopover
                          small
                          label={`Add block inside "${btn.name || `option ${bi + 1}`}"`}
                          onAdd={type => {
                            const newBlock = { ...makeBlock(type), _isNew: true };
                            const updatedButtons = (block.buttons || []).map(b => {
                              if (b.id !== btn.id) return b;
                              return { ...b, children: [...(b.children || []), newBlock] };
                            });
                            onUpdate(block.id, { buttons: updatedButtons });
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {(block.buttons || []).length === 0 && (
              <div style={{ fontSize: 12, color: "var(--fg-muted)", textAlign: "center",
                padding: "10px 0", opacity: 0.6 }}>
                No options — click + to add
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Bullets custom renderer ───────────────────────────────────────────
  if (block.type === "bullets" && !isNew) {
    const handleAddBullet = () => {
      const newBullet = {
        id: `new_bullet_${Date.now()}`, _uin: null, _isNew: true, _active: true,
        text: "", children: [],
      };
      onUpdate(block.id, { bullets: [...(block.bullets || []), newBullet] });
    };

    const handleToggleNewBullet = (bullet) => {
      onUpdate(block.id, { bullets: (block.bullets || []).filter(b => b.id !== bullet.id) });
    };

    const handleRenameNewBullet = (bulletId, text) => {
      onUpdate(block.id, { bullets: (block.bullets || []).map(b =>
        b.id === bulletId ? { ...b, text } : b) });
    };

    return (
      <div style={{ position: "relative" }}>
        <div style={{ background: "var(--card-bg)", borderRadius: 10,
          border: "1px solid var(--border)", overflow: "visible" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8,
            padding: "8px 12px", background: "var(--surface)",
            borderBottom: "1px solid var(--border)",
            borderRadius: "10px 10px 0 0" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--fg)", flex: 1 }}>
              {block.title || "Bullet Points"}
            </span>
            <span style={{ fontSize: 10, background: "#0f766e22", color: "#0f766e",
              borderRadius: 20, padding: "1px 7px", fontWeight: 700 }}>
              Bullets
            </span>
            {editing && (
              <>
                <button onClick={handleAddBullet} title="Add new bullet"
                  style={{ background: "none", border: "1px solid #0f766e44",
                    borderRadius: 6, cursor: "pointer", color: "#0f766e",
                    fontSize: 16, lineHeight: 1, padding: "2px 8px", fontWeight: 700 }}>
                  +
                </button>
                <button
                  onClick={() => {
                    if (!confirm("Delete this block?")) return;
                    onRemove(block.id);
                  }}                  title="Delete this block"
                  style={{ background: "none", border: "1px solid #dc262633",
                    borderRadius: 6, cursor: "pointer", color: "#dc2626",
                    fontSize: 12, lineHeight: 1, padding: "2px 8px", fontWeight: 700 }}>
                  ✕
                </button>
              </>
            )}
          </div>
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            {(block.bullets || []).map((bullet, bi) => (
              <div key={bullet.id} style={{ display: "flex", alignItems: "center", gap: 8,
                padding: "6px 10px", borderRadius: 6,
                background: "var(--surface)", border: "1px solid var(--border)",
                opacity: bullet._active !== false ? 1 : 0.4 }}>
                {editing && (
                  <input type="checkbox" checked={bullet._active !== false}
                    onChange={() => bullet._isNew ? handleToggleNewBullet(bullet) : handleToggleBullet(bullet)}
                    style={{ cursor: "pointer", width: 14, height: 14, flexShrink: 0 }} />
                )}
                {editing && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 }}>
                    <button onClick={() => handleMoveBullet(bi, -1)} disabled={bi === 0}
                      style={{ background: "none", border: "none", padding: 0,
                        cursor: bi === 0 ? "default" : "pointer", lineHeight: 1,
                        color: bi === 0 ? "var(--border)" : "var(--fg-muted)", fontSize: 10 }}>▲</button>
                    <button onClick={() => handleMoveBullet(bi, 1)}
                      disabled={bi === (block.bullets || []).length - 1}
                      style={{ background: "none", border: "none", padding: 0,
                        cursor: bi === (block.bullets || []).length - 1 ? "default" : "pointer",
                        lineHeight: 1,
                        color: bi === (block.bullets || []).length - 1 ? "var(--border)" : "var(--fg-muted)",
                        fontSize: 10 }}>▼</button>
                  </div>
                )}
                <span style={{ color: "#0f766e", fontWeight: 700, flexShrink: 0 }}>•</span>
                {bullet._isNew ? (
                  <input value={bullet.text} onChange={e => handleRenameNewBullet(bullet.id, e.target.value)}
                    placeholder="Bullet text…" autoFocus
                    style={{ flex: 1, background: "transparent", border: "none",
                      borderBottom: "1px solid #0f766e", color: "var(--fg)",
                      fontSize: 13, fontFamily: "inherit", outline: "none", padding: "0 2px" }} />
                ) : (
                  <span style={{ fontSize: 13, color: "var(--fg)", flex: 1,
                    textDecoration: bullet._active !== false ? "none" : "line-through" }}>
                    {bullet.text || `Item ${bi + 1}`}
                  </span>
                )}
                {bullet._isNew && (
                  <span style={{ fontSize: 9, fontWeight: 800, color: "#059669",
                    background: "#d1fae5", borderRadius: 3, padding: "1px 4px", flexShrink: 0 }}>
                    NEW
                  </span>
                )}
              </div>
            ))}
            {(block.bullets || []).length === 0 && (
              <div style={{ fontSize: 12, color: "var(--fg-muted)", textAlign: "center",
                padding: "10px 0", opacity: 0.6 }}>
                No items — click + to add
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  // Recalled textbox — show/hide checkboxes + full BlockCard editor
  if (block.type === "textbox" && !isNew) {
    return (
      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 0 }}>

        {/* Show/hide checkbox row — one per textbox field */}
        {(block.textboxes || []).length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap",
            background: "var(--surface2)", border: "1px solid var(--border)",
            borderBottom: "none", borderRadius: "10px 10px 0 0",
            padding: "6px 12px", alignItems: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--fg-muted)",
              textTransform: "uppercase", letterSpacing: "0.06em", marginRight: 4 }}>
              Visible:
            </span>
            {(block.textboxes || []).map((tb, ti) => (
              <label key={tb.id} style={{ display: "flex", alignItems: "center", gap: 4,
                fontSize: 12, cursor: (!editing || tb._isNew) ? "default" : "pointer",
                opacity: tb._isNew ? 0.5 : 1 }}>
                <input
                  type="checkbox"
                  checked={tb._active !== false}
                  disabled={!editing || !!tb._isNew}
                  onChange={() => {
                    if (!editing || tb._isNew) return;
                    const newActive = tb._active !== false ? false : true;
                    onUpdate(block.id, {
                      textboxes: (block.textboxes || []).map(t =>
                        t.id === tb.id ? { ...t, _active: newActive } : t
                      ),
                    });
                  }}                  style={{ cursor: (!editing || tb._isNew) ? "default" : "pointer",
                    width: 13, height: 13 }}
                />
                <span style={{
                  textDecoration: tb._active === false ? "line-through" : "none",
                  color: tb._active === false ? "var(--fg-muted)" : "var(--fg)" }}>
                  {tb.question || `Field ${ti + 1}`}
                </span>
              </label>
            ))}
          </div>
        )}

        {/* Full BlockCard with all existing editor UI */}
        <div style={{ borderRadius: editing && (block.textboxes || []).length > 0
          ? "0 0 10px 10px" : "10px" }}>
          <BlockCard
            block={block}
            index={index}
            total={total}
            depth={depth}
            onUpdate={editing ? safeUpdate : () => {}}
            onRemove={editing ? onRemove : () => {}}
            onMove={editing ? handleMove : () => {}}
            onAddToBlock={editing ? onAddToBlock : () => {}}
            onAddToButton={editing ? onAddToButton : () => {}}
            onAddToOption={editing ? onAddToOption : () => {}}
            onAddToBullet={editing ? onAddToBullet : () => {}}
            units={units}
            validationTypes={validationTypes}
            validationDefinitions={validationDefinitions}
          />
        </div>
      </div>
    );
  }

  // ── Table custom renderer ─────────────────────────────────────────────
  if (block.type === "table" && !isNew) {
    return (
      <div style={{ position: "relative" }}>
        <div style={{ background: "var(--card-bg)", borderRadius: 10,
          border: "1px solid var(--border)", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8,
            padding: "8px 12px", background: "var(--surface)",
            borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--fg)", flex: 1 }}>
              {block.title || "Table"}
            </span>
            <span style={{ fontSize: 10, background: "#0891b222", color: "#0891b2",
              borderRadius: 20, padding: "1px 7px", fontWeight: 700 }}>
              Table
            </span>
          </div>
          <div style={{ padding: 14 }}>
            <RecallTableEditor
              block={block}
              editing={editing}
              onToggleColumn={handleToggleColumn}
              onAddColumn={handleAddColumn}
              onMoveColumn={handleMoveColumn}
              onToggleValidationEntry={handleToggleValidationEntry}
              onAddValidationEntry={handleAddValidationEntry}
              onUpdateNewCol={handleUpdateNewCol}
              onAddRow={handleAddRow}
              onToggleRow={handleToggleRow}
              onMoveRow={handleMoveRow}
              onUpdateRow={handleUpdateRow}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Default: BlockCard ────────────────────────────────────────────────
  return (
    <div style={{ position: "relative" }}>
      {isNew && (
        <div style={{ position: "absolute", top: -8, right: 8, zIndex: 10,
          fontSize: 9, fontWeight: 800, color: "#059669",
          background: "#d1fae5", borderRadius: 4, padding: "1px 6px",
          border: "1px solid #6ee7b7" }}>
          NEW
        </div>
      )}
      <BlockCard
        block={block}
        index={index}
        total={total}
        depth={depth}
        onUpdate={editing ? safeUpdate : () => {}}
        onRemove={editing ? onRemove : () => {}}
        onMove={editing ? handleMove : () => {}}
        onAddToBlock={editing ? onAddToBlock : () => {}}
        onAddToButton={editing ? onAddToButton : () => {}}
        onAddToOption={editing ? onAddToOption : () => {}}
        onAddToBullet={editing ? onAddToBullet : () => {}}
        units={units}
        validationTypes={validationTypes}
        validationDefinitions={validationDefinitions}
      />
    </div>
  );
}

// ── Main RecallPage ───────────────────────────────────────────────────────
export default function RecallPage() {
  const [modules,      setModules]      = useState([]);
  const [activeModule, setActiveModule] = useState(null);
  const [blocks,       setBlocks]       = useState([]);
  const [origUins,     setOrigUins]     = useState([]);
  const [activeType,   setActiveType]   = useState("radio");
  const [editing,      setEditing]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [fullscreen,   setFullscreen]   = useState(null);

  const { validationTypes, validationDefinitions, units } = useLookups();

  const [moduleWidth,  setModuleWidth]  = useState(240);
  const [builderWidth, setBuilderWidth] = useState(500);
  const dragState = useRef(null);

  const startDrag = (which) => (e) => {
    e.preventDefault();
    dragState.current = { which, startX: e.clientX,
      startModuleWidth: moduleWidth, startBuilderWidth: builderWidth };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev) => {
      const d = dragState.current;
      if (!d) return;
      const dx = ev.clientX - d.startX;
      if (d.which === "module")  setModuleWidth(w  => Math.min(480, Math.max(160, d.startModuleWidth + dx)));
      if (d.which === "builder") setBuilderWidth(w => Math.min(900, Math.max(280, d.startBuilderWidth + dx)));
    };
    const onUp = () => {
      dragState.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  useEffect(() => {
    fetchRecallModules().then(setModules).catch(console.error);
  }, []);

  const loadModule = async (mod) => {
    setLoading(true);
    setActiveModule(mod);
    setEditing(false);
    try {
      const { definitions, attributes, validationEntries, significantEntries } = await fetchRecallModule(mod.id);
      const reconstructed = reconstruct(definitions, attributes, validationEntries || [], significantEntries || []);
      setBlocks(reconstructed);
      setOrigUins(collectUins(reconstructed));
      reconstructed.filter(b => b.type === "table").forEach(b => {
  console.log("table _tableAttrs:", b._tableAttrs?.length, "cols:", b.table?.cols, "cells[0]:", b.table?.cells?.[0]);
});
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const updateBlock = (id, patch) => setBlocks(bs => treeMap(bs, id, b => ({ ...b, ...patch })));
  const removeBlock = id           => setBlocks(bs => treeFilter(bs, id));
  const addToBlock  = (pid, type)  => setBlocks(bs => treeAddToBlock(bs, pid, makeBlock(type)));
  const addToButton = (bid, btnId, type) => setBlocks(bs => treeAddToButton(bs, bid, btnId, makeBlock(type)));
  const addToOption = (bid, optId, type) => setBlocks(bs => treeAddToOption(bs, bid, optId, makeBlock(type)));
  const addToBullet = (bid, bulId, type) => setBlocks(bs => treeAddToBullet(bs, bid, bulId, makeBlock(type)));

  const moveBlock = (id, dir) => {
    setBlocks(bs => treeMoveInList(bs, id, dir));
  };

  const addRootBlock = () => setBlocks(bs => [...bs, { ...makeBlock(activeType), _isNew: true }]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const addedBlocks = blocks
        .map((b, i) => ({ ...b, _visualPosition: i }))
        .filter(b => b._isNew || !b._uin);
      const addedSubItems = [];
      for (const block of blocks) {
        if (block._isNew || !block._uin) continue;

        if (block.type === "textbox" && block.textboxes) {
          const newFields = block.textboxes.filter(tb => !tb._uin || tb._isNew);
          if (newFields.length > 0) {
            addedSubItems.push({
              _parentUin:  block._uin,
              _type:       "textbox_fields",
              type:        "textbox",
              textboxes:   newFields,
              textboxRows: block.textboxRows,
              textboxCols: block.textboxCols,
              title:       block.title,
              layout:      block.layout,
            });
          }
        }

        if (block.type === "bullets" && block.bullets) {
          const newBullets = block.bullets.filter(b => !b._uin || b._isNew);
          if (newBullets.length > 0) {
            addedSubItems.push({
              _parentUin:  block._uin,
              _type:       "bullet_items",
              type:        "bullets",
              bullets:     newBullets,
              bulletRows:  block.bulletRows,
              bulletCols:  block.bulletCols,
            });
          }
        }

        if ((block.type === "radio" || block.type === "multiselect") && block.buttons) {
          const newButtons = block.buttons.filter(b => !b._uin || b._isNew);
          if (newButtons.length > 0) {
            addedSubItems.push({
              _parentUin:   block._uin,
              _nestingPath: `${block._uin}`,
              _sectionUin:  block._uin,
              _type:        "buttons",
              type:         block.type,
              grid:         block.grid,
              buttons:      newButtons,
            });
          }
          for (const btn of (block.buttons || [])) {
            if (btn._uin) {
              collectNestedNewButtons(
                btn.children || [], addedSubItems,
                `${block._uin}.${btn._uin}`,
                block._uin
              );
            }
          }
        }

        if (block.type === "table") {
          // New columns
          if (block._tableAttrs) {
            const allTableAttrs = block._tableAttrs || [];
            const newCols = allTableAttrs.filter(a => (!a._uin || a._isNew) && a._active);
            if (newCols.length > 0) {
              addedSubItems.push({
                _parentUin: block._uin,
                _type:      "table_columns",
                type:       "table",
                columns:    newCols.map((a) => {
                  const posInAll        = allTableAttrs.indexOf(a);
                  const allActiveBefore = allTableAttrs
                    .slice(0, posInAll)
                    .filter(x => x._active !== false).length;
                  return {
                    heading:     a.heading     || "",
                    kind:        a.kind        || "text",
                    constraint:  a.constraint  || "none",
                    constraintA: a.constraintA || "",
                    constraintB: a.constraintB || "",
                    maxLength:   a.maxLength   || null,
                    colNum:      allActiveBefore + 1,
                    options:     (a.options || []).filter(o => o._active)
                      .map(o => ({ label: o.description || "" })),
                  };
                }),
              });
            }
          }

          // New rows
          const allRows = block._tableRows || [];
          const newRows = allRows.filter(r => r._isNew && r._active !== false);
          if (newRows.length > 0) {
            const recalledRowCount = allRows.filter(r => !r._isNew).length;
            addedSubItems.push({
              _parentUin:       block._uin,
              _type:            "table_rows",
              type:             "table",
              rowCount:         newRows.length,
              recalledRowCount,
              rows:             newRows.map((r) => ({
                cells: r.cells || [],
              })),
            });
          }

          // Sync recalled cols and rows (moves + toggles)
          const recalledAttrs = (block._tableAttrs || []).filter(a => a._uin && !a._isNew);
          const recalledRows  = (block._tableRows  || []).filter(r => !r._isNew && r._attrUin);
          if (recalledAttrs.length > 0 || recalledRows.length > 0) {
            addedSubItems.push({
              _parentUin: block._uin,
              _type:      "table_sync",
              type:       "table",
              columns:    recalledAttrs.map((a, i) => ({
                uin:           a._uin,
                active:        a._active !== false,
                currentColNum: parseInt(a._attrName?.match(/C(\d+)$/)?.[1] || "0"),
                swapCount:     a._swapCount || 0,
              })),
              rows:       recalledRows.map((r) => ({
                attrUin:       r._attrUin,
                defUin:        r._defUin,
                active:        r._active !== false,
                currentRowNum: r._rowNum,
                swapCount:     r._swapCount || 0,
              })),
            });
          }
        }
      }

      // Sync recalled block positions (moves)
      blocks.forEach((block, i) => {
        if (block._uin && !block._isNew) {
          addedSubItems.push({
            _parentUin: null,
            _uin:       block._uin,
            _type:      "sync_position",
            position:   i + 1,
            layout:     block.type === "textbox" ? block.layout : undefined,
          });
        }
      });

      // Sync recalled button/bullet/textbox changes per block
      for (const block of blocks) {
        if (block._isNew || !block._uin) continue;

        // Buttons — sync order and status
        if ((block.type === "radio" || block.type === "multiselect") && block.buttons) {
          const recalledBtns = block.buttons.filter(b => b._uin && !b._isNew);
          if (recalledBtns.length > 0) {
            addedSubItems.push({
              _parentUin: block._uin,
              _type:      "sync_buttons",
              buttons:    recalledBtns.map((b, i) => ({
                uin:      b._uin,
                position: i + 1,
                active:   b._active !== false,
              })),
            });
          }
        }

        // Bullets — sync order and status
        if (block.type === "bullets" && block.bullets) {
          const recalledBullets = block.bullets.filter(b => b._uin && !b._isNew);
          if (recalledBullets.length > 0) {
            addedSubItems.push({
              _parentUin: block._uin,
              _type:      "sync_bullets",
              bullets:    recalledBullets.map((b, i) => ({
                uin:      b._uin,
                position: i + 1,
                active:   b._active !== false,
              })),
            });
          }
        }

        // Textboxes — sync status and unit
        if (block.type === "textbox" && block.textboxes) {
          const recalledTbs = block.textboxes.filter(t => t._uin && !t._isNew);
          if (recalledTbs.length > 0) {
            addedSubItems.push({
              _parentUin: block._uin,
              _type:      "sync_textboxes",
              textboxes:  recalledTbs.map(t => ({
                uin:    t._uin,
                attrUin: t._attrUin,
                active: t._active !== false,
                unitId: t.unitId || 0,
                layout: t.layout || "inline",
              })),
            });
          }

          // Existing textbox fields — sync kind/constraint/significant entries
          for (const tb of recalledTbs) {
            if (!tb._attrUin) continue;
            const sigEntries        = tb.significantEntries || [];
            const toggledSigEntries = sigEntries.filter(o => o.id && !o._isNew);
            const newSigEntries     = sigEntries.filter(o => o._isNew && o.value?.trim());
            addedSubItems.push({
              _parentUin:  block._uin,
              _type:       "sync_textbox_attr",
              attrUin:     tb._attrUin,
              kind:        tb.kind,
              constraint:  tb.constraint,
              constraintA: tb.constraintA,
              constraintB: tb.constraintB,
              maxLength:   tb.maxLength,
              toggledSigEntries,
                newSigEntries: newSigEntries.map(o => ({
                  comparator: o.comparator, valueA: o.valueA, valueB: o.valueB,
                })),
            });
          }
        }

        // Table validation entries and constraints
        if (block.type === "table" && block._tableAttrs) {
          for (const attr of block._tableAttrs) {
            if (!attr._uin || attr._isNew) continue;
            // Toggled validation entries
            const toggledEntries = (attr.options || []).filter(o => o.id && !o._isNew);
            // New validation entries
            const newEntries = (attr.options || []).filter(o => o._isNew && o._active);
            if (toggledEntries.length > 0 || newEntries.length > 0 ||
                attr.constraint !== undefined) {

              addedSubItems.push({
                _parentUin:  block._uin,
                _type:       "sync_table_attr",
                attrUin:     attr._uin,
                kind:        attr.kind,
                constraint:  attr.constraint,
                constraintA: attr.constraintA,
                constraintB: attr.constraintB,
                maxLength:   attr.maxLength,
                toggledEntries: toggledEntries.map(o => ({
                  id:     o.id,
                  active: o._active !== false,
                })),
                newEntries: newEntries.map(o => ({ description: o.description })),
                significantEntries: (attr.significantEntries || []).map(o => ({
                  comparator: o.comparator, valueA: o.valueA, valueB: o.valueB,
                })),
              });
            }
          }
        }
      }

      
      const current    = collectUins(blocks);
      const currentSet = new Set(current.map(u => u.uin));
      const deleted    = origUins.filter(u => !currentSet.has(u.uin));

      await saveRecallChanges(activeModule.id, [...addedBlocks, ...addedSubItems], deleted);
      await loadModule(activeModule);
    } catch (e) {
      console.error(e);
      alert("Error saving: " + e.message);
    }
    setSaving(false);
  };

  const handleCancel = async () => {
    setEditing(false);
    if (activeModule) await loadModule(activeModule);
  };

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto", padding: "24px 24px 0",
      height: "calc(100vh - 49px)", display: "flex", flexDirection: "column" }}>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 20, flexShrink: 0, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em",
            color: "var(--fg)", margin: 0 }}>
            Recall
          </h1>
          {activeModule && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%",
                background: activeModule.module_color || "#000",
                border: "1px solid var(--border)" }} />
              <span style={{ fontSize: 13, color: "var(--fg-muted)", fontWeight: 600 }}>
                {activeModule.module_name}
              </span>
              {editing && (
                <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700,
                  background: "#fef3c7", borderRadius: 4, padding: "1px 6px",
                  border: "1px solid #fcd34d" }}>
                  ● Editing
                </span>
              )}
            </div>
          )}
        </div>
        {activeModule && (
          <div style={{ display: "flex", gap: 8 }}>
            {editing ? (
              <>
                <button onClick={handleCancel} style={actionBtn}>Cancel</button>
                <button onClick={handleSave} disabled={saving}
                  style={{ ...accentBtn, opacity: saving ? 0.5 : 1 }}>
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} style={accentBtn}>Edit</button>
            )}
          </div>
        )}
      </div>

      {/* Three-panel layout */}
      <div style={{ flex: 1, display: "flex", gap: 0, minHeight: 0 }}>

        {/* Panel 1: Recall Modules */}
        {(fullscreen === null || fullscreen === "modules") && (
          <>
            <div style={{
              width: fullscreen === "modules" ? undefined : moduleWidth,
              flex: fullscreen === "modules" ? 1 : undefined,
              flexShrink: 0, height: "100%", display: "flex", flexDirection: "column",
              paddingRight: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: 12, flexShrink: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-muted)",
                  textTransform: "uppercase", letterSpacing: "0.09em" }}>
                  Recall Modules
                </div>
                <button onClick={() => setFullscreen(fullscreen === "modules" ? null : "modules")}
                  style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6,
                    cursor: "pointer", color: "var(--fg-muted)", fontSize: 11, padding: "2px 7px" }}>
                  {fullscreen === "modules" ? "⊠ Exit" : "⛶"}
                </button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", background: "var(--card-bg)",
                borderRadius: 12, border: "1px solid var(--border)", padding: 12,
                display: "flex", flexDirection: "column", gap: 6 }}>
                {modules.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--fg-muted)", textAlign: "center",
                    padding: "20px 0", opacity: 0.6 }}>
                    No exported modules found
                  </div>
                ) : modules.map(mod => (
                  <div key={mod.id} onClick={() => loadModule(mod)} style={{
                    background: "var(--surface)",
                    border: `1px solid ${activeModule?.id === mod.id ? "var(--accent)" : "var(--border)"}`,
                    borderRadius: 8, padding: "8px 10px",
                    display: "flex", alignItems: "center", gap: 8,
                    cursor: "pointer", transition: "border-color 0.15s",
                  }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                      background: mod.module_color || "#000", border: "1px solid var(--border)" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--fg)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {mod.module_name}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--fg-muted)" }}>ID: {mod.id}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {!fullscreen && (
              <div onMouseDown={startDrag("module")} style={{
                width: 12, flexShrink: 0, alignSelf: "stretch", cursor: "col-resize",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{ width: 1, height: "100%", background: "var(--border)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--accent)"}
                  onMouseLeave={e => e.currentTarget.style.background = "var(--border)"} />
              </div>
            )}
          </>
        )}

        {/* Panel 2: Builder */}
        {(fullscreen === null || fullscreen === "builder") && (
          <>
            <div style={{
              width: fullscreen === "builder" ? undefined : builderWidth,
              flex: fullscreen === "builder" ? 1 : undefined,
              flexShrink: 0, height: "100%", display: "flex", flexDirection: "column",
              paddingRight: fullscreen === "builder" ? 0 : 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: 12, flexShrink: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-muted)",
                  textTransform: "uppercase", letterSpacing: "0.09em" }}>
                  Builder
                </div>
                <button onClick={() => setFullscreen(fullscreen === "builder" ? null : "builder")}
                  style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6,
                    cursor: "pointer", color: "var(--fg-muted)", fontSize: 11, padding: "2px 7px" }}>
                  {fullscreen === "builder" ? "⊠ Exit" : "⛶ Expand"}
                </button>
              </div>

              {editing && (
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap",
                  background: "var(--card-bg)", borderRadius: 10, padding: "10px 14px",
                  border: "1px solid var(--border)", marginBottom: 12, flexShrink: 0,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-muted)",
                    textTransform: "uppercase", letterSpacing: "0.09em", marginRight: 4 }}>
                    Add block
                  </span>
                  {TYPES.map(t => (
                    <button key={t.value} onClick={() => setActiveType(t.value)}
                      style={{ padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600,
                        cursor: "pointer", border: "1px solid",
                        borderColor: activeType === t.value ? TYPE_COLORS[t.value] : "var(--border)",
                        background: activeType === t.value ? `${TYPE_COLORS[t.value]}10` : "transparent",
                        color: activeType === t.value ? TYPE_COLORS[t.value] : "var(--fg-muted)" }}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                  <button onClick={addRootBlock}
                    style={{ marginLeft: "auto", padding: "6px 14px", borderRadius: 8,
                      background: "var(--accent)", color: "#fff", border: "none",
                      fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                    + Add Block
                  </button>
                </div>
              )}

              {!editing && activeModule && (
                <div style={{ fontSize: 11, color: "var(--fg-muted)", marginBottom: 10,
                  padding: "6px 12px", background: "var(--surface)", borderRadius: 6,
                  border: "1px solid var(--border)", flexShrink: 0, lineHeight: 1.5 }}>
                  📖 Read-only — click <strong>Edit</strong> to add or remove blocks.
                  Existing content cannot be renamed to preserve history.
                </div>
              )}

              <div style={{ flex: 1, overflowY: "auto" }}>
                {!activeModule ? (
                  <div style={{ textAlign: "center", padding: "56px 20px",
                    border: "2px dashed var(--border-mid)", borderRadius: 14,
                    color: "var(--fg-muted)", fontSize: 13 }}>
                    Select a module from the left panel
                  </div>
                ) : loading ? (
                  <div style={{ textAlign: "center", padding: "56px 20px",
                    color: "var(--fg-muted)", fontSize: 13 }}>Loading…</div>
                ) : blocks.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "56px 20px",
                    border: "2px dashed var(--border-mid)", borderRadius: 14,
                    color: "var(--fg-muted)", fontSize: 13 }}>No elements found</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 24 }}>
                    {blocks.map((block, i) => (
                      <RecallBlockCard
                        key={block.id}
                        block={block}
                        index={i}
                        total={blocks.length}
                        depth={0}
                        editing={editing}
                        onUpdate={updateBlock}
                        onRemove={removeBlock}
                        onMove={moveBlock}
                        onAddToBlock={addToBlock}
                        onAddToButton={addToButton}
                        onAddToOption={addToOption}
                        onAddToBullet={addToBullet}
                        units={units}
                        validationTypes={validationTypes}
                        validationDefinitions={validationDefinitions}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
            {!fullscreen && (
              <div onMouseDown={startDrag("builder")} style={{
                width: 12, flexShrink: 0, alignSelf: "stretch", cursor: "col-resize",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{ width: 1, height: "100%", background: "var(--border)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--accent)"}
                  onMouseLeave={e => e.currentTarget.style.background = "var(--border)"} />
              </div>
            )}
          </>
        )}

        {/* Panel 3: Live Preview */}
        {(fullscreen === null || fullscreen === "preview") && (
          <div style={{ flex: 1, minWidth: 280, height: "100%",
            display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 12, flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-muted)",
                textTransform: "uppercase", letterSpacing: "0.09em" }}>
                Live Preview
              </div>
              <button onClick={() => setFullscreen(fullscreen === "preview" ? null : "preview")}
                style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6,
                  cursor: "pointer", color: "var(--fg-muted)", fontSize: 11, padding: "2px 7px" }}>
                {fullscreen === "preview" ? "⊠ Exit" : "⛶ Expand"}
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", overflowX: "auto",
              background: "var(--card-bg)", borderRadius: 12,
              border: "1px solid var(--border)", padding: 20,
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              {blocks.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px",
                  color: "var(--fg-muted)", fontSize: 13 }}>
                  Load a module to see preview
                </div>
              ) : (
                <div style={{ minWidth: 320 }}>
                  <Preview blocks={blocks} units={units} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}