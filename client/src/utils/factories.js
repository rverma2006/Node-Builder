// Utility functions to create new blocks, buttons, textboxes with unique IDs and default values.
export const uid = () => crypto.randomUUID();

/**
 * Default grid layout for button-based blocks.
 */
export const defaultButtonGrid = () => ({ rows: 2, cols: 1 });


/**
 * Creates a single button node.
 * Used inside radio/multiselect blocks.
 */
export const makeButton  = () => ({ id: uid(), name: "", comment: "", children: [] });


/**
 * Creates a textbox field node.
 * Used inside textbox-type blocks.
 */
export const makeTextbox = () => ({ id: uid(), placeholder: "", kind: "text", question: "", constraint: "none", unit: "none", layout: "inline" });

/**
 * Creates a single option node.
 * Used inside dropdown/table blocks.
 */
export const makeOption  = () => ({ id: uid(), label: "", comment: "", children: [] });


/**
 * Creates a column node.
 * Used inside table blocks.
 */
export const makeColumn = () => ({
  kind:        "text",
  options:     [],
  constraint:  "none",
  constraintA: "",
  constraintB: "",
  maxLength:   null,
});


/**
 * Creates a bullet point node.
 * Used inside bullets-type blocks.
 */
export const makeBullet = () => ({ id: uid(), text: "", children: [] });

/**
 * Creates a full block
 *
 * A block represents a section in the module builder and can contain:
 * - a grid of buttons
 * - text inputs 
 * - nested children blocks 
 */
export const makeBlock = (type) => ({
  id: uid(),
  type,
  title: "",
  layout: "inline",

  // radio / multiselect
  grid: defaultButtonGrid(),
  buttons: Array.from({ length: 2 }, makeButton),

  // textbox — now has rows+cols grid
  textboxRows: 1,
  textboxCols: 1,
  textboxes: [makeTextbox()],

  // dropdown
  options: [makeOption(), makeOption()],

  // table
  table: {
    rows: 2,
    cols: 2,
    headerRow: false,
    headerCol: false,
    cells: Array.from({ length: 2 }, () => Array.from({ length: 2 }, () => "")),
    columns: Array.from({ length: 2 }, makeColumn),
  },

  // header / richtext
  content: "",

  // bullets
  bulletRows: 2,
  bulletCols: 1,
  bullets: Array.from({ length: 2 }, makeBullet),

  children: [],
});