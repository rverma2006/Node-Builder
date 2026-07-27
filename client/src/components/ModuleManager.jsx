import { useState, useEffect } from "react";
import { listModules, loadModule, saveModule, updateModule, deleteModule } from "../api";
import { iconBtn } from "../styles/tokens";
import SmallInput from "./atoms/SmallInput";

const actionBtn = {
  padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
  cursor: "pointer", border: "1px solid var(--border)",
  background: "var(--card-bg)", color: "var(--fg-muted)",
};

const dangerBtn = {
  ...actionBtn,
  color: "#dc2626",
  border: "1px solid #dc262644",
  background: "transparent",
};

const accentBtn = {
  ...actionBtn,
  color: "var(--accent)",
  border: "1px solid var(--accent)44",
  background: "var(--accent-soft)",
};

function SaveDialog({ initialName, onConfirm, onCancel }) {
  const [name, setName] = useState(initialName || "");
  const [color, setColor] = useState("#000000");
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    if (!name.trim()) return;
    setBusy(true);
    await onConfirm(name.trim(), color);
    setBusy(false);
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onCancel(); }} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, backdropFilter: "blur(2px)",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--card-bg)", borderRadius: 12, padding: 24,
        width: "min(380px, 92vw)", display: "flex", flexDirection: "column", gap: 16,
        border: "1px solid var(--border)", boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
      }}>
        <span style={{ fontWeight: 800, fontSize: 15, color: "var(--fg)" }}>Save Module</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-muted)",
              textTransform: "uppercase", letterSpacing: "0.06em" }}>Module name</span>
            <SmallInput value={name} onChange={setName} placeholder="Module name…"
              onKeyDown={e => e.key === "Enter" && handle()} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-muted)",
              textTransform: "uppercase", letterSpacing: "0.06em" }}>Color</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="color" value={color} onChange={e => setColor(e.target.value)}
                style={{ width: 40, height: 32, border: "1px solid var(--border)",
                  borderRadius: 6, cursor: "pointer", padding: 2, background: "var(--surface)" }} />
              <span style={{ fontSize: 12, color: "var(--fg-muted)", fontFamily: "monospace" }}>
                {color}
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={actionBtn}>Cancel</button>
          <button onClick={handle} disabled={busy || !name.trim()}
            style={{ ...accentBtn, opacity: busy || !name.trim() ? 0.5 : 1 }}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ModuleManager({ blocks, onLoad, activeModule, setActiveModule }) {
  const [modules,    setModules]    = useState([]);
  const [showSave,   setShowSave]   = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameVal,  setRenameVal]  = useState("");

  const refresh = () => listModules("module").then(setModules).catch(console.error);

  useEffect(() => { refresh(); }, []);

  const handleSave = async (name, color) => {
    const result = await saveModule(name, blocks, color, "module");
    setActiveModule({ id: result.id, name, color });
    setShowSave(false);
    await refresh();
  };

  // Overwrite — save current canvas back to the active module without renaming
  const handleOverwrite = async () => {
    if (!activeModule) return;
    if (!confirm("Overwrite this module with the current canvas?")) return;
    await updateModule(activeModule.id, { data: blocks });
    await refresh();
  };

  const handleLoad = async (id, name, color) => {
    const m = await loadModule(id);
    onLoad(m.data);
    setActiveModule({ id, name, color });
  };

  const handleRename = async (id) => {
    if (!renameVal.trim()) return;
    await updateModule(id, { name: renameVal.trim() });
    setRenamingId(null);
    setRenameVal("");
    if (activeModule?.id === id) {
      setActiveModule(a => ({ ...a, name: renameVal.trim() }));
    }
    await refresh();
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this module?")) return;
    await deleteModule(id);
    if (activeModule?.id === id) setActiveModule(null);
    await refresh();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setShowSave(true)}
          style={{ ...accentBtn, flex: 1 }}>
          {activeModule ? "Save As…" : "+ Save current canvas"}
        </button>
        {activeModule && (
          <button onClick={handleOverwrite} style={actionBtn}>
            Overwrite
          </button>
        )}
      </div>

      {modules.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--fg-muted)", textAlign: "center",
          padding: "20px 0", opacity: 0.6 }}>
          No saved modules yet
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {modules.map(m => (
            <div key={m.id} style={{ background: "var(--surface)",
              border: `1px solid ${activeModule?.id === m.id ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 8, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>

              {renamingId === m.id ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <SmallInput value={renameVal} onChange={setRenameVal}
                    placeholder="New name…"
                    onKeyDown={e => { if (e.key === "Enter") handleRename(m.id); }} />
                  <button onClick={() => handleRename(m.id)} style={actionBtn}>✓</button>
                  <button onClick={() => setRenamingId(null)} style={iconBtn}>✕</button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                    background: m.color || "#000000",
                    border: "1px solid var(--border)" }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--fg)",
                    flex: 1, minWidth: 0, overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.name}
                  </span>
                </div>
              )}

              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                <button onClick={() => handleLoad(m.id, m.name, m.color)} style={actionBtn}>Load</button>
                <button onClick={() => { setRenamingId(m.id); setRenameVal(m.name); }}
                  style={actionBtn}>Rename</button>
                <button onClick={() => handleDelete(m.id)} style={dangerBtn}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showSave && (
        <SaveDialog
          initialName={activeModule?.name || ""}
          onConfirm={handleSave}
          onCancel={() => setShowSave(false)}
        />
      )}
    </div>
  );
}