export const BASE = "http://localhost:4000";

export async function listModules(type = "module") {
  const r = await fetch(`${BASE}/modules?type=${type}`);
  return r.json();
}

export async function loadModule(id) {
  const r = await fetch(`${BASE}/modules/${id}`);
  return r.json();
}

export async function saveModule(name, data, color = "#000000", type = "module") {
  const r = await fetch(`${BASE}/modules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, data, color, type }),
  });
  return r.json();
}

export async function updateModule(id, patch) {
  const r = await fetch(`${BASE}/modules/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return r.json();
}

export async function deleteModule(id) {
  const r = await fetch(`${BASE}/modules/${id}`, { method: "DELETE" });
  return r.json();
}

// ── Lookup tables ─────────────────────────────────────────────────────────

export async function fetchValidationTypes() {
  const r = await fetch(`${BASE}/lookup/validation-types`);
  return r.json();
}

export async function fetchValidationDefinitions() {
  const r = await fetch(`${BASE}/lookup/validation-definitions`);
  return r.json();
}

export async function fetchDefinitionTypes() {
  const r = await fetch(`${BASE}/lookup/definition-types`);
  return r.json();
}

export async function fetchUnits() {
  const r = await fetch(`${BASE}/lookup/units`);
  return r.json();
}

export async function fetchElementTypes() {
  const r = await fetch(`${BASE}/lookup/element-types`);
  return r.json();
}

// Export a saved module to ritvik_ehr_module_names
export async function exportModuleToDb(id, payload) {
  const r = await fetch(`${BASE}/modules/${id}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name:           payload.name,
      color:          payload.color,
      status:         payload.status,
      specialtyId:    payload.specialtyId    ?? 0,
      subspecialtyId: payload.subspecialtyId ?? 0,
    }),
  });
  return r.json();
}

// Save color against a ritvik_modules record
export async function updateModuleColor(id, color) {
  const r = await fetch(`${BASE}/modules/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ color }),
  });
  return r.json();
}

// Fetch specialities
export async function fetchSpecialties() {
  const r = await fetch(`${BASE}/lookup/specialties`);
  return r.json();
}

// Fetch sub-specialities
export async function fetchSubspecialties(specialtyId = null) {
  const url = specialtyId
    ? `${BASE}/lookup/subspecialties?specialty_id=${specialtyId}`
    : `${BASE}/lookup/subspecialties`;
  const r = await fetch(url);
  return r.json();
}

export async function fetchValidationTypeDetails() {
  const r = await fetch(`${BASE}/lookup/validation-type-details`);
  return r.json();
}

// ── Recall ────────────────────────────────────────────────────────────────

export async function fetchRecallModules() {
  const r = await fetch(`${BASE}/recall/modules`);
  return r.json();
}

export async function deleteRecallDefinition(uin) {
  const r = await fetch(`${BASE}/recall/definitions/${uin}`, { method: "DELETE" });
  return r.json();
}

export async function deleteRecallAttribute(uin) {
  const r = await fetch(`${BASE}/recall/attributes/${uin}`, { method: "DELETE" });
  return r.json();
}

export async function saveRecallChanges(moduleNameId, added, deleted) {
  const r = await fetch(`${BASE}/recall/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ moduleNameId, added, deleted }),
  });
  return r.json();
}

export async function patchRecallRelativePosition(uin, relativePosition) {
  const r = await fetch(`${BASE}/recall/definitions/${uin}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ relative_position: relativePosition }),
  });
  return r.json();
}

export async function patchRecallAttrRelativePosition(uin, relativePosition) {
  const r = await fetch(`${BASE}/recall/attributes/${uin}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ relative_position: relativePosition }),
  });
  return r.json();
}

export async function toggleRecallAttrStatus(uin, status) {
  const r = await fetch(`${BASE}/recall/attributes/${uin}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  return r.json();
}

export async function fetchRecallModule(id) {
  const r = await fetch(`${BASE}/recall/modules/${id}`);
  return r.json();
}

export async function fetchValidationEntries(attrUin) {
  const r = await fetch(`${BASE}/recall/validation-entries/${attrUin}`);
  return r.json();
}

export async function toggleValidationEntryStatus(id, status) {
  const r = await fetch(`${BASE}/recall/validation-entries/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  return r.json();
}

export async function addValidationEntry(attrUin, description, validationTypeDetailsId) {
  const r = await fetch(`${BASE}/recall/validation-entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attrUin, description, validationTypeDetailsId }),
  });
  return r.json();
}

export async function toggleRecallDefStatus(uin, status) {
  const r = await fetch(`${BASE}/recall/definitions/${uin}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  return r.json();
}

export async function updateRecallColumnConstraint(attrUin, data) {
  const r = await fetch(`${BASE}/recall/column-constraint/${attrUin}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return r.json();
}

export async function moveRecallTableRow(defUin, fromRow, toRow) {
  const r = await fetch(`${BASE}/recall/table/${defUin}/move-row`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fromRow, toRow }),
  });
  return r.json();
}

export async function moveRecallTableCol(defUin, fromCol, toCol) {
  const r = await fetch(`${BASE}/recall/table/${defUin}/move-col`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fromCol, toCol }),
  });
  return r.json();
}

export async function toggleRecallTableRowStatus(defUin, rowNum, status) {
  const r = await fetch(`${BASE}/recall/table/${defUin}/row-status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rowNum, status }),
  });
  return r.json();
}

export async function toggleRecallTableColStatus(defUin, colNum, status) {
  const r = await fetch(`${BASE}/recall/table/${defUin}/col-status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ colNum, status }),
  });
  return r.json();
}
