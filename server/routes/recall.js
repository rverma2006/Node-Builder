const express = require("express");
const router  = express.Router();
const { QueryTypes, Op } = require("sequelize");
const sequelize = require("../db");

const RitvikModuleElementsDef  = require("../models/RitvikModuleElementsDef");
const RitvikModuleElementsAttr = require("../models/RitvikModuleElementsAttr");
const RitvikAttrValidationEntries = require("../models/RitvikAttrValidationEntries");
const RitvikSignificantEntries = require("../models/RitvikSignificantEntries");


// Recursively set status on all nested defs and attrs under a button attr uin
async function cascadeAttrStatus(attrUin, status, now) {
  // Find all attrs whose nesting path contains this attrUin as a segment
  // Patterns: "4.1", "4.1.2", "4.1.2.3" etc.
  const allAttrs = await sequelize.query(
    `SELECT * FROM ritvik_ehr_module_elements_attributes
     WHERE attrib_nesting_id LIKE :patternStart
        OR attrib_nesting_id LIKE :patternMid
        OR attrib_nesting_id = :exact`,
    {
      replacements: {
        patternStart: `${attrUin}.%`,       // starts with attrUin (e.g. "1.2.3")
        patternMid:   `%.${attrUin}.%`,     // contains .attrUin. in middle
        exact:        `${attrUin}`,          // exact match (shouldn't cascade itself but safe)
      },
      type: QueryTypes.SELECT,
    }
  );

  // Also find attrs ending with .attrUin
  const endAttrs = await sequelize.query(
    `SELECT * FROM ritvik_ehr_module_elements_attributes
     WHERE attrib_nesting_id LIKE :patternEnd`,
    {
      replacements: { patternEnd: `%.${attrUin}` },
      type: QueryTypes.SELECT,
    }
  );

  const allChildAttrs  = [...allAttrs, ...endAttrs];
  const seenAttrUins   = new Set();
  const seenDefUins    = new Set();

  for (const attr of allChildAttrs) {
    if (seenAttrUins.has(attr.uin)) continue;
    seenAttrUins.add(attr.uin);

    await RitvikModuleElementsAttr.update(
      { status, modified_date: now },
      { where: { uin: attr.uin } }
    );

    const defUin = attr.ehr_module_elements_definition_uin;
    if (!seenDefUins.has(defUin)) {
      seenDefUins.add(defUin);
      await RitvikModuleElementsDef.update(
        { status, modified_date: now },
        { where: { uin: defUin } }
      );
    }
  }
}

