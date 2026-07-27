import { useState, useEffect, useRef } from "react";
import {
  listModules, loadModule, saveModule, updateModule,
  deleteModule, exportModuleToDb, fetchSubspecialties,
} from "../api";
import SmallInput from "../components/atoms/SmallInput";
import Preview from "../components/preview/Preview";

const actionBtn = {
  padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
  cursor: "pointer", border: "1px solid var(--border)",
  background: "var(--card-bg)", color: "var(--fg-muted)",
};
const dangerBtn = {
  ...actionBtn, color: "#dc2626",
  border: "1px solid #dc262644", background: "transparent",
};
const accentBtn = {
  ...actionBtn, color: "var(--accent)",
  border: "1px solid var(--accent)44", background: "var(--accent-soft)",
};
const iconBtn = {
  width: 24, height: 24, borderRadius: 5, border: "1px solid var(--border)",
  background: "var(--card-bg)", color: "var(--fg-muted)", cursor: "pointer",
  fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
};
const moveBtn = {
  width: 22, height: 22, borderRadius: 4, border: "1px solid var(--border)",
  background: "var(--card-bg)", color: "var(--fg-muted)", cursor: "pointer",
  fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center",
  padding: 0, lineHeight: 1,
};

function ExportDialog({
  template, specialties = [],
  specialtyId, subspecialtyId, subspecialties, loadingSubs,
  onSpecialtyChange, onSubspecialtyChange,
  onConfirm, onCancel,
}) {
  const [name,   setName]   = useState(template.name);
  const [color,  setColor]  = useState(template.color || "#000000");
  const [status, setStatus] = useState(0);
  const [busy,   setBusy]   = useState(false);
  const [error,  setError]  = useState(null);

  const handle = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await exportModuleToDb(template.id, {
        name, color, status,
        specialtyId:    specialtyId    ? parseInt(specialtyId)    : 0,
        subspecialtyId: subspecialtyId ? parseInt(subspecialtyId) : 0,
      });
      if (res.error) throw new Error(res.error);
      onConfirm(res.moduleNameId);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onCancel(); }} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, backdropFilter: "blur(2px)",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--card-bg)", borderRadius: 12, padding: 24,
        width: "min(440px, 92vw)", display: "flex", flexDirection: "column", gap: 16,
        border: "1px solid var(--border)", boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
      }}>
        <span style={{ fontWeight: 800, fontSize: 15, color: "var(--fg)" }}>
          Export Template to Database
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-muted)",
              textTransform: "uppercase", letterSpacing: "0.06em" }}>Template name</span>
            <SmallInput value={name} onChange={setName} placeholder="Template name…" />
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

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-muted)",
              textTransform: "uppercase", letterSpacing: "0.06em" }}>Specialty</span>
            <select value={specialtyId} onChange={e => onSpecialtyChange(e.target.value)}
              style={{ background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 6, color: "var(--fg)", fontSize: 12, padding: "5px 8px",
                fontFamily: "inherit", outline: "none" }}>
              <option value="">— None —</option>
              {specialties.map(s => (
                <option key={s.id} value={String(s.id)}>{s.name}</option>
              ))}
            </select>
          </div>

          {specialtyId && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-muted)",
                textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Subspecialty {loadingSubs ? "(loading…)" : ""}
              </span>
              <select value={subspecialtyId} onChange={e => onSubspecialtyChange(e.target.value)}
                disabled={loadingSubs}
                style={{ background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: 6, color: "var(--fg)", fontSize: 12, padding: "5px 8px",
                  fontFamily: "inherit", outline: "none",
                  opacity: loadingSubs ? 0.5 : 1 }}>
                <option value="">— None —</option>
                {subspecialties.map(s => (
                  <option key={s.id} value={String(s.id)}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-muted)",
              textTransform: "uppercase", letterSpacing: "0.06em" }}>Status</span>
            <select value={status} onChange={e => setStatus(parseInt(e.target.value))}
              style={{ background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 6, color: "var(--fg)", fontSize: 12, padding: "5px 8px",
                fontFamily: "inherit", outline: "none" }}>
              <option value={0}>Inactive (0)</option>
              <option value={1}>Active (1)</option>
            </select>
          </div>
        </div>

        {error && <span style={{ fontSize: 12, color: "#dc2626" }}>Error: {error}</span>}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={actionBtn}>Cancel</button>
          <button onClick={handle} disabled={busy || !name.trim()}
            style={{ ...accentBtn, opacity: busy || !name.trim() ? 0.5 : 1 }}>
            {busy ? "Exporting…" : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SaveTemplateDialog({ onConfirm, onCancel }) {
  const [name,  setName]  = useState("");
  const [color, setColor] = useState("#000000");
  const [busy,  setBusy]  = useState(false);

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
        <span style={{ fontWeight: 800, fontSize: 15, color: "var(--fg)" }}>Save Template</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-muted)",
              textTransform: "uppercase", letterSpacing: "0.06em" }}>Template name</span>
            <SmallInput value={name} onChange={setName} placeholder="Template name…"
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

