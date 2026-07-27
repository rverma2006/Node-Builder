import { useReducer, useMemo, useState } from "react";
import PreviewBlock from "./PreviewBlock";


function reducer(state, action) {
  switch (action.type) {
    case "radio":
      return { ...state, radios: { ...state.radios, [action.blockId]: action.btnId } };
    case "multi":
      return {
        ...state,
        multis: {
          ...state.multis,
          [action.blockId]: {
            ...(state.multis[action.blockId] || {}),
            [action.btnId]: !state.multis?.[action.blockId]?.[action.btnId],
          },
        },
      };
    case "text":
      return { ...state, texts: { ...state.texts, [`${action.blockId}_${action.tbId}`]: action.val } };
    case "dropdown":
      return { ...state, dropdowns: { ...state.dropdowns, [action.blockId]: action.val } };
    case "tableCell":
      return {
        ...state,
        tableCells: {
          ...state.tableCells,
          [action.blockId]: {
            ...(state.tableCells?.[action.blockId] || {}),
            [`${action.r}_${action.c}`]: action.val,
          },
        },
      };
    case "expandAll":
      return action.newState;
    case "collapseAll":
      return { radios: {}, multis: {}, texts: {}, dropdowns: {}, tableCells: {} };
    default:
      return state;
  }
}

// Recursively collect all radio/multiselect selections from the block tree
function collectAllSelections(blocks, radios = {}, multis = {}) {
  for (const block of blocks) {
    if (block.type === "radio") {
      const total = (block.grid?.rows || 0) * (block.grid?.cols || 0);
      const buttons = (block.buttons || []).slice(0, total);
      // For radio: select the first button (to show its children), but we want ALL
      // so we pick the last button to cascade deepest, or better: select ALL by
      // treating radio as multiselect for expand purposes
      if (buttons.length > 0) {
        // Select all buttons for display — use multiselect-style so all nested content shows
        multis[block.id] = {};
        for (const btn of buttons) {
          multis[block.id][btn.id] = true;
          if ((btn.children || []).length > 0) {
            collectAllSelections(btn.children, radios, multis);
          }
        }
        // Also set radio to first button so radio styling still works
        radios[block.id] = buttons[buttons.length - 1].id;
      }
    } else if (block.type === "multiselect") {
      const total = (block.grid?.rows || 0) * (block.grid?.cols || 0);
      const buttons = (block.buttons || []).slice(0, total);
      multis[block.id] = {};
      for (const btn of buttons) {
        multis[block.id][btn.id] = true;
        if ((btn.children || []).length > 0) {
          collectAllSelections(btn.children, radios, multis);
        }
      }
    } else if (block.type === "dropdown") {
      // Skip — dropdowns don't nest children in the same way
    }

    // Recurse into block.children (section children)
    if ((block.children || []).length > 0) {
      collectAllSelections(block.children, radios, multis);
    }

    // Recurse into bullets children
    if (block.type === "bullets") {
      for (const bullet of (block.bullets || [])) {
        if ((bullet.children || []).length > 0) {
          collectAllSelections(bullet.children, radios, multis);
        }
      }
    }
  }
  return { radios, multis };
}

export default function Preview({ blocks, units = [] }) {
  const [state, dispatch] = useReducer(reducer, {
    radios: {}, multis: {}, texts: {}, dropdowns: {}, tableCells: {},
  });
  const [expanded, setExpanded] = useState(false);

  const handleExpandAll = () => {
    if (expanded) {
      dispatch({ type: "collapseAll" });
      setExpanded(false);
    } else {
      const { radios, multis } = collectAllSelections(blocks);
      dispatch({
        type: "expandAll",
        newState: { ...state, radios, multis },
      });
      setExpanded(true);
    }
  };

  if (!blocks || blocks.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Expand All button */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={handleExpandAll}
          style={{
            padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            cursor: "pointer", border: "1px solid var(--border)",
            background: expanded ? "var(--accent-soft)" : "var(--card-bg)",
            color: expanded ? "var(--accent)" : "var(--fg-muted)",
            transition: "all 0.15s",
          }}>
          {expanded ? "Collapse All" : "Expand All"}
        </button>
      </div>

      {blocks.map(block => (
        <PreviewBlock
          key={block.id}
          block={block}
          state={state}
          dispatch={dispatch}
          units={units} 
          defaultOpen
        />
      ))}
    </div>
  );
}