// GET /recall/modules
router.get("/modules", async (req, res) => {
  try {
    const rows = await sequelize.query(
      `SELECT id, module_name, module_color, module_specialty, module_subspecialty, module_status
       FROM ritvik_ehr_module_names
       WHERE module_status != 2
       ORDER BY id DESC`,
      { type: QueryTypes.SELECT }
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /recall/modules/:id
router.get("/modules/:id", async (req, res) => {
  try {
    const moduleNameId = req.params.id;
    const definitions = await sequelize.query(
      `SELECT * FROM ritvik_ehr_module_elements_definitions
       WHERE ehr_module_names_id = :moduleNameId
       ORDER BY nesting_id, relative_position`,
      { replacements: { moduleNameId }, type: QueryTypes.SELECT }
    );
    const attributes = await sequelize.query(
      `SELECT a.* FROM ritvik_ehr_module_elements_attributes a
       JOIN ritvik_ehr_module_elements_definitions d
         ON a.ehr_module_elements_definition_uin = d.uin
       WHERE d.ehr_module_names_id = :moduleNameId
       ORDER BY a.attrib_nesting_id, a.relative_position`,
      { replacements: { moduleNameId }, type: QueryTypes.SELECT }
    );
    // Only fetch validation entries for attributes with validation = 1
    const validationAttrUins = attributes
      .filter(a => a.validation === 1)
      .map(a => a.uin);

    let validationEntries = [];
  if (validationAttrUins.length > 0) {
    validationEntries = await sequelize.query(
      `SELECT * FROM ritvik_ehr_attribute_validation_entries
       WHERE module_elements_attribute_uin IN (:attrUins)
       ORDER BY module_elements_attribute_uin, id`,
      { replacements: { attrUins: validationAttrUins }, type: QueryTypes.SELECT }
    );
  }

  const allAttrUins = attributes.map(a => a.uin);
  let significantEntries = [];
  if (allAttrUins.length > 0) {
    significantEntries = await sequelize.query(
      `SELECT se.*,
              vtd.description AS comparator_description,
              vtdt.description AS role_description
       FROM ritvik_ehr_significant_entries se
       LEFT JOIN ehr_attribute_validation_type_details d
         ON d.id = se.attribute_validation_type_details_id
       LEFT JOIN ehr_attribute_validation_type_definitions vtd
         ON vtd.id = d.validation_type_definition_id
       LEFT JOIN ehr_attribute_validation_type_definition_types vtdt
         ON vtdt.id = d.validation_type_definition_types_id
       WHERE se.module_elements_attribute_uin IN (:attrUins)
       AND se.status != 2
       ORDER BY se.module_elements_attribute_uin, se.id`,
      { replacements: { attrUins: allAttrUins }, type: QueryTypes.SELECT }
    );
  }

  res.json({ definitions, attributes, validationEntries, significantEntries });
  } catch (err) {
    console.error("Recall module detail error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /recall/definitions/:uin — soft delete definition + its attributes
router.delete("/definitions/:uin", async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const now = new Date();
    const uin = req.params.uin;
    await RitvikModuleElementsDef.update(
      { status: 2, modified_date: now },
      { where: { uin }, transaction: t }
    );
    await RitvikModuleElementsAttr.update(
      { status: 2, modified_date: now },
      { where: { ehr_module_elements_definition_uin: uin }, transaction: t }
    );
    await t.commit();
    res.json({ ok: true });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: err.message });
  }
});

// Soft delete
router.delete("/attributes/:uin", async (req, res) => {
  try {
    await RitvikModuleElementsAttr.update(
      { status: 2, modified_date: new Date() },
      { where: { uin: req.params.uin } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /recall/save — save added/deleted blocks back to DB
// Body: { moduleNameId, added: [{block tree}], deleted: [{uin, isAttr}] }
router.post("/save", async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { moduleNameId, added, deleted } = req.body;

    // Build validation type details lookup
    const vtDetailsRows = await sequelize.query(
      `SELECT id, validation_type_id, validation_type_definition_id,
              validation_type_definition_types_id
       FROM ehr_attribute_validation_type_details`,
      { type: QueryTypes.SELECT, transaction: t }
    );
    const vtDetailsMap = {};
    for (const row of vtDetailsRows) {
      const key = `${row.validation_type_id}_${row.validation_type_definition_id}_${row.validation_type_definition_types_id}`;
      vtDetailsMap[key] = row.id;
    }
    const vtRows = await sequelize.query(
      "SELECT id, description FROM ehr_attribute_validation_types",
      { type: QueryTypes.SELECT, transaction: t }
    );
    const vtByDesc = {};
    for (const row of vtRows) vtByDesc[row.description?.toLowerCase()] = row.id;

    const vdRows = await sequelize.query(
      "SELECT id, description FROM ehr_attribute_validation_type_definitions",
      { type: QueryTypes.SELECT, transaction: t }
    );
    const vdByDesc = {};
    for (const row of vdRows) vdByDesc[row.description?.toLowerCase()] = row.id;

    const VD_TYPE = { minimum: 1, maximum: 2, value: 3 };

    function getDetailsId(typeName, definitionName, definitionTypeName) {
      const typeId       = vtByDesc[typeName?.toLowerCase()]          || 0;
      const definitionId = vdByDesc[definitionName?.toLowerCase()]    || 0;
      const defTypeId    = VD_TYPE[definitionTypeName?.toLowerCase()] || 0;
      if (!typeId || !definitionId || !defTypeId) return 0;
      return vtDetailsMap[`${typeId}_${definitionId}_${defTypeId}`] || 0;
    }

    async function insertTextboxValidationEntries(tb, attrUin) {
      const kind       = tb.kind || "text";
      const constraint = tb.constraint;
      const kindToTypeName = {
        "int":   "whole number", "float": "decimal",
        "date":  "date",         "time":  "time", "text": "text length",
      };
      const constraintToDefName = {
        "between":    "between",          "notbetween": "not between",
        "eq":         "equal to",         "neq":        "not equal to",
        "gt":         "greater than",     "gte":        "greater than or equal to",
        "lt":         "less than",        "lte":        "less than or equal to",
      };
      const typeName = kindToTypeName[kind];
      let inserted = false;

      if ((kind === "int" || kind === "float" || kind === "decimal"
           || kind === "date" || kind === "time")
          && constraint && constraint !== "none" && tb.constraintA) {
        const defName = constraintToDefName[constraint];
        if (constraint === "between" || constraint === "notbetween") {
          await RitvikAttrValidationEntries.create({
            module_elements_attribute_uin:        attrUin,
            attribute_validation_type_details_id: getDetailsId(typeName, defName, "minimum"),
            description: tb.constraintA || "", flag: 0, query: "", status: 1,
            created_date: now, modified_date: now,
          }, { transaction: t });
          await RitvikAttrValidationEntries.create({
            module_elements_attribute_uin:        attrUin,
            attribute_validation_type_details_id: getDetailsId(typeName, defName, "maximum"),
            description: tb.constraintB || "", flag: 0, query: "", status: 1,
            created_date: now, modified_date: now,
          }, { transaction: t });
        } else {
          await RitvikAttrValidationEntries.create({
            module_elements_attribute_uin:        attrUin,
            attribute_validation_type_details_id: getDetailsId(typeName, defName, "value"),
            description: tb.constraintA || "", flag: 0, query: "", status: 1,
            created_date: now, modified_date: now,
          }, { transaction: t });
        }
        inserted = true;
      } else if (kind === "text" && tb.maxLength > 0) {
        await RitvikAttrValidationEntries.create({
          module_elements_attribute_uin:        attrUin,
          attribute_validation_type_details_id: getDetailsId("text length", "less than or equal to", "value"),
          description: String(tb.maxLength), flag: 0, query: "", status: 1,
          created_date: now, modified_date: now,
        }, { transaction: t });
        inserted = true;
      }
      if (inserted) {
        await RitvikModuleElementsAttr.update(
          { validation: 1, modified_date: now },
          { where: { uin: attrUin }, transaction: t }
        );
      }
      return inserted;
    }

    const elementRows = await sequelize.query(
      "SELECT id, type FROM ehr_module_elements",
      { type: QueryTypes.SELECT, transaction: t }
    );
    const elementTypeMap = {};
    for (const row of elementRows) elementTypeMap[row.type] = row.id;

    const BLOCK_TYPE_TO_ELEMENT_ID = {
      textbox:     elementTypeMap["Input box"]       || 1,
      header:      elementTypeMap["Section Header"]  || 2,
      richtext:    elementTypeMap["Text"]            || 3,
      radio:       elementTypeMap["Radio Button"]    || 4,
      multiselect: elementTypeMap["Multi-selection"] || 5,
      table:       elementTypeMap["Table"]           || 6,
      breakline:   elementTypeMap["Break Element"]   || 7,
      bullets:     elementTypeMap["Bullets Items"]   || 8,
      dropdown:    elementTypeMap["Input box"]       || 1,
    };


  async function insertSignificantEntries(attrUin, kind, entries) {
    const now = new Date();
    const kindToTypeName = {
      "int": "whole number", "float": "decimal", "decimal": "decimal",
      "date": "date", "time": "time",
    };
    const constraintToDefName = {
      "between":    "between",          "notbetween": "not between",
      "eq":         "equal to",         "neq":        "not equal to",
      "gt":         "greater than",     "gte":        "greater than or equal to",
      "lt":         "less than",        "lte":        "less than or equal to",
    };
    const typeName = kindToTypeName[kind];
    if (!typeName) return;

    for (const entry of (entries || [])) {
      const comparator = entry.comparator;
      const defName     = constraintToDefName[comparator];
      if (!defName) continue;

      if (comparator === "between" || comparator === "notbetween") {
        if (!String(entry.valueA ?? "").trim() || !String(entry.valueB ?? "").trim()) continue;
        await RitvikSignificantEntries.create({
          module_elements_attribute_uin:        attrUin,
          attribute_validation_type_details_id: getDetailsId(typeName, defName, "minimum"),
          description: String(entry.valueA), status: 1,
          created_date: now, modified_date: now,
        }, { transaction: t });
        await RitvikSignificantEntries.create({
          module_elements_attribute_uin:        attrUin,
          attribute_validation_type_details_id: getDetailsId(typeName, defName, "maximum"),
          description: String(entry.valueB), status: 1,
          created_date: now, modified_date: now,
        }, { transaction: t });
      } else {
        if (!String(entry.valueA ?? "").trim()) continue;
        await RitvikSignificantEntries.create({
          module_elements_attribute_uin:        attrUin,
          attribute_validation_type_details_id: getDetailsId(typeName, defName, "value"),
          description: String(entry.valueA), status: 1,
          created_date: now, modified_date: now,
        }, { transaction: t });
      }
    }
  }

    async function setUin(model, id) {
      await model.update({ uin: id }, { where: { id }, transaction: t });
      return id;
    }

    async function insertDef({ nestingId, elementId, question, columnCount, rowCount, position, groupId, layout }) {
      const now = new Date();
      const row = await RitvikModuleElementsDef.create({
        uin: 0, nesting_id: nestingId, group_id: groupId || 0,
        ehr_module_elements_id: elementId, options: 0,
        ehr_module_names_id: moduleNameId,
        question: question || "", question_type: layout === "top" ? "1" : "0",
        column_count: columnCount || 1, row_count: rowCount || 1,
        relative_position: position || 0,
        active_status: 1, table_type: 0, valid_button: 0, fill_view: 0, status: 1,
        created_by: 0, modified_by: 0, created_date: now, modified_date: now,
      }, { transaction: t });
      return setUin(RitvikModuleElementsDef, row.id);
    }

    async function insertAttr({ attribNestingId, definitionUin, attributeName, attributeHeading, attributeValue, unit, position, validation = 0 }) {
      const now = new Date();
      const row = await RitvikModuleElementsAttr.create({
        uin: 0,
        attrib_nesting_id:                  attribNestingId,
        ehr_module_elements_definition_uin: definitionUin,
        flag: 0, map: 0,
        attribute_name:    attributeName    || "",
        attribute_heading: attributeHeading || "",
        attribute_value:   attributeValue   || "",
        validation: validation, unit: unit || 0, value_characters: 0,
        relative_position: position || 0, status: 1,
        created_by: 0, modified_by: 0, created_date: now, modified_date: now,
      }, { transaction: t });
      return setUin(RitvikModuleElementsAttr, row.id);
    }

    // Swap all attrs matching two patterns (for move row/col)
    async function swapAttrNames(pattern1Attrs, pattern2Attrs) {
      // Temporarily rename to avoid unique conflicts
      for (const a of pattern1Attrs) {
        await RitvikModuleElementsAttr.update(
          { attribute_name: `TEMP_${a.attribute_name}`, modified_date: now },
          { where: { uin: a.uin }, transaction: t }
        );
      }
      for (const a of pattern2Attrs) {
        await RitvikModuleElementsAttr.update(
          { attribute_name: pattern1Attrs.find(p =>
              p.attribute_name.replace(/R\d+/, '') === a.attribute_name.replace(/R\d+/, '') ||
              p.attribute_name.replace(/C\d+/, '') === a.attribute_name.replace(/C\d+/, '')
            )?.attribute_name || a.attribute_name,
            modified_date: now },
          { where: { uin: a.uin }, transaction: t }
        );
      }
      for (const a of pattern1Attrs) {
        await RitvikModuleElementsAttr.update(
          { attribute_name: a.attribute_name.replace('TEMP_', ''), modified_date: now },
          { where: { uin: a.uin }, transaction: t }
        );
      }
    }

    async function insertBlockDef(block, nestingId, elementId, position) {
      const question =
        block.type === "textbox" && (block.textboxes || []).length === 1
          ? (block.textboxes[0].question || "")
          : block.type === "header" || block.type === "richtext"
          ? (block.content || block.title || "")
          : (block.type === "radio" || block.type === "multiselect"
            || block.type === "dropdown" || block.type === "table")
          ? (block.title || "")
          : "";
      return insertDef({
        nestingId, elementId, question,
        columnCount:
          block.type === "radio" || block.type === "multiselect" ? (block.grid?.cols || 1)
          : block.type === "table"   ? (block.table?.cols  || 1)
          : block.type === "textbox" ? (block.textboxCols  || 1)
          : block.type === "bullets" ? (block.bulletCols   || 1) : 1,
        rowCount:
          block.type === "radio" || block.type === "multiselect" ? (block.grid?.rows || 1)
          : block.type === "table"   ? (block.table?.rows  || 1)
          : block.type === "textbox" ? (block.textboxRows  || 1)
          : block.type === "bullets" ? (block.bulletRows   || 1) : 1,
        position,
      });
    }

    async function processBlockAttribs(block, defUin, sectionUin, nestingPath) {
      if (block.type === "textbox") {
        const textboxes = block.textboxes || [];
        const elementId = BLOCK_TYPE_TO_ELEMENT_ID["textbox"];
        await RitvikModuleElementsDef.update(
          { nesting_id: defUin, column_count: block.textboxCols || 1, row_count: block.textboxRows || 1 },
          { where: { id: defUin }, transaction: t }
        );
        for (let j = 0; j < textboxes.length; j++) {
          const tb = textboxes[j];
          const tbDefUin = await insertDef({
            nestingId: defUin, elementId,
            question: tb.question || "", columnCount: 1, rowCount: 1, position: j + 1,
          });
          await insertAttr({
            attribNestingId: `${defUin}`, definitionUin: tbDefUin,
            attributeName: "", unit: tb.unitId || 0, position: j + 1,
          });
        }
      } else if (block.type === "radio" || block.type === "multiselect") {
        const total = (block.grid?.rows || 0) * (block.grid?.cols || 0);
        const buttons = (block.buttons || []).slice(0, total);
        for (let j = 0; j < buttons.length; j++) {
          const btn = buttons[j];
          const btnAttrUin = await insertAttr({
            attribNestingId: nestingPath, definitionUin: defUin,
            attributeName: btn.name || "", unit: 0, position: j + 1,
          });
          if ((btn.children || []).length > 0) {
            await processChildBlocks(btn.children, sectionUin, `${nestingPath}.${btnAttrUin}`);
          }
        }
      } else if (block.type === "bullets") {
        const bullets = block.bullets || [];
        for (let j = 0; j < bullets.length; j++) {
          const bullet = bullets[j];
          const bulletDefUin = await insertDef({
            nestingId: sectionUin, elementId: BLOCK_TYPE_TO_ELEMENT_ID["bullets"],
            question: bullet.text || "", columnCount: 1, rowCount: 1, position: j + 1,
          });
          await insertAttr({
            attribNestingId: `${sectionUin}`, definitionUin: bulletDefUin,
            attributeName: "", unit: 0, position: j + 1,
          });
          if ((bullet.children || []).length > 0) {
            await processChildBlocks(bullet.children, sectionUin, `${nestingPath}.${bulletDefUin}`);
          }
        }
      } else if (block.type === "table") {
        const cols  = block.table?.cols  || 0;
        const cells = block.table?.cells || [];
        for (let c = 0; c < cols; c++) {
          const headerText = block.table?.headerRow ? (cells[0]?.[c] || "") : "";
          await insertAttr({
            attribNestingId: `${sectionUin}`, definitionUin: defUin,
            attributeName: `R1C${c + 1}`, attributeHeading: headerText,
            unit: 0, position: c + 1,
          });
        }
      } else if (block.type === "header" || block.type === "richtext") {
        await insertAttr({
          attribNestingId: `${sectionUin}`, definitionUin: defUin,
          attributeName: block.content || block.title || "", unit: 0, position: 1,
        });
      }
    }

    async function processChildBlocks(blocks, sectionUin, nestingPath) {
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        if (block.type === "breakline") continue;
        if (block.type === "bullets") {
          const bullets = block.bullets || [];
          for (let j = 0; j < bullets.length; j++) {
            const bullet = bullets[j];
            const bulletDefUin = await insertDef({
              nestingId: sectionUin, elementId: BLOCK_TYPE_TO_ELEMENT_ID["bullets"],
              question: bullet.text || "", columnCount: 1, rowCount: 1, position: j + 1,
            });
            await insertAttr({
              attribNestingId: nestingPath, definitionUin: bulletDefUin,
              attributeName: "", unit: 0, position: j + 1,
            });
            if ((bullet.children || []).length > 0) {
              await processChildBlocks(bullet.children, sectionUin, `${nestingPath}.${bulletDefUin}`);
            }
          }
          continue;
        }
        if (block.type === "textbox") {
          const elementId = BLOCK_TYPE_TO_ELEMENT_ID["textbox"];
          const textboxes = block.textboxes || [];
          const containerDefUin = await insertDef({
            nestingId: sectionUin, elementId,
            question: block.title || "",
            columnCount: block.textboxCols || 1,
            rowCount: block.textboxRows || 1,
            position: i,
          });
          for (let j = 0; j < textboxes.length; j++) {
            const tb = textboxes[j];
            const tbDefUin = await insertDef({
              nestingId: containerDefUin, elementId,
              question: tb.question || "", columnCount: 1, rowCount: 1, position: j + 1,
            });
            await insertAttr({
              attribNestingId: `${containerDefUin}`, definitionUin: tbDefUin,
              attributeName: "", unit: tb.unitId || 0, position: j + 1,
            });
          }
          continue;
        }
        const elementId = BLOCK_TYPE_TO_ELEMENT_ID[block.type] || 1;
        const defUin = await insertBlockDef(block, sectionUin, elementId, i);
        await processBlockAttribs(block, defUin, sectionUin, nestingPath);
      }
    }

    // ── Soft delete removed items ────────────────────────────────────────
    const now = new Date();
    for (const { uin, isAttr } of (deleted || [])) {
      if (isAttr) {
        await RitvikModuleElementsAttr.update(
          { status: 2, modified_date: now },
          { where: { uin }, transaction: t }
        );
      } else {
        await RitvikModuleElementsDef.update(
          { status: 2, modified_date: now },
          { where: { uin }, transaction: t }
        );
        await RitvikModuleElementsAttr.update(
          { status: 2, modified_date: now },
          { where: { ehr_module_elements_definition_uin: uin }, transaction: t }
        );
      }
    }

    // After deletes, update table container column_counts
    const deletedAttrUins = (deleted || []).filter(d => d.isAttr).map(d => d.uin);
    if (deletedAttrUins.length > 0) {
      const deletedAttrs = await RitvikModuleElementsAttr.findAll({
        where: { uin: { [Op.in]: deletedAttrUins } },
        attributes: ["ehr_module_elements_definition_uin"],
        transaction: t,
      });
      const affectedDefUins = [...new Set(deletedAttrs.map(a => a.ehr_module_elements_definition_uin))];
      for (const defUin of affectedDefUins) {
        const remainingCount = await RitvikModuleElementsAttr.count({
          where: { ehr_module_elements_definition_uin: defUin, status: 1 },
          transaction: t,
        });
        await RitvikModuleElementsDef.update(
          { column_count: remainingCount, modified_date: now },
          { where: { uin: defUin }, transaction: t }
        );
      }
    }

    // ── Process newly added blocks ────────────────────────────────────────
    for (const block of (added || [])) {
      if (block.type === "breakline") continue;

      // Position sync (no parentUin needed)
      if (block._type === "sync_position") {
        if (block._uin) {
          await RitvikModuleElementsDef.update(
            { relative_position: block.position, modified_date: now },
            { where: { uin: block._uin }, transaction: t }
          );
        }
        continue;
      }      const elementId = BLOCK_TYPE_TO_ELEMENT_ID[block.type] || 1;

      if (block._parentUin) {
        const parentUin = block._parentUin;

        if (block._type === "textbox_fields") {
          const existingCount = await RitvikModuleElementsDef.count({
            where: {
              nesting_id: parentUin,
              uin:        { [Op.ne]: parentUin },
              status:     1,
            },
            transaction: t,
          });
          for (let j = 0; j < (block.textboxes || []).length; j++) {
            const tb       = block.textboxes[j];
            const position = existingCount + j + 1;
            const tbDefUin = await insertDef({
              nestingId:   parentUin,
              elementId:   BLOCK_TYPE_TO_ELEMENT_ID["textbox"],
              question:    tb.question || "",
              columnCount: 1, rowCount: 1, position,
              layout:      tb.layout,
            });
            const tbAttrUin = await insertAttr({
              attribNestingId: `${parentUin}`,
              definitionUin:   tbDefUin,
              attributeName:   "",
              attributeValue:  tb.kind || "text",
              unit:            tb.unitId || 0,
              position,
            });
            await insertTextboxValidationEntries(tb, tbAttrUin);
            if (["int", "float", "decimal", "date", "time"].includes(tb.kind) &&
                (tb.significantEntries || []).length > 0) {
              await insertSignificantEntries(tbAttrUin, tb.kind, tb.significantEntries);
            }
          }
          const newTotalCount = existingCount + (block.textboxes || []).length;
          const colCount      = block.textboxCols || 1;
          const newRowCount   = Math.ceil(newTotalCount / colCount);
          await RitvikModuleElementsDef.update(
            { row_count: newRowCount, column_count: colCount,
              question_type: block.layout === "top" ? "1" : "0",
              modified_date: now },
            { where: { uin: parentUin }, transaction: t }
          );

        } else if (block._type === "bullet_items") {
          // Count ALL defs (including status=2) so count never decreases
          const totalExisting = await RitvikModuleElementsDef.count({
            where: {
              nesting_id: parentUin,
              uin:        { [Op.ne]: parentUin },
            },
            transaction: t,
          });
          for (let j = 0; j < (block.bullets || []).length; j++) {
            const bullet   = block.bullets[j];
            const position = existingCount + j + 1;
            const bulletDefUin = await insertDef({
              nestingId:   parentUin,
              elementId:   BLOCK_TYPE_TO_ELEMENT_ID["bullets"],
              question:    bullet.text || "",
              columnCount: 1, rowCount: 1, position,
            });
            await insertAttr({
              attribNestingId: `${parentUin}`,
              definitionUin:   bulletDefUin,
              attributeName:   "",
              unit:            0,
              position,
            });
          }
          const newTotalCount = existingCount + (block.bullets || []).length;
          const colCount      = block.bulletCols || 1;
          const newRowCount   = Math.ceil(newTotalCount / colCount);
          await RitvikModuleElementsDef.update(
            { row_count: newRowCount, column_count: colCount, modified_date: now },
            { where: { uin: parentUin }, transaction: t }
          );

        } else if (block._type === "buttons") {
          // Count ALL attrs (including status=2) so count never decreases
          const totalExisting = await RitvikModuleElementsAttr.count({
            where: { ehr_module_elements_definition_uin: parentUin },
            transaction: t,
          });
          for (let j = 0; j < (block.buttons || []).length; j++) {
            const btn      = block.buttons[j];
            const position = totalExisting + j + 1;
            await insertAttr({
              attribNestingId: block._nestingPath || `${parentUin}`,
              definitionUin:   parentUin,
              attributeName:   btn.name || "",
              unit:            0,
              position,
            });
          }
          const newTotalCount = totalExisting + (block.buttons || []).length;
          const colCount      = block.grid?.cols || 1;
          const newRowCount   = Math.ceil(newTotalCount / colCount);
          await RitvikModuleElementsDef.update(
            { row_count: newRowCount, column_count: colCount, modified_date: now },
            { where: { uin: parentUin }, transaction: t }
          );
        } else if (block._type === "table_columns") {
          // Get ALL R1C* attrs (including hidden) to know which col numbers are taken
          const allHeaderCols = await sequelize.query(
            `SELECT uin, attribute_name, status
             FROM ritvik_ehr_module_elements_attributes
             WHERE ehr_module_elements_definition_uin = :parentUin
             AND attribute_name REGEXP '^R1C[0-9]+$'
             ORDER BY relative_position`,
            { replacements: { parentUin }, type: QueryTypes.SELECT, transaction: t }
          );

          // Active header cols only — for counting and renaming
          const activeHeaderCols = allHeaderCols.filter(a => a.status !== 2);
          const headerColCount   = activeHeaderCols.length;

          // All used col numbers (active + hidden) — new cols must not reuse these
          const usedColNums = new Set(
            allHeaderCols.map(a => parseInt(a.attribute_name.replace('R1C', '')))
          );

          const totalExisting = await RitvikModuleElementsAttr.count({
            where: { ehr_module_elements_definition_uin: parentUin },
            transaction: t,
          });

          const defForCols = await RitvikModuleElementsDef.findOne({
            where: { uin: parentUin }, transaction: t,
          });

          for (let j = 0; j < (block.columns || []).length; j++) {
            const col = block.columns[j];

            // Desired position among active cols
            const desiredActivePos = col.colNum || (headerColCount + j + 1);

            // Find the actual col number to use — must not conflict with any existing
            // (active or hidden). Shift active cols >= desiredActivePos up by 1.
            // Count active cols to find the actual C number for desiredActivePos.
            // Active cols are sorted by their C number. Find the Nth active col number.
            const sortedActiveColNums = activeHeaderCols
              .map(a => parseInt(a.attribute_name.replace('R1C', '')))
              .sort((a, b) => a - b);

            // Find insertion point: new col goes before activeColNums[desiredActivePos-1]
            // so it gets the number of that col, and that col shifts up.
            let newColNum;
            if (desiredActivePos > sortedActiveColNums.length) {
              // Appending — find next available number after all existing
              newColNum = Math.max(...[...usedColNums], 0) + 1;
            } else {
              // Inserting — use the number of the active col at that position
              newColNum = sortedActiveColNums[desiredActivePos - 1];
              // Rename ALL active cols from this position onwards (+1)
              // but only active ones, skip hidden
              for (let k = sortedActiveColNums.length - 1; k >= desiredActivePos - 1; k--) {
                const oldNum = sortedActiveColNums[k];
                // Find next available number above oldNum not in usedColNums
                let nextNum = oldNum + 1;
                while (usedColNums.has(nextNum)) nextNum++;
                usedColNums.add(nextNum);
                // Rename ALL R*C{oldNum} active attrs to R*C{nextNum}
                await sequelize.query(
                  `UPDATE ritvik_ehr_module_elements_attributes
                   SET attribute_name = REPLACE(attribute_name, CONCAT('C', :oldNum), CONCAT('C', :nextNum)),
                       modified_date = :now
                   WHERE ehr_module_elements_definition_uin = :parentUin
                   AND attribute_name REGEXP :pattern
                   AND status != 2`,
                  {
                    replacements: { parentUin, oldNum, nextNum, now,
                      pattern: `^R[0-9]+C${oldNum}$` },
                    type: QueryTypes.UPDATE, transaction: t,
                  }
                );
                sortedActiveColNums[k] = nextNum;
              }
            }

            usedColNums.add(newColNum);

            const isDropdown     = col.kind === "dropdown" && (col.options || []).length > 0;
            const hasConstraint  = col.kind !== "dropdown" &&
              col.constraint && col.constraint !== "none" && col.constraintA;
            const hasMaxLength   = col.kind === "text" && col.maxLength > 0;
            const hasValidation  = isDropdown || hasConstraint || hasMaxLength;
            const position       = totalExisting + j + 1;

            // Insert R1C{newColNum}
            const headerAttrUin = await insertAttr({
              attribNestingId:  `${parentUin}`,
              definitionUin:    parentUin,
              attributeName:    `R1C${newColNum}`,
              attributeHeading: col.heading || "",
              attributeValue:   col.kind    || "text",
              unit:             0,
              position,
              validation:       hasValidation ? 1 : 0,
            });

            if (isDropdown) {
              for (const opt of (col.options || [])) {
                await sequelize.query(
                  `INSERT INTO ritvik_ehr_attribute_validation_entries
                    (module_elements_attribute_uin, attribute_validation_type_details_id,
                     description, flag, query, status)
                   VALUES (:attrUin, 0, :description, 1, '', 1)`,
                  { replacements: { attrUin: headerAttrUin, description: opt.label || "" },
                    type: QueryTypes.INSERT, transaction: t }
                );
              }
            } else if (hasConstraint || hasMaxLength) {
              await insertTextboxValidationEntries(
                { kind: col.kind, constraint: col.constraint, constraintA: col.constraintA,
                  constraintB: col.constraintB, maxLength: col.maxLength, validationTypeId: 0 },
                headerAttrUin
              );
            }

            if (["int", "float", "decimal", "date", "time"].includes(col.kind) &&
                (col.significantEntries || []).length > 0) {
              await insertSignificantEntries(headerAttrUin, col.kind, col.significantEntries);
            }

            // Insert data row cells for this new col — only for ACTIVE existing rows
            // Get table def to find moduleNameId
            const tableDefForCol = await RitvikModuleElementsDef.findOne({
              where: { uin: parentUin }, transaction: t,
            });
            const moduleNameIdForCol = tableDefForCol?.ehr_module_names_id;

            // Find row defs belonging to THIS table (nesting_id = parentUin)
            const existingRowDefs = await sequelize.query(
              `SELECT DISTINCT d.uin, a.attribute_name
               FROM ritvik_ehr_module_elements_definitions d
               JOIN ritvik_ehr_module_elements_attributes a ON a.ehr_module_elements_definition_uin = d.uin
               WHERE d.nesting_id = :parentUin
               AND d.group_id = 1
               AND a.attribute_name REGEXP '^R[0-9]+C1$'
               AND a.attribute_name NOT REGEXP '^R1C'
               AND a.status != 2
               ORDER BY a.attribute_name`,
              { replacements: { parentUin },
                type: QueryTypes.SELECT, transaction: t }
            );

            for (let ri = 0; ri < existingRowDefs.length; ri++) {
              const rowDef   = existingRowDefs[ri];
              const rowNum   = parseInt(rowDef.attribute_name.match(/^R(\d+)/)?.[1]);
              const maxPosForRow = await RitvikModuleElementsAttr.max('relative_position', {
                where: { ehr_module_elements_definition_uin: rowDef.uin },
                transaction: t,
              });
              await insertAttr({
                attribNestingId:  `${rowDef.uin}`,
                definitionUin:    rowDef.uin,
                attributeName:    `R${rowNum}C${newColNum}`,
                attributeHeading: "",
                attributeValue:   "",
                unit:             0,
                position:         (maxPosForRow || 0) + 1,
                validation:       0,
              });
            }
          }

          const newColCount = headerColCount + (block.columns || []).length;
          await RitvikModuleElementsDef.update(
            { column_count: newColCount, modified_date: now },
            { where: { uin: parentUin }, transaction: t }
          );
        } else if (block._type === "table_rows") {
          const tableDef = await RitvikModuleElementsDef.findOne({
            where: { uin: parentUin }, transaction: t,
          });
          if (tableDef) {
            if (tableDef.group_id !== 1) {
              await RitvikModuleElementsDef.update(
                { group_id: 1 },
                { where: { uin: parentUin }, transaction: t }
              );
            }
            const currentRowCount = tableDef.row_count || 0;
            const newRows         = block.rows || [];
            const colCount        = tableDef.column_count || 1;
            const moduleNameId    = tableDef.ehr_module_names_id;
            const elementId       = 1; // textbox element type for row defs
            // Get existing row numbers from R*C1 attrs of existing row defs
            const existingRowAttrs = await sequelize.query(
              `SELECT a.attribute_name
               FROM ritvik_ehr_module_elements_attributes a
               JOIN ritvik_ehr_module_elements_definitions d ON a.ehr_module_elements_definition_uin = d.uin
               WHERE d.ehr_module_names_id = :moduleNameId
               AND a.attribute_name REGEXP '^R[0-9]+C1$'
               AND a.attribute_name NOT REGEXP '^R1C'`,
              { replacements: { moduleNameId }, type: QueryTypes.SELECT, transaction: t }
            );
            const usedRowNums = new Set(
              existingRowAttrs.map(r =>
                parseInt(r.attribute_name.match(/^R(\d+)/)?.[1])
              ).filter(Boolean)
            );

            for (let ri = 0; ri < newRows.length; ri++) {
              const row      = newRows[ri];
              const rowCells = row.cells || [];

              // Find next available row number
              let rowNum = 2;
              while (usedRowNums.has(rowNum)) rowNum++;
              usedRowNums.add(rowNum);

              // Create new def for this row (self-referential nesting_id)
              const rowDefRow = await RitvikModuleElementsDef.create({
                uin:                    0,
                nesting_id:             parentUin, // nests under the table's own uin
                group_id:               1,
                ehr_module_elements_id: elementId,
                options:                0,
                ehr_module_names_id:    moduleNameId,
                question:               "",
                question_type:          String(elementId),
                column_count:           0,
                row_count:              0,
                relative_position:      currentRowCount + ri + 1,
                active_status:          1,
                table_type:             0,
                valid_button:           0,
                fill_view:              0,
                status:                 1,
                created_by:             0,
                modified_by:            0,
                created_date:           now,
                modified_date:          now,
              }, { transaction: t });

              const rowDefUin = rowDefRow.id;
              await RitvikModuleElementsDef.update(
                { uin: rowDefUin },
                { where: { id: rowDefUin }, transaction: t }
              );

              // Insert all cells for this row
              for (let c = 0; c < colCount; c++) {
                const cellValue = rowCells[c] || "";
                await insertAttr({
                  attribNestingId:  `${rowDefUin}`,
                  definitionUin:    rowDefUin,
                  attributeName:    `R${rowNum}C${c + 1}`,
                  attributeHeading: cellValue,
                  attributeValue:   "",
                  unit:             0,
                  position:         c + 1,
                  validation:       0,
                });
              }
            }

            // Update row_count on table def
            await RitvikModuleElementsDef.update(
              { row_count: currentRowCount + newRows.length, modified_date: now },
              { where: { uin: parentUin }, transaction: t }
            );
          }

        } else if (block._type === "table_sync") {
          const now = new Date();
          const submittedCols = (block.columns || []);
          const submittedRows = (block.rows || []).filter(r => r.defUin);

          // ── Sync columns ────────────────────────────────────────────
          if (submittedCols.length > 0) {
            const colUins = submittedCols.map(c => c.uin).filter(Boolean);
            const currentColAttrs = await sequelize.query(
              `SELECT uin, attribute_name FROM ritvik_ehr_module_elements_attributes
               WHERE uin IN (:uins)`,
              { replacements: { uins: colUins.length ? colUins : [0] },
                type: QueryTypes.SELECT, transaction: t }
            );
            const curColNumByUin = {};
            for (const a of currentColAttrs) {
              const m = a.attribute_name?.match(/C(\d+)$/);
              if (m) curColNumByUin[a.uin] = parseInt(m[1]);
            }

            // Step 1: rename moved cols to a large offset (9000+colUin) to avoid collisions
            for (const col of submittedCols) {
              if (!col.uin) continue;
              const oldNum = curColNumByUin[col.uin];
              if (!oldNum) continue;
              const tempNum = 9000 + col.uin;
              const pattern = "^R[0-9]+C" + oldNum + "$";
              await sequelize.query(
                `UPDATE ritvik_ehr_module_elements_attributes a
                 JOIN ritvik_ehr_module_elements_definitions d
                   ON a.ehr_module_elements_definition_uin = d.uin
                 SET a.attribute_name = CONCAT(
                       SUBSTRING(a.attribute_name, 1, LOCATE('C', a.attribute_name)),
                       :tempNum
                     ),
                     a.modified_date = :now
                 WHERE (d.uin = :parentUin OR d.nesting_id = :parentUin)
                 AND a.attribute_name REGEXP :pattern`,
                { replacements: { parentUin, now, tempNum, pattern },
                  type: QueryTypes.UPDATE, transaction: t }
              );
            }

            // Step 2: rename temp offset → final column number
            for (let i = 0; i < submittedCols.length; i++) {
              const col = submittedCols[i];
              if (!col.uin) continue;
              const newNum  = i + 1;
              const tempNum = 9000 + col.uin;
              const pattern = "C" + tempNum + "$";
              await sequelize.query(
                `UPDATE ritvik_ehr_module_elements_attributes a
                 JOIN ritvik_ehr_module_elements_definitions d
                   ON a.ehr_module_elements_definition_uin = d.uin
                 SET a.attribute_name = CONCAT(
                       SUBSTRING(a.attribute_name, 1, LOCATE('C', a.attribute_name)),
                       :newNum
                     ),
                     a.modified_date = :now
                 WHERE (d.uin = :parentUin OR d.nesting_id = :parentUin)
                 AND a.attribute_name REGEXP :pattern`,
                { replacements: { parentUin, now, newNum, pattern },
                  type: QueryTypes.UPDATE, transaction: t }
              );
            }

            // Step 3: relative_position + status
            for (let i = 0; i < submittedCols.length; i++) {
              const col = submittedCols[i];
              if (!col.uin) continue;
              const newStatus = col.active ? 1 : 2;
              const newNum    = i + 1;

              await RitvikModuleElementsAttr.update(
                { relative_position: newNum, status: newStatus, modified_date: now },
                { where: { uin: col.uin }, transaction: t }
              );

              const pattern = "^R[0-9]+C" + newNum + "$";
              await sequelize.query(
                `UPDATE ritvik_ehr_module_elements_attributes a
                 JOIN ritvik_ehr_module_elements_definitions d
                   ON a.ehr_module_elements_definition_uin = d.uin
                 SET a.status = :newStatus, a.modified_date = :now
                 WHERE d.nesting_id = :parentUin
                 AND a.attribute_name REGEXP :pattern`,
                { replacements: { parentUin, now, newStatus, pattern },
                  type: QueryTypes.UPDATE, transaction: t }
              );
            }
          }

          // ── Sync rows ────────────────────────────────────────────────
          if (submittedRows.length > 0) {
            const rowDefUins = submittedRows.map(r => r.defUin);
            const currentRowC1Attrs = await sequelize.query(
              `SELECT ehr_module_elements_definition_uin as defUin, attribute_name
               FROM ritvik_ehr_module_elements_attributes
               WHERE ehr_module_elements_definition_uin IN (:defUins)
               AND attribute_name REGEXP '^R[0-9]+C1$'`,
              { replacements: { defUins: rowDefUins.length ? rowDefUins : [0] },
                type: QueryTypes.SELECT, transaction: t }
            );
            const curRowNumByDef = {};
            for (const a of currentRowC1Attrs) {
              const m = a.attribute_name?.match(/^R(\d+)/);
              if (m) curRowNumByDef[a.defUin] = parseInt(m[1]);
            }
            const sortedExistingRowNums = Object.values(curRowNumByDef).sort((a, b) => a - b);

            // Step 1: rename to temp offset (9000+defUin)
            for (const row of submittedRows) {
              const oldNum = curRowNumByDef[row.defUin];
              if (!oldNum) continue;
              const tempNum = 9000 + row.defUin;
              const pattern = "^R" + oldNum + "C[0-9]+$";
              await sequelize.query(
                `UPDATE ritvik_ehr_module_elements_attributes
                 SET attribute_name = CONCAT(
                       'R', :tempNum,
                       SUBSTRING(attribute_name, LOCATE('C', attribute_name))
                     ),
                     modified_date = :now
                 WHERE ehr_module_elements_definition_uin = :defUin
                 AND attribute_name REGEXP :pattern`,
                { replacements: { now, tempNum, defUin: row.defUin, pattern },
                  type: QueryTypes.UPDATE, transaction: t }
              );
            }

            // Step 2: rename temp offset → final row number
            for (let i = 0; i < submittedRows.length; i++) {
              const row     = submittedRows[i];
              const newNum  = sortedExistingRowNums[i];
              const tempNum = 9000 + row.defUin;
              const pattern = "^R" + tempNum + "C[0-9]+$";
              await sequelize.query(
                `UPDATE ritvik_ehr_module_elements_attributes
                 SET attribute_name = CONCAT(
                       'R', :newNum,
                       SUBSTRING(attribute_name, LOCATE('C', attribute_name))
                     ),
                     modified_date = :now
                 WHERE ehr_module_elements_definition_uin = :defUin
                 AND attribute_name REGEXP :pattern`,
                { replacements: { now, newNum, defUin: row.defUin, pattern },
                  type: QueryTypes.UPDATE, transaction: t }
              );
            }

            // Step 3: relative_position + status
            for (let i = 0; i < submittedRows.length; i++) {
              const row       = submittedRows[i];
              const newStatus = row.active ? 1 : 2;
              await RitvikModuleElementsDef.update(
                { relative_position: i + 1, status: newStatus, modified_date: now },
                { where: { uin: row.defUin }, transaction: t }
              );
              await RitvikModuleElementsAttr.update(
                { status: newStatus, modified_date: now },
                { where: { ehr_module_elements_definition_uin: row.defUin }, transaction: t }
              );
            }
          }
        } else if (block._type === "nested_block") {
          const elementId  = BLOCK_TYPE_TO_ELEMENT_ID[block.type] || 1;
          const sectionUin = block._sectionUin || 0;
          const nestingPath = block._nestingPath || `${sectionUin}`;

          // Insert the def row with nesting_id = sectionUin (all defs nest under section root)
          const defUin = await insertBlockDef(block, sectionUin, elementId, 0);

          // For radio/multiselect — the def itself does NOT become self-referential
          // it nests under the section root, and its buttons use nestingPath as attrib_nesting_id
          await processBlockAttribs(block, defUin, sectionUin, nestingPath);
        } else if (block._type === "sync_position") {
          if (block._uin) {
            await RitvikModuleElementsDef.update(
              { relative_position: block.position, modified_date: now },
              { where: { uin: block._uin }, transaction: t }
            );
          }

        } else if (block._type === "sync_buttons") {
          for (const btn of (block.buttons || [])) {
            await RitvikModuleElementsAttr.update(
              { relative_position: btn.position,
                status: btn.active ? 1 : 2,
                modified_date: now },
              { where: { uin: btn.uin }, transaction: t }
            );
          }

        } else if (block._type === "sync_bullets") {
          for (const bullet of (block.bullets || [])) {
            await RitvikModuleElementsDef.update(
              { relative_position: bullet.position,
                status: bullet.active ? 1 : 2,
                modified_date: now },
              { where: { uin: bullet.uin }, transaction: t }
            );
          }

        } else if (block._type === "sync_textboxes") {
          for (const tb of (block.textboxes || [])) {
            await RitvikModuleElementsDef.update(
              { status: tb.active ? 1 : 2,
                question_type: tb.layout === "top" ? "1" : "0",
                modified_date: now },
              { where: { uin: tb.uin }, transaction: t }
            );
            if (tb.attrUin) {
              await RitvikModuleElementsAttr.update(
                { unit: tb.unitId || 0, modified_date: now },
                { where: { uin: tb.attrUin }, transaction: t }
              );
            }
          }

        } else if (block._type === "sync_textbox_attr") {
          const attrUin = block.attrUin;
          if (!attrUin) continue;

          // Significant entry — soft-delete existing, then insert current (if any)
          await sequelize.query(
            `UPDATE ritvik_ehr_significant_entries
             SET status = 2, modified_date = :now
             WHERE module_elements_attribute_uin = :attrUin`,
            { replacements: { attrUin, now }, type: QueryTypes.UPDATE, transaction: t }
          );
          if ((block.significantEntries || []).length > 0) {
            await insertSignificantEntries(attrUin, block.kind, block.significantEntries);
          }

          // Update constraint — soft-delete existing constraint entries, then re-insert
          if (block.constraint !== undefined || block.maxLength !== undefined) {
            await sequelize.query(
              `UPDATE ritvik_ehr_attribute_validation_entries
               SET status = 2, modified_date = :now
               WHERE module_elements_attribute_uin = :attrUin
               AND attribute_validation_type_details_id != 0`,
              { replacements: { attrUin, now },
                type: QueryTypes.UPDATE, transaction: t }
            );
            await insertTextboxValidationEntries(
              { kind:        block.kind        || "text",
                constraint:  block.constraint  || "none",
                constraintA: block.constraintA || "",
                constraintB: block.constraintB || "",
                maxLength:   block.maxLength   || null,
                validationTypeId: 0 },
              attrUin
            );
            await RitvikModuleElementsAttr.update(
              { attribute_value: block.kind || "text", modified_date: now },
              { where: { uin: attrUin }, transaction: t }
            );
          }

        } else if (block._type === "sync_table_attr") {
          const attrUin = block.attrUin;
          if (!attrUin) continue;

          // Toggle existing validation entries
          for (const entry of (block.toggledEntries || [])) {
            await sequelize.query(
              `UPDATE ritvik_ehr_attribute_validation_entries
               SET status = :status
               WHERE id = :id`,
              { replacements: { id: entry.id, status: entry.active ? 1 : 2 },
                type: QueryTypes.UPDATE, transaction: t }
            );
          }

          // Add new validation entries
          for (const entry of (block.newEntries || [])) {
            await RitvikAttrValidationEntries.create({
              module_elements_attribute_uin:        attrUin,
              attribute_validation_type_details_id: 0,
              description: entry.description,
              flag: 1, query: "", status: 1,
              created_date: now, modified_date: now,
            }, { transaction: t });
          }

          // Significant entry — soft-delete existing, then insert current (if any)
          await sequelize.query(
            `UPDATE ritvik_ehr_significant_entries
             SET status = 2, modified_date = :now
             WHERE module_elements_attribute_uin = :attrUin`,
            { replacements: { attrUin, now }, type: QueryTypes.UPDATE, transaction: t }
          );
          if ((block.significantEntries || []).length > 0) {
            await insertSignificantEntries(attrUin, block.kind, block.significantEntries);
          }

          // Update constraint — first soft-delete existing constraint entries
          if (block.constraint !== undefined || block.maxLength !== undefined) {
            await sequelize.query(
              `UPDATE ritvik_ehr_attribute_validation_entries
               SET status = 2, modified_date = :now
               WHERE module_elements_attribute_uin = :attrUin
               AND attribute_validation_type_details_id != 0`,
              { replacements: { attrUin, now },
                type: QueryTypes.UPDATE, transaction: t }
            );
            await insertTextboxValidationEntries(
              { kind:        block.kind        || "text",
                constraint:  block.constraint  || "none",
                constraintA: block.constraintA || "",
                constraintB: block.constraintB || "",
                maxLength:   block.maxLength   || null,
                validationTypeId: 0 },
              attrUin
            );
          }
        }

        continue;
      }

      // Nested new block added inside a recalled button's children
      if (block._type === "nested_block") {
        const sectionUin  = block._sectionUin  || 0;
        const nestingPath = block._nestingPath || `${sectionUin}`;
        const defUin = await insertBlockDef(block, sectionUin, elementId, 0);
        // Do NOT make self-referential — nesting_id stays as sectionUin
        await processBlockAttribs(block, defUin, sectionUin, nestingPath);
        continue;
      }

      // Root-level new block — self-referential
      const visualPos = block._visualPosition !== undefined ? block._visualPosition : 0;
      const defUin = await insertBlockDef(block, 0, elementId, visualPos);
      await RitvikModuleElementsDef.update(
        { nesting_id: defUin },
        { where: { id: defUin }, transaction: t }
      );
      await processBlockAttribs(block, defUin, defUin, `${defUin}`);
    }

    await t.commit();
    res.json({ ok: true });

  } catch (err) {
    await t.rollback();
    console.error("Recall save error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /recall/definitions/:uin
router.patch("/definitions/:uin", async (req, res) => {
  try {
    const { question, column_count, row_count, relative_position } = req.body;
    const patch = {};
    if (question          !== undefined) patch.question          = question;
    if (column_count      !== undefined) patch.column_count      = column_count;
    if (row_count         !== undefined) patch.row_count         = row_count;
    if (relative_position !== undefined) patch.relative_position = relative_position;
    if (!Object.keys(patch).length) return res.status(400).json({ error: "Nothing to update" });
    patch.modified_date = new Date();
    await RitvikModuleElementsDef.update(patch, { where: { uin: req.params.uin } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /recall/attributes/:uin — update relative_position, attribute_name, attribute_heading
router.patch("/attributes/:uin", async (req, res) => {
  try {
    const { attribute_name, attribute_heading, relative_position, unit } = req.body;
    const patch = {};
    if (attribute_name    !== undefined) patch.attribute_name    = attribute_name;
    if (attribute_heading !== undefined) patch.attribute_heading = attribute_heading;
    if (relative_position !== undefined) patch.relative_position = relative_position;
    if (unit              !== undefined) patch.unit              = unit;
    if (!Object.keys(patch).length) return res.status(400).json({ error: "Nothing to update" });
    patch.modified_date = new Date();
    await RitvikModuleElementsAttr.update(patch, { where: { uin: req.params.uin } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /recall/attributes/:uin/status — toggle status 1/2
router.patch("/attributes/:uin/status", async (req, res) => {
  try {
    const { status } = req.body;
    if (status === undefined) return res.status(400).json({ error: "status required" });
    const now = new Date();

    await RitvikModuleElementsAttr.update(
      { status, modified_date: now },
      { where: { uin: req.params.uin } }
    );

    // Cascade status change to all nested content (both enable and disable)
    await cascadeAttrStatus(req.params.uin, status, now);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// GET /recall/validation-entries/:attrUin — get all validation entries for an attribute
router.get("/validation-entries/:attrUin", async (req, res) => {
  try {
    const rows = await sequelize.query(
      `SELECT * FROM ritvik_ehr_attribute_validation_entries
       WHERE module_elements_attribute_uin = :attrUin
       ORDER BY id`,
      { replacements: { attrUin: req.params.attrUin }, type: QueryTypes.SELECT }
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /recall/validation-entries/:id/status — toggle status
router.patch("/validation-entries/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    if (status === undefined) return res.status(400).json({ error: "status required" });
    await sequelize.query(
      `UPDATE ritvik_ehr_attribute_validation_entries SET status = :status WHERE id = :id`,
      { replacements: { status, id: req.params.id }, type: QueryTypes.UPDATE }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /recall/validation-entries — add new entry
router.post("/validation-entries", async (req, res) => {
  try {
    const { attrUin, description, validationTypeDetailsId } = req.body;
    const [result] = await sequelize.query(
      `INSERT INTO ritvik_ehr_attribute_validation_entries
        (module_elements_attribute_uin, attribute_validation_type_details_id,
         description, flag, query, status)
       VALUES (:attrUin, :typeId, :description, 1, '', 1)`,
      {
        replacements: {
          attrUin,
          typeId:      validationTypeDetailsId || 0,
          description: description || "",
        },
        type: QueryTypes.INSERT,
      }
    );
    res.json({ ok: true, id: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /recall/definitions/:uin/status
router.patch("/definitions/:uin/status", async (req, res) => {
  try {
    const { status } = req.body;
    if (status === undefined) return res.status(400).json({ error: "status required" });
    await RitvikModuleElementsDef.update(
      { status, modified_date: new Date() },
      { where: { uin: req.params.uin } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /recall/column-constraint/:attrUin — update constraint for a recalled table column
router.patch("/column-constraint/:attrUin", async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { kind, constraint, constraintA, constraintB, maxLength } = req.body;
    const attrUin = req.params.attrUin;
    const now     = new Date();

    // Soft-delete all existing validation entries for this attr
    await sequelize.query(
      `UPDATE ritvik_ehr_attribute_validation_entries
       SET status = 2
       WHERE module_elements_attribute_uin = :attrUin`,
      { replacements: { attrUin }, type: QueryTypes.UPDATE, transaction: t }
    );

    // Build validation type details lookup
    const vtDetailsRows = await sequelize.query(
      `SELECT id, validation_type_id, validation_type_definition_id,
              validation_type_definition_types_id
       FROM ehr_attribute_validation_type_details`,
      { type: QueryTypes.SELECT, transaction: t }
    );
    const vtDetailsMap = {};
    for (const row of vtDetailsRows) {
      const key = `${row.validation_type_id}_${row.validation_type_definition_id}_${row.validation_type_definition_types_id}`;
      vtDetailsMap[key] = row.id;
    }
    const vtRows = await sequelize.query(
      "SELECT id, description FROM ehr_attribute_validation_types",
      { type: QueryTypes.SELECT, transaction: t }
    );
    const vtByDesc = {};
    for (const row of vtRows) vtByDesc[row.description?.toLowerCase()] = row.id;
    const vdRows = await sequelize.query(
      "SELECT id, description FROM ehr_attribute_validation_type_definitions",
      { type: QueryTypes.SELECT, transaction: t }
    );
    const vdByDesc = {};
    for (const row of vdRows) vdByDesc[row.description?.toLowerCase()] = row.id;
    const VD_TYPE = { minimum: 1, maximum: 2, value: 3 };
    function getDetailsId(typeName, definitionName, definitionTypeName) {
      const typeId       = vtByDesc[typeName?.toLowerCase()]          || 0;
      const definitionId = vdByDesc[definitionName?.toLowerCase()]    || 0;
      const defTypeId    = VD_TYPE[definitionTypeName?.toLowerCase()] || 0;
      if (!typeId || !definitionId || !defTypeId) return 0;
      return vtDetailsMap[`${typeId}_${definitionId}_${defTypeId}`] || 0;
    }

    const kindToTypeName = {
      "int": "whole number", "decimal": "decimal",
      "date": "date", "time": "time", "text": "text length",
    };
    const constraintToDefName = {
      "between": "between", "notbetween": "not between",
      "eq": "equal to", "neq": "not equal to",
      "gt": "greater than", "gte": "greater than or equal to",
      "lt": "less than", "lte": "less than or equal to",
    };

    let hasValidation = false;

    if (constraint && constraint !== "none" && constraintA) {
      const typeName = kindToTypeName[kind];
      const defName  = constraintToDefName[constraint];

      if (constraint === "between" || constraint === "notbetween") {
        await sequelize.query(
          `INSERT INTO ritvik_ehr_attribute_validation_entries
            (module_elements_attribute_uin, attribute_validation_type_details_id, description, flag, query, status)
           VALUES (:uin, :typeId, :desc, 0, '', 1)`,
          { replacements: { uin: attrUin, typeId: getDetailsId(typeName, defName, "minimum"), desc: constraintA || "" },
            type: QueryTypes.INSERT, transaction: t }
        );
        await sequelize.query(
          `INSERT INTO ritvik_ehr_attribute_validation_entries
            (module_elements_attribute_uin, attribute_validation_type_details_id, description, flag, query, status)
           VALUES (:uin, :typeId, :desc, 0, '', 1)`,
          { replacements: { uin: attrUin, typeId: getDetailsId(typeName, defName, "maximum"), desc: constraintB || "" },
            type: QueryTypes.INSERT, transaction: t }
        );
        hasValidation = true;
      } else {
        await sequelize.query(
          `INSERT INTO ritvik_ehr_attribute_validation_entries
            (module_elements_attribute_uin, attribute_validation_type_details_id, description, flag, query, status)
           VALUES (:uin, :typeId, :desc, 0, '', 1)`,
          { replacements: { uin: attrUin, typeId: getDetailsId(typeName, defName, "value"), desc: constraintA || "" },
            type: QueryTypes.INSERT, transaction: t }
        );
        hasValidation = true;
      }
    } else if (kind === "text" && maxLength > 0) {
      await sequelize.query(
        `INSERT INTO ritvik_ehr_attribute_validation_entries
          (module_elements_attribute_uin, attribute_validation_type_details_id, description, flag, query, status)
         VALUES (:uin, :typeId, :desc, 0, '', 1)`,
        { replacements: { uin: attrUin, typeId: getDetailsId("text length", "less than or equal to", "value"), desc: String(maxLength) },
          type: QueryTypes.INSERT, transaction: t }
      );
      hasValidation = true;
    }

    // Update validation flag on the attribute
    await RitvikModuleElementsAttr.update(
      { validation: hasValidation ? 1 : 0, modified_date: now },
      { where: { uin: attrUin }, transaction: t }
    );

    await t.commit();
    res.json({ ok: true });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: err.message });
  }
});

// Move row — swap all R{from}C* with R{to}C*
router.patch("/table/:defUin/move-row", async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { defUin } = req.params;
    const { fromRow, toRow } = req.body;
    const now = new Date();

    const fromAttrs = await sequelize.query(
      `SELECT uin, attribute_name FROM ritvik_ehr_module_elements_attributes
       WHERE ehr_module_elements_definition_uin = :defUin
       AND attribute_name REGEXP :pattern`,
      { replacements: { defUin, pattern: `^R${fromRow}C[0-9]+$` },
        type: QueryTypes.SELECT, transaction: t }
    );
    const toAttrs = await sequelize.query(
      `SELECT uin, attribute_name FROM ritvik_ehr_module_elements_attributes
       WHERE ehr_module_elements_definition_uin = :defUin
       AND attribute_name REGEXP :pattern`,
      { replacements: { defUin, pattern: `^R${toRow}C[0-9]+$` },
        type: QueryTypes.SELECT, transaction: t }
    );

    for (const a of fromAttrs) {
      await RitvikModuleElementsAttr.update(
        { attribute_name: `TEMP_${a.attribute_name}`, modified_date: now },
        { where: { uin: a.uin }, transaction: t }
      );
    }
    for (const a of toAttrs) {
      const colNum = a.attribute_name.match(/C(\d+)$/)?.[1];
      await RitvikModuleElementsAttr.update(
        { attribute_name: `R${fromRow}C${colNum}`, modified_date: now },
        { where: { uin: a.uin }, transaction: t }
      );
    }
    for (const a of fromAttrs) {
      const colNum = a.attribute_name.match(/C(\d+)$/)?.[1];
      await RitvikModuleElementsAttr.update(
        { attribute_name: `R${toRow}C${colNum}`, modified_date: now },
        { where: { uin: a.uin }, transaction: t }
      );
    }

    await t.commit();
    res.json({ ok: true });
  } catch (err) {
    try { await t.rollback(); } catch (_) {}
    res.status(500).json({ error: err.message });
  }
});

// Move col — swap all R*C{from} with R*C{to}
router.patch("/table/:defUin/move-col", async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { defUin } = req.params;
    const { fromCol, toCol } = req.body;
    const now = new Date();

    // Get ALL attrs (active and hidden) for both columns
    const fromAttrs = await sequelize.query(
      `SELECT uin, attribute_name, status FROM ritvik_ehr_module_elements_attributes
       WHERE ehr_module_elements_definition_uin = :defUin
       AND attribute_name REGEXP :pattern`,
      { replacements: { defUin, pattern: `^R[0-9]+C${fromCol}$` },
        type: QueryTypes.SELECT, transaction: t }
    );
    const toAttrs = await sequelize.query(
      `SELECT uin, attribute_name, status FROM ritvik_ehr_module_elements_attributes
       WHERE ehr_module_elements_definition_uin = :defUin
       AND attribute_name REGEXP :pattern`,
      { replacements: { defUin, pattern: `^R[0-9]+C${toCol}$` },
        type: QueryTypes.SELECT, transaction: t }
    );

    // Temp rename ALL fromAttrs
    for (const a of fromAttrs) {
      await RitvikModuleElementsAttr.update(
        { attribute_name: `TEMP_${a.attribute_name}`, modified_date: now },
        { where: { uin: a.uin }, transaction: t }
      );
    }
    // Rename toAttrs → fromCol names
    for (const a of toAttrs) {
      const rowNum = a.attribute_name.match(/^R(\d+)/)?.[1];
      await RitvikModuleElementsAttr.update(
        { attribute_name: `R${rowNum}C${fromCol}`, modified_date: now },
        { where: { uin: a.uin }, transaction: t }
      );
    }
    // Rename temp → toCol names
    for (const a of fromAttrs) {
      const rowNum = a.attribute_name.match(/^R(\d+)/)?.[1];
      await RitvikModuleElementsAttr.update(
        { attribute_name: `R${rowNum}C${toCol}`, modified_date: now },
        { where: { uin: a.uin }, transaction: t }
      );
    }

    await t.commit();
    res.json({ ok: true });
  } catch (err) {
    try { await t.rollback(); } catch (_) {}
    res.status(500).json({ error: err.message });
  }
});

// Toggle row status — set all R{rowNum}C* to status
router.patch("/table/:defUin/row-status", async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { defUin } = req.params;
    const { rowNum, status } = req.body;
    const now = new Date();
    // Only affect attrs that need changing (avoid toggling already-hidden duplicates)
    const currentStatus = status === 2 ? 1 : 2; // if hiding, only touch active; if showing, only touch hidden
    await sequelize.query(
      `UPDATE ritvik_ehr_module_elements_attributes
       SET status = :status, modified_date = :now
       WHERE ehr_module_elements_definition_uin = :defUin
       AND attribute_name REGEXP :pattern
       AND status = :currentStatus`,
      { replacements: { defUin, status, now, pattern: `^R${rowNum}C[0-9]+$`, currentStatus },
        type: QueryTypes.UPDATE, transaction: t }
    );
    await t.commit();
    res.json({ ok: true });
  } catch (err) {
    try { await t.rollback(); } catch (_) {}
    res.status(500).json({ error: err.message });
  }
});

// Toggle col status — set all R*C{colNum} to status
router.patch("/table/:defUin/col-status", async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { defUin } = req.params;
    const { colNum, status } = req.body;
    const now = new Date();
    const currentStatus = status === 2 ? 1 : 2;
    await sequelize.query(
      `UPDATE ritvik_ehr_module_elements_attributes
       SET status = :status, modified_date = :now
       WHERE ehr_module_elements_definition_uin = :defUin
       AND attribute_name REGEXP :pattern
       AND status = :currentStatus`,
      { replacements: { defUin, status, now, pattern: `^R[0-9]+C${colNum}$`, currentStatus },
        type: QueryTypes.UPDATE, transaction: t }
    );
    await t.commit();
    res.json({ ok: true });
  } catch (err) {
    try { await t.rollback(); } catch (_) {}
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;