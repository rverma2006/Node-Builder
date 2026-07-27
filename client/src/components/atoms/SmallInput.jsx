export default function SmallInput({ value, onChange, placeholder, style = {} }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        color: "var(--fg)",
        fontSize: 13,
        padding: "5px 9px",
        outline: "none",
        width: "100%",
        fontFamily: "inherit",
        ...style,
      }}
    />
  );
}