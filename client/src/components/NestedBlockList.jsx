import BlockCard from "./BlockCard";

export default function NestedBlockList({
  blocks, onUpdate, onRemove, onMove,
  onAddToBlock, onAddToButton, onAddToOption, onAddToBullet,
  units = [], validationTypes = [], validationDefinitions = [],
  depth,
}) {
  if (!blocks || blocks.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10,
      paddingLeft: 14, borderLeft: "2px solid var(--border-mid)" }}>
      {blocks.map((child, ci) => (
        <BlockCard key={child.id} block={child} index={ci} total={blocks.length}
          depth={depth} onUpdate={onUpdate} onRemove={onRemove} onMove={onMove}
          onAddToBlock={onAddToBlock} onAddToButton={onAddToButton}
          onAddToOption={onAddToOption} onAddToBullet={onAddToBullet}
          units={units} validationTypes={validationTypes}
          validationDefinitions={validationDefinitions} />
      ))}
    </div>
  );
}