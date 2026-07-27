import { useState, useRef, useEffect } from "react";
import { TYPES, TYPE_COLORS } from "../constants";
import { iconBtn } from "../styles/tokens";

export default function AddChildPopover({ onAdd, label = "Nest a block", small = false }) {

  // State to track whether the popover is open
  const [open, setOpen] = useState(false);

  // Ref for the popover container to handle outside clicks
  const ref = useRef();

  // Close the popover when clicking outside of it
  useEffect(() => {
    if (!open) return;
    const h = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);


  return (
    // Container for the add button and the popover menu
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>

      {/* Button to toggle the popover, styled differently if 'small' prop is true */}
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        title="Add nested block"
        style={
          small
            ? {
                background: open ? "var(--accent-soft)" : "none",
                border: "1px solid var(--accent)",
                borderRadius: 5,
                color: "var(--accent)",
                cursor: "pointer",
                padding: "2px 7px",
                fontSize: 11,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 3,
              }
            : {
                ...iconBtn,
                borderColor: "var(--accent)",
                color: "var(--accent)",
                background: open ? "var(--accent-soft)" : "none",
                fontSize: 15,
                fontWeight: 700,
              }
        }
      >
        {small ? <>⊞ nest</> : "⊞"}
      </button>

      {/* Popover menu that appears when the add button is clicked, listing block types to add as children */}
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: small ? 28 : 34,
            zIndex: 300,
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 8,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            minWidth: 170,
            boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "var(--fg-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              padding: "2px 8px 6px",
            }}
          >
            {label}
          </div>

          {/* List of block types to add as children, each button calls onAdd 
          with the selected type and closes the popover */}
          {TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => { onAdd(t.value); setOpen(false); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                borderRadius: 7,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--fg)",
                fontSize: 13,
                textAlign: "left",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--surface)"}
              onMouseLeave={e => e.currentTarget.style.background = "none"}
            >
              <span style={{ fontSize: 15, color: TYPE_COLORS[t.value] }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}