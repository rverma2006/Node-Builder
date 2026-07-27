import PreviewBlock from "./PreviewBlock";

export default function PreviewNestedBlocks({ blocks, state, dispatch, defaultOpen = false, indent = 0, units = [] }) {
  if (!blocks || blocks.length === 0) return null;
  return (
    <div style={{ paddingLeft: indent > 0 ? 16 : 0, display: "flex", flexDirection: "column", gap: 12 }}>
      {blocks.map(child => (
        <PreviewBlock key={child.id} block={child} state={state} dispatch={dispatch}
          defaultOpen={defaultOpen} indent={indent} units={units} />
      ))}
    </div>
  );
}