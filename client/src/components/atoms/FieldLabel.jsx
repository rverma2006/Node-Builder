export default function FieldLabel({ children }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.09em",
        textTransform: "uppercase",
        color: "var(--fg-muted)",
      }}
    >
      {children}
    </span>
  );
}