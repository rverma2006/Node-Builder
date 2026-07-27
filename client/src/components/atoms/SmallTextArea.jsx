export default function SmallTextarea({ value, onChange, placeholder, rows = 2, style = {} }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        color: "var(--fg)",
        fontSize: 12,
        padding: "5px 9px",
        outline: "none",
        width: "100%",
        fontFamily: "inherit",
        resize: "vertical",
        lineHeight: 1.4,
        ...style,
      }}
    />
  );
}