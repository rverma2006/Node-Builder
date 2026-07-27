// Front page to interact with the module builder. This is the main entry point for the app.
import { useState, useRef, useCallback, useEffect } from "react";
import { TYPES, TYPE_COLORS } from "./constants";
import { makeBlock } from "./utils/factories";
import {
  treeMap,
  treeFilter,
  treeMoveInList,
  treeAddToBlock,
  treeAddToButton,
  treeAddToOption,
  treeAddToBullet,
} from "./utils/treeHelpers";

import BlockCard from "./components/BlockCard";
import Preview from "./components/preview/Preview";
import ExportModal from "./components/ExportModal";
import ModuleManager from "./components/ModuleManager";
import useLookups from "./hooks/useLookups";


export default function ModuleBuilder() {
  // Stores the entire module tree.
  const [blocks, setBlocks] = useState([]);
  // Used when clicking "+ Add Block".
  const [activeType, setActiveType] = useState("radio");
  // Not used anymore
  const [tab, setTab] = useState("build");
  // Controls ExportModal visibility. Now in backend
  const [showExport, setShowExport] = useState(false);
  // null | "builder" | "preview" — which panel is fullscreen
  const [fullscreen, setFullscreen] = useState(null);
  // Lookup tables for validation types, definitions, and definition types
  const { validationTypes, validationDefinitions, definitionTypes, units, elementTypes, specialties, loading: lookupsLoading } = useLookups();
  // Tracks the currently loaded module (id, name, color) — shown as indicator near title
  const [activeModule, setActiveModule] = useState(null);


  /**
   * Create a new root-level block.
   */
  const addRootBlock = () =>
    setBlocks(bs => [...bs, makeBlock(activeType)]);

  /**
   * Update a block anywhere in the tree.
   */
  const updateBlock = (id, patch) =>
    setBlocks(bs => treeMap(bs, id, b => ({ ...b, ...patch })));

  /**
   * Remove a block from the tree.
   */
  const removeBlock = id =>
    setBlocks(bs => treeFilter(bs, id));

  /**
   * Move a block up or down in its parent's list.
   */
  const moveBlock = (id, dir) =>
    setBlocks(bs => treeMoveInList(bs, id, dir));

  /**
   * Add a new block to an existing block.
   */
  const addToBlock = (parentId, type) =>
    setBlocks(bs => treeAddToBlock(bs, parentId, makeBlock(type)));

  /**
   * Add a nested block inside an existing button.
   */
  const addToButton = (blockId, btnId, type) =>
    setBlocks(bs => treeAddToButton(bs, blockId, btnId, makeBlock(type)));

  /**
   * Add a nested block inside an existing dropdown option.
   */
  const addToOption = (blockId, optId, type) =>
    setBlocks(bs => treeAddToOption(bs, blockId, optId, makeBlock(type)));


  /**
   * Add a nested block inside an existing bullet item.
   */
  const addToBullet = (blockId, bulletId, type) =>
    setBlocks(bs => treeAddToBullet(bs, blockId, bulletId, makeBlock(type)));


  // Resizable panel widths
  const [moduleWidth, setModuleWidth] = useState(240);
  const [builderWidth, setBuilderWidth] = useState(400);
  const containerRef = useRef(null);
  const dragState = useRef(null); // { which: "module" | "builder", startX, startModuleWidth, startBuilderWidth }

  const startDrag = (which) => (e) => {
    e.preventDefault();
    dragState.current = {
      which,
      startX: e.clientX,
      startModuleWidth: moduleWidth,
      startBuilderWidth: builderWidth,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev) => {
      const d = dragState.current;
      if (!d) return;
      const dx = ev.clientX - d.startX;

      if (d.which === "module") {
        const next = Math.min(480, Math.max(160, d.startModuleWidth + dx));
        setModuleWidth(next);
      }
      if (d.which === "builder") {
        const next = Math.min(900, Math.max(280, d.startBuilderWidth + dx));
        setBuilderWidth(next);
      }
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


  return (
    <>
      {showExport && (
        <ExportModal
          blocks={blocks}
          onClose={() => setShowExport(false)}
          onClear={() => { setBlocks([]); setShowExport(false); setActiveModule(null); }}
          validationTypes={validationTypes}
          validationDefinitions={validationDefinitions}
          definitionTypes={definitionTypes}
          units={units}
        />
      )}


      <div style={{ maxWidth: 1600, margin: "0 auto", padding: "32px 24px" }}>

        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center",
          justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800,
              letterSpacing: "-0.03em", color: "var(--fg)", margin: 0 }}>
              Element Builder
            </h1>
            {activeModule && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%",
                  background: activeModule.color || "#000", border: "1px solid var(--border)" }} />
                <span style={{ fontSize: 13, color: "var(--fg-muted)", fontWeight: 600 }}>
                  {activeModule.name}
                </span>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setShowExport(true)}
              style={{ padding: "8px 18px", borderRadius: 8, fontWeight: 600,
                fontSize: 13, cursor: "pointer", border: "1px solid var(--border)",
                background: "var(--card-bg)", color: "var(--fg-muted)" }}>
              Export JSON
            </button>
            <button
              onClick={() => {
                if (blocks.length === 0) return;
                if (!confirm("Clear the canvas? This cannot be undone.")) return;
                setBlocks([]);
                setActiveModule(null);
              }}
              style={{ padding: "8px 18px", borderRadius: 8, fontWeight: 600,
                fontSize: 13, cursor: "pointer", border: "1px solid #dc262633",
                background: "transparent", color: "#dc2626" }}>
              Clear
            </button>
          </div>
        </div>

        {/* Side by side layout */}
        <div ref={containerRef} style={{ display: "flex", gap: 0, alignItems: "flex-start", height: "calc(100vh - 140px)" }}>

          {/* ── Modules panel — hidden when anything is fullscreen ── */}
          {!fullscreen && (
            <>
              <div style={{ width: moduleWidth, flexShrink: 0, height: "100%", display: "flex", flexDirection: "column", paddingRight: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-muted)",
                  textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 12, flexShrink: 0 }}>
                  Modules
                </div>
                <div style={{ flex: 1, overflowY: "auto", background: "var(--card-bg)", borderRadius: 12,
                  border: "1px solid var(--border)", padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                  <ModuleManager
                    blocks={blocks}
                    onLoad={setBlocks}
                    activeModule={activeModule}
                    setActiveModule={setActiveModule}
                  />
                </div>
              </div>

              {/* Drag handle: Modules ↔ Builder */}
              <div onMouseDown={startDrag("module")} style={{
                width: 12, flexShrink: 0, alignSelf: "stretch", cursor: "col-resize",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{ width: 1, height: "100%", background: "var(--border)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--accent)"}
                  onMouseLeave={e => e.currentTarget.style.background = "var(--border)"} />
              </div>
            </>
          )}

          {/* ── Build panel ── */}
          {(fullscreen === null || fullscreen === "builder") && (
            <div style={{
              flex: fullscreen === "builder" ? 1 : undefined,
              width: fullscreen === "builder" ? undefined : builderWidth,
              flexShrink: 0,
              minWidth: 280, height: "100%", display: "flex", flexDirection: "column", paddingRight: 12,
            }}>
              {/* Panel header row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: 12, flexShrink: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-muted)",
                  textTransform: "uppercase", letterSpacing: "0.09em" }}>
                  Builder
                </div>
                <button
                  onClick={() => setFullscreen(fullscreen === "builder" ? null : "builder")}
                  title={fullscreen === "builder" ? "Exit fullscreen" : "Fullscreen builder"}
                  style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6,
                    cursor: "pointer", color: "var(--fg-muted)", fontSize: 12, padding: "3px 8px",
                    display: "flex", alignItems: "center", gap: 4 }}>
                  {fullscreen === "builder" ? "⊠ Exit" : "⛶ Expand"}
                </button>
              </div>

              {/* Toolbar */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
                background: "var(--card-bg)", borderRadius: 10, padding: "12px 16px",
                border: "1px solid var(--border)", marginBottom: 16, flexShrink: 0,
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-muted)",
                  textTransform: "uppercase", letterSpacing: "0.09em", marginRight: 4 }}>
                  Add block
                </span>
                {TYPES.map(t => (
                  <button key={t.value} onClick={() => setActiveType(t.value)}
                    style={{ padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                      cursor: "pointer", border: "1px solid",
                      borderColor: activeType === t.value ? TYPE_COLORS[t.value] : "var(--border)",
                      background: activeType === t.value ? `${TYPE_COLORS[t.value]}10` : "transparent",
                      color: activeType === t.value ? TYPE_COLORS[t.value] : "var(--fg-muted)",
                      display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s" }}>
                    <span>{t.icon}</span>{t.label}
                  </button>
                ))}
                <button onClick={addRootBlock}
                  style={{ marginLeft: "auto", padding: "8px 20px", borderRadius: 8,
                    background: "var(--accent)", color: "#fff", border: "none",
                    fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  + Add Block
                </button>
              </div>

              {/* Scrollable block list */}
              <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
                {blocks.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "56px 20px",
                    border: "2px dashed var(--border-mid)", borderRadius: 14,
                    color: "var(--fg-muted)", fontSize: 14 }}>
                    Select a type and click <strong style={{ color: "var(--fg)" }}>+ Add Block</strong> to begin.
                    <br />
                    <span style={{ fontSize: 12, marginTop: 6, display: "block", opacity: 0.7 }}>
                      Open a block · then use <strong>⊞ nest</strong> on any button to add nested blocks
                    </span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 24 }}>
                    {blocks.map((block, i) => (
                      <BlockCard key={block.id} block={block} index={i} total={blocks.length}
                        depth={0} onUpdate={updateBlock} onRemove={removeBlock} onMove={moveBlock}
                        onAddToBlock={addToBlock} onAddToButton={addToButton}
                        onAddToOption={addToOption} onAddToBullet={addToBullet}
                        units={units} validationTypes={validationTypes}
                        validationDefinitions={validationDefinitions} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Drag handle: Builder ↔ Preview — hidden when anything is fullscreen */}
          {!fullscreen && (
            <div onMouseDown={startDrag("builder")} style={{
              width: 12, flexShrink: 0, alignSelf: "stretch", cursor: "col-resize",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ width: 1, height: "100%", background: "var(--border)" }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--accent)"}
                onMouseLeave={e => e.currentTarget.style.background = "var(--border)"} />
            </div>
          )}

          {/* ── Preview panel ── */}
          {(fullscreen === null || fullscreen === "preview") && (
            <div style={{ flex: 1, minWidth: 280, height: "100%", display: "flex", flexDirection: "column" }}>
              {/* Panel header row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: 12, flexShrink: 0 }}>
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

              {/* Scrollable preview — both axes */}
              <div style={{ flex: 1, overflowY: "auto", overflowX: "auto", background: "var(--card-bg)",
                borderRadius: 12, border: "1px solid var(--border)", padding: 20,
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                <div style={{ minWidth: 320, width: "100%" }}>
                  <Preview blocks={blocks} />
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}