export default function TemplatePage({ specialties = [] }) {
  const [availableModules, setAvailableModules] = useState([]);
  const [savedTemplates,   setSavedTemplates]   = useState([]);
  const [templateModules,  setTemplateModules]  = useState([]);
  const [activeTemplate,   setActiveTemplate]   = useState(null);
  const [showSave,         setShowSave]         = useState(false);
  const [exportTarget,     setExportTarget]     = useState(null);
  const [exportSuccess,    setExportSuccess]    = useState(null);
  const [renamingId,       setRenamingId]       = useState(null);
  const [renameVal,        setRenameVal]        = useState("");
  const [fullscreen,       setFullscreen]       = useState(null); // null | "preview"

  const [exportSpecialtyId,    setExportSpecialtyId]    = useState("");
  const [exportSubspecialtyId, setExportSubspecialtyId] = useState("");
  const [exportSubspecialties, setExportSubspecialties] = useState([]);
  const [loadingSubs,          setLoadingSubs]          = useState(false);

  // Resizable column widths
  const [colWidths, setColWidths] = useState({ modules: 220, order: 240, templates: 220 });
  const dragState = useRef(null);

  const startDrag = (which) => (e) => {
    e.preventDefault();
    dragState.current = { which, startX: e.clientX, startWidths: { ...colWidths } };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev) => {
      const d = dragState.current;
      if (!d) return;
      const dx = ev.clientX - d.startX;
      setColWidths(w => {
        const next = { ...w };
        if (d.which === "modules")   next.modules   = Math.min(400, Math.max(160, d.startWidths.modules + dx));
        if (d.which === "order")     next.order     = Math.min(420, Math.max(180, d.startWidths.order + dx));
        if (d.which === "templates") next.templates = Math.min(400, Math.max(160, d.startWidths.templates - dx));
        return next;
      });
    };
    const onUp = () => {
      dragState.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const refreshModules   = () => listModules("module").then(setAvailableModules).catch(console.error);
  const refreshTemplates = () => listModules("template").then(setSavedTemplates).catch(console.error);

  useEffect(() => { refreshModules(); refreshTemplates(); }, []);

  const allBlocks = templateModules.flatMap(m => m.blocks || []);

  const addModuleToTemplate = async (mod) => {
    const loaded = await loadModule(mod.id);
    setTemplateModules(prev => [...prev, { ...mod, blocks: loaded.data }]);
  };

  const removeFromTemplate = (idx) => {
    setTemplateModules(prev => prev.filter((_, i) => i !== idx));
  };

  const moveInTemplate = (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= templateModules.length) return;
    const next = [...templateModules];
    [next[idx], next[target]] = [next[target], next[idx]];
    setTemplateModules(next);
  };

  const handleSaveTemplate = async (name, color) => {
    const data = templateModules.map(m => ({ id: m.id, name: m.name }));
    if (activeTemplate) {
      await updateModule(activeTemplate.id, { data, color, name });
      setActiveTemplate(t => ({ ...t, name, color }));
    } else {
      const result = await saveModule(name, data, color, "template");
      setActiveTemplate({ id: result.id, name, color });
    }
    setShowSave(false);
    await refreshTemplates();
  };

  // Overwrite — save current template order/contents back to the active template without renaming
  const handleOverwriteTemplate = async () => {
    if (!activeTemplate) return;
    if (!confirm("Overwrite this template with the current module order?")) return;
    const data = templateModules.map(m => ({ id: m.id, name: m.name }));
    await updateModule(activeTemplate.id, { data });
    await refreshTemplates();
  };

  const handleLoadTemplate = async (t) => {
    const loaded = await loadModule(t.id);
    setActiveTemplate(t);
    const moduleList = await Promise.all(
      (loaded.data || []).map(async entry => {
        try {
          const mod = await loadModule(entry.id);
          return { id: entry.id, name: entry.name, blocks: mod.data };
        } catch {
          return { id: entry.id, name: entry.name, blocks: [] };
        }
      })
    );
    setTemplateModules(moduleList);
  };

  const handleDeleteTemplate = async (id) => {
    if (!confirm("Delete this template?")) return;
    await deleteModule(id);
    if (activeTemplate?.id === id) { setActiveTemplate(null); setTemplateModules([]); }
    await refreshTemplates();
  };

  const handleRenameTemplate = async (id) => {
    if (!renameVal.trim()) return;
    await updateModule(id, { name: renameVal.trim() });
    setRenamingId(null);
    setRenameVal("");
    await refreshTemplates();
  };

  const handleSpecialtyChange = async (id) => {
    setExportSpecialtyId(id);
    setExportSubspecialtyId("");
    setExportSubspecialties([]);
    if (!id) return;
    setLoadingSubs(true);
    try {
      const subs = await fetchSubspecialties(id);
      setExportSubspecialties(Array.isArray(subs) ? subs : []);
    } catch (e) { console.error(e); }
    setLoadingSubs(false);
  };

  const resetExportState = () => {
    setExportSpecialtyId("");
    setExportSubspecialtyId("");
    setExportSubspecialties([]);
  };

  return (
    <div style={{ maxWidth: 1700, margin: "0 auto", padding: "32px 24px",
      height: "calc(100vh - 49px)", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 20, flexWrap: "wrap", gap: 16, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em",
            color: "var(--fg)", margin: 0 }}>
            Module Builder
          </h1>
          {activeTemplate && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%",
                background: activeTemplate.color || "#000", border: "1px solid var(--border)" }} />
              <span style={{ fontSize: 13, color: "var(--fg-muted)", fontWeight: 600 }}>
                {activeTemplate.name}
              </span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowSave(true)} style={accentBtn}>
            {activeTemplate ? "Save As…" : "+ Save Template"}
          </button>
          {activeTemplate && (
            <button onClick={handleOverwriteTemplate} style={actionBtn}>
              Overwrite
            </button>
          )}
          {templateModules.length > 0 && (
            <button
              onClick={() => {
                const json = JSON.stringify(allBlocks, null, 2);
                navigator.clipboard?.writeText(json);
                alert("Template JSON copied to clipboard.");
              }}
              style={actionBtn}>
              Export JSON
            </button>
          )}
          {activeTemplate && (
            <button onClick={() => { setActiveTemplate(null); setTemplateModules([]); }}
              style={{ ...actionBtn, color: "#dc2626", border: "1px solid #dc262633" }}>
              New Template
            </button>
          )}
        </div>
      </div>

      {/* Main layout */}
      <div style={{ display: "flex", gap: 0, flex: 1, minHeight: 0 }}>

        {/* ── Col 1: Available modules ── */}
        {!fullscreen && (
          <>
            <div style={{ width: colWidths.modules, flexShrink: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-muted)",
                textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 10 }}>
                Modules
              </div>
              <div style={{ flex: 1, overflowY: "auto", background: "var(--card-bg)",
                borderRadius: 12, border: "1px solid var(--border)", padding: 12,
                display: "flex", flexDirection: "column", gap: 6 }}>
                {availableModules.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--fg-muted)", textAlign: "center",
                    padding: "20px 0", opacity: 0.6 }}>
                    No modules saved yet
                  </div>
                ) : availableModules.map(m => (
                  <div key={m.id} style={{ background: "var(--surface)",
                    border: "1px solid var(--border)", borderRadius: 7,
                    padding: "7px 10px", display: "flex", alignItems: "center",
                    justifyContent: "space-between", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fg)",
                      flex: 1, minWidth: 0, overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.name}
                    </span>
                    <button onClick={() => addModuleToTemplate(m)}
                      style={{ ...accentBtn, fontSize: 10, padding: "2px 6px", flexShrink: 0 }}>
                      +
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Drag handle 1 */}
            <div onMouseDown={startDrag("modules")} style={{
              width: 12, flexShrink: 0, alignSelf: "stretch", cursor: "col-resize",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ width: 1, height: "100%", background: "var(--border)" }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--accent)"}
                onMouseLeave={e => e.currentTarget.style.background = "var(--border)"} />
            </div>
          </>
        )}

        {/* ── Col 2: Template order ── */}
        {!fullscreen && (
          <>
            <div style={{ width: colWidths.order, flexShrink: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-muted)",
                textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 10 }}>
                Template Order
              </div>
              <div style={{ flex: 1, overflowY: "auto", background: "var(--card-bg)",
                borderRadius: 12, border: "1px solid var(--border)", padding: 12,
                display: "flex", flexDirection: "column", gap: 6 }}>
                {templateModules.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "30px 12px",
                    border: "2px dashed var(--border-mid)", borderRadius: 8,
                    color: "var(--fg-muted)", fontSize: 12 }}>
                    Add modules from the left
                  </div>
                ) : templateModules.map((m, idx) => (
                  <div key={`${m.id}_${idx}`} style={{
                    background: "var(--surface)", border: "1px solid var(--border)",
                    borderRadius: 7, padding: "7px 10px",
                    display: "flex", alignItems: "center", gap: 6 }}>

                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-muted)",
                      width: 18, flexShrink: 0, textAlign: "center" }}>
                      {idx + 1}
                    </span>

                    <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                      <button onClick={() => moveInTemplate(idx, -1)} disabled={idx === 0}
                        style={{ ...moveBtn, opacity: idx === 0 ? 0.2 : 0.6 }}>↑</button>
                      <button onClick={() => moveInTemplate(idx, 1)}
                        disabled={idx === templateModules.length - 1}
                        style={{ ...moveBtn,
                          opacity: idx === templateModules.length - 1 ? 0.2 : 0.6 }}>↓</button>
                    </div>

                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fg)",
                      flex: 1, minWidth: 0, overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.name}
                    </span>

                    <button onClick={() => removeFromTemplate(idx)}
                      style={{ ...iconBtn, width: 20, height: 20,
                        color: "#dc2626", borderColor: "#dc262633", flexShrink: 0 }}>✕</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Drag handle 2 */}
            <div onMouseDown={startDrag("order")} style={{
              width: 12, flexShrink: 0, alignSelf: "stretch", cursor: "col-resize",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ width: 1, height: "100%", background: "var(--border)" }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--accent)"}
                onMouseLeave={e => e.currentTarget.style.background = "var(--border)"} />
            </div>
          </>
        )}

        {/* ── Col 3: Live preview ── */}
        {(fullscreen === null || fullscreen === "preview") && (
          <div style={{ flex: 1, minWidth: 280, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-muted)",
                textTransform: "uppercase", letterSpacing: "0.09em" }}>
                Live Preview
              </div>
              <button
                onClick={() => setFullscreen(fullscreen === "preview" ? null : "preview")}
                title={fullscreen === "preview" ? "Exit fullscreen" : "Fullscreen preview"}
                style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6,
                  cursor: "pointer", color: "var(--fg-muted)", fontSize: 12, padding: "3px 8px",
                  display: "flex", alignItems: "center", gap: 4 }}>
                {fullscreen === "preview" ? "⊠ Exit" : "⛶ Expand"}
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", overflowX: "auto",
              background: "var(--card-bg)", borderRadius: 12,
              border: "1px solid var(--border)", padding: 20 }}>
              {allBlocks.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px",
                  color: "var(--fg-muted)", fontSize: 14 }}>
                  Add modules to see a preview
                </div>
              ) : (
                <div style={{ minWidth: 320 }}>
                  {templateModules.map((m, idx) => (
                    <div key={`preview_${m.id}_${idx}`}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--fg-muted)",
                        textTransform: "uppercase", letterSpacing: "0.08em",
                        marginBottom: 8, marginTop: idx === 0 ? 0 : 20,
                        paddingBottom: 4, borderBottom: "1px solid var(--border)" }}>
                        {m.name}
                      </div>
                      <Preview blocks={m.blocks || []} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Drag handle 3 — hidden in fullscreen */}
        {!fullscreen && (
          <div onMouseDown={startDrag("templates")} style={{
            width: 12, flexShrink: 0, alignSelf: "stretch", cursor: "col-resize",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ width: 1, height: "100%", background: "var(--border)" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--accent)"}
              onMouseLeave={e => e.currentTarget.style.background = "var(--border)"} />
          </div>
        )}

        {/* ── Col 4: Saved templates ── */}
        {!fullscreen && (
          <div style={{ width: colWidths.templates, flexShrink: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-muted)",
              textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 10 }}>
              Saved Templates
            </div>
            <div style={{ flex: 1, overflowY: "auto", background: "var(--card-bg)",
              borderRadius: 12, border: "1px solid var(--border)", padding: 12,
              display: "flex", flexDirection: "column", gap: 8 }}>
              {savedTemplates.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--fg-muted)", textAlign: "center",
                  padding: "20px 0", opacity: 0.6 }}>
                  No saved templates yet
                </div>
              ) : savedTemplates.map(t => (
                <div key={t.id} style={{ background: "var(--surface)",
                  border: `1px solid ${activeTemplate?.id === t.id
                    ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 8, padding: "8px 10px",
                  display: "flex", flexDirection: "column", gap: 6 }}>

                  {renamingId === t.id ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <SmallInput value={renameVal} onChange={setRenameVal}
                        placeholder="New name…"
                        onKeyDown={e => { if (e.key === "Enter") handleRenameTemplate(t.id); }} />
                      <button onClick={() => handleRenameTemplate(t.id)} style={actionBtn}>✓</button>
                      <button onClick={() => setRenamingId(null)} style={iconBtn}>✕</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                        background: t.color || "#000000",
                        border: "1px solid var(--border)" }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--fg)",
                        flex: 1, minWidth: 0, overflow: "hidden",
                        textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.name}
                      </span>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    <button onClick={() => handleLoadTemplate(t)} style={actionBtn}>Load</button>
                    <button onClick={() => { setRenamingId(t.id); setRenameVal(t.name); }}
                      style={actionBtn}>Rename</button>
                    <button onClick={() => handleDeleteTemplate(t.id)} style={dangerBtn}>Delete</button>
                    <button
                      onClick={() => { setExportSuccess(null); resetExportState(); setExportTarget(t); }}
                      style={accentBtn}>Export</button>
                  </div>

                  {exportSuccess && exportTarget?.id === t.id && (
                    <span style={{ fontSize: 11, color: "#059669", fontWeight: 600 }}>
                      ✓ Exported — ID: {exportSuccess}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showSave && (
        <SaveTemplateDialog
          onConfirm={handleSaveTemplate}
          onCancel={() => setShowSave(false)}
        />
      )}

      {exportTarget && (
        <ExportDialog
          template={exportTarget}
          specialties={specialties}
          specialtyId={exportSpecialtyId}
          subspecialtyId={exportSubspecialtyId}
          subspecialties={exportSubspecialties}
          loadingSubs={loadingSubs}
          onSpecialtyChange={handleSpecialtyChange}
          onSubspecialtyChange={setExportSubspecialtyId}
          onConfirm={(moduleNameId) => {
            setExportSuccess(moduleNameId);
            setExportTarget(null);
            resetExportState();
          }}
          onCancel={() => { setExportTarget(null); resetExportState(); }}
        />
      )}
    </div>
  );
}