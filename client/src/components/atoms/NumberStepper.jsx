import FieldLabel from "./FieldLabel";
import { stepBtn } from "../../styles/tokens";

export default function NumberStepper({ label, value, min, max, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <FieldLabel>{label}</FieldLabel>
      <button onClick={() => onChange(Math.max(min, value - 1))} style={stepBtn}>−</button>
      <span
        style={{
          minWidth: 22,
          textAlign: "center",
          fontWeight: 700,
          fontSize: 14,
          color: "var(--fg)",
        }}
      >
        {value}
      </span>
      <button onClick={() => onChange(Math.min(max, value + 1))} style={stepBtn}>+</button>
    </div>
  );
}