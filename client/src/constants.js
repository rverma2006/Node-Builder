export const TYPES = [
  { value: "radio",       label: "Radio Buttons",  icon: "⊙" },
  { value: "multiselect", label: "Multi-Select",    icon: "☑" },
  { value: "textbox",     label: "Text Box(es)",    icon: "☰" },
  { value: "table",       label: "Table",           icon: "▦" },
  { value: "header",      label: "Section Header",  icon: "H" },
  { value: "richtext",    label: "Text",            icon: "¶" },
  { value: "breakline",   label: "Break Line",      icon: "—" },
  { value: "bullets",     label: "Bullet Points",   icon: "•" },
];

export const TYPE_COLORS = {
  radio:       "#2563eb",
  multiselect: "#7c3aed",
  textbox:     "#059669",
  dropdown:    "#ea580c",
  table:       "#0891b2",
  header:      "#b45309",
  richtext:    "#64748b",
  breakline:   "#94a3b8",
  bullets:     "#0f766e",
};

// Maps DB description → internal kind string used by the builder
export const DESCRIPTION_TO_KIND = {
  "list":         "dropdown",
  "whole number": "int",
  "decimal":      "float",
  "date":         "date",
  "time":         "time",
  "text length":  "text",
};

// Maps internal kind string → DB description for export lookups
export const KIND_TO_DESCRIPTION = {
  text:     "Text length",
  int:      "Whole number",
  float:    "Decimal",
  date:     "Date",
  dropdown: "List",
  time:     "Time",
};

// Maps DB constraint description → internal constraint key
export const DESCRIPTION_TO_CONSTRAINT = {
  "between":                  "between",
  "not between":              "notbetween",
  "equal to":                 "eq",
  "not equal to":             "neq",
  "greater than":             "gt",
  "greater than or equal to": "gte",
  "less than":                "lt",
  "less than or equal to":    "lte",
};

// Maps internal constraint key → DB description for export lookups
export const CONSTRAINT_TO_DESCRIPTION = {
  eq:         "equal to",
  neq:        "not equal to",
  gt:         "greater than",
  gte:        "greater than or equal to",
  lt:         "less than",
  lte:        "less than or equal to",
  between:    "between",
  notbetween: "not between",
};

// Maps input types
export const TYPE_TO_ELEMENT_DESCRIPTION = {
  textbox:     "Input box",
  header:      "Section Header",
  richtext:    "Text",
  radio:       "Radio Button",
  multiselect: "Multi-selection",
  table:       "Table",
  breakline:   "Break Element",
  bullets:     "Bullets Items",
  dropdown:    "Input box",
};
