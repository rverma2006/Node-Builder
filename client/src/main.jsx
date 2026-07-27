import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import ModuleBuilder from "./App";
import TemplatePage from "./pages/TemplatePage";
import RecallPage from "./pages/RecallPage";
import useLookups from "./hooks/useLookups";
import "./index.css";

function Root() {
  const [page, setPage] = useState("builder");
  const { specialties } = useLookups();

  return (
    <>
      <div style={{ borderBottom: "1px solid var(--border)", background: "var(--card-bg)",
        padding: "0 24px", display: "flex", gap: 0 }}>
        {[
          { key: "builder",  label: "Element Builder" },
          { key: "template", label: "Module Builder"  },
          { key: "recall",   label: "Recall"          },
        ].map(tab => (
          <button key={tab.key} onClick={() => setPage(tab.key)} style={{
            padding: "12px 20px", border: "none", background: "none",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
            color: page === tab.key ? "var(--accent)" : "var(--fg-muted)",
            borderBottom: page === tab.key ? "2px solid var(--accent)" : "2px solid transparent",
            marginBottom: -1,
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {page === "builder"  && <ModuleBuilder />}
      {page === "template" && <TemplatePage specialties={specialties} />}
      {page === "recall"   && <RecallPage />}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);