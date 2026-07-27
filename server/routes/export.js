const express  = require("express");
const router   = express.Router();
const { QueryTypes } = require("sequelize");
const sequelize = require("../db");

const RitvikModule             = require("../models/RitvikModule");
const RitvikModuleNames        = require("../models/RitvikModuleNames");
const RitvikModuleElementsDef  = require("../models/RitvikModuleElementsDef");
const RitvikModuleElementsAttr = require("../models/RitvikModuleElementsAttr");
const RitvikAttrValidationEntries = require("../models/RitvikAttrValidationEntries");
const RitvikSignificantEntries = require("../models/RitvikSignificantEntries");

router.post("/:id/export", async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { name, color, status, specialtyId, subspecialtyId } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });

    // 1. Insert into ritvik_ehr_module_names
    const moduleNameRow = await RitvikModuleNames.create({
      module_name:          name,
      module_color:         color         || "#000000",
      module_status:        status        ?? 0,
      module_specialty:     specialtyId   ?? 0,
      module_subspecialty:  subspecialtyId ?? 0,
    }, { transaction: t });
    const moduleNameId = moduleNameRow.id;

    // 2. Fetch ehr_module_elements type → id map
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

    // Build validation type details lookup map
    // (typeId, definitionId, definitionTypeId) → details.id
    const vtDetailsRows = await sequelize.query(
      `SELECT id, validation_type_id, validation_type_definition_id,
              validation_type_definition_types_id
       FROM ehr_attribute_validation_type_details`,
      { type: QueryTypes.SELECT, transaction: t }
    );

    // Maps for looking up details id by combination
    const vtDetailsMap = {};
    for (const row of vtDetailsRows) {
      const key = `${row.validation_type_id}_${row.validation_type_definition_id}_${row.validation_type_definition_types_id}`;
      vtDetailsMap[key] = row.id;
    }

    // Lookup validation type ids by description
    const vtRows = await sequelize.query(
      "SELECT id, description FROM ehr_attribute_validation_types",
      { type: QueryTypes.SELECT, transaction: t }
    );
    const vtByDesc = {};
    for (const row of vtRows) vtByDesc[row.description?.toLowerCase()] = row.id;

    // Lookup validation definition ids by description
    const vdRows = await sequelize.query(
      "SELECT id, description FROM ehr_attribute_validation_type_definitions",
      { type: QueryTypes.SELECT, transaction: t }
    );
    const vdByDesc = {};
    for (const row of vdRows) vdByDesc[row.description?.toLowerCase()] = row.id;

    // Definition type ids: minimum=1, maximum=2, value=3
    const VD_TYPE = { minimum: 1, maximum: 2, value: 3 };

    // Helper to get details id
    function getDetailsId(typeName, definitionName, definitionTypeName) {
      const typeId       = vtByDesc[typeName?.toLowerCase()]           || 0;
      const definitionId = vdByDesc[definitionName?.toLowerCase()]      || 0;
      const defTypeId    = VD_TYPE[definitionTypeName?.toLowerCase()]   || 0;
      if (!typeId || !definitionId || !defTypeId) return 0;
      return vtDetailsMap[`${typeId}_${definitionId}_${defTypeId}`] || 0;
    }

    // 3. Load module data
    const mod = await RitvikModule.findByPk(req.params.id, { transaction: t });
    if (!mod) throw new Error("Module not found");

    const moduleType = mod.type || "module";
    let allBlockGroups = [];

    if (moduleType === "template") {
      const templateEntries = JSON.parse(mod.data) || [];
      for (const entry of templateEntries) {
        const child = await RitvikModule.findByPk(entry.id, { transaction: t });
        if (child) {
          allBlockGroups.push({ label: entry.name, blocks: JSON.parse(child.data) || [] });
        }
      }
    } else {
      allBlockGroups.push({ label: name, blocks: JSON.parse(mod.data) || [] });
    }

    // ── Helpers ───────────────────────────────────────────────────────────

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
        column_count: columnCount ?? 1, row_count: rowCount ?? 1,
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

    // Insert validation entries for dropdown options
    async function insertValidationEntries(attrUin, options, validationTypeDetailsId) {
      const now = new Date();
      for (const opt of options) {
        await RitvikAttrValidationEntries.create({
          module_elements_attribute_uin:        attrUin,
          attribute_validation_type_details_id: validationTypeDetailsId || 0,
          description:                          opt.label || opt.name || opt.text || "",
          flag:                                 1,
          query:                                "",
          status:                               1,
          created_date:                         now,
          modified_date:                        now,
        }, { transaction: t });
      }
    }

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

      if ((kind === "int" || kind === "float" || kind === "date" || kind === "time")
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
            attribute_validation_type_details_id: getDetailsId(typeName, defName, "minimum"),
            description: tb.constraintA || "", flag: 0, query: "", status: 1,
            created_date: now, modified_date: now,
          }, { transaction: t });
        } else {
         await RitvikAttrValidationEntries.create({
            module_elements_attribute_uin:        attrUin,
            attribute_validation_type_details_id: getDetailsId(typeName, defName, "minimum"),
            description: tb.constraintA || "", flag: 0, query: "", status: 1,
            created_date: now, modified_date: now,
          }, { transaction: t });
        }
        inserted = true;
      } else if (kind === "text" && tb.maxLength > 0) {
        await RitvikAttrValidationEntries.create({
            module_elements_attribute_uin:        attrUin,
            attribute_validation_type_details_id: getDetailsId(typeName, defName, "minimum"),
            description: tb.constraintA || "", flag: 0, query: "", status: 1,
            created_date: now, modified_date: now,
          }, { transaction: t });
        inserted = true;
      }
      // If validation was inserted, update the attribute's validation column to 1
      if (inserted) {
        await RitvikModuleElementsAttr.update(
          { validation: 1 },
          { where: { uin: attrUin }, transaction: t }
        );
      }
      return inserted;
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
          : block.type === "bullets" ? (block.bulletCols   || 1)
          : 1,
        rowCount:
          block.type === "radio" || block.type === "multiselect" ? (block.grid?.rows || 1)
          : block.type === "table"   ? (block.table?.rows  || 1)
          : block.type === "textbox" ? (block.textboxRows  || 1)
          : block.type === "bullets" ? (block.bulletRows   || 1)
          : 1,
        position,
      });
    }

    // ── Block processors ──────────────────────────────────────────────────
    
    async function processBlockAttribs(block, defUin, sectionUin, nestingPath) {
      if (block.type === "textbox") {
        const textboxes = block.textboxes || [];
        const elementId = BLOCK_TYPE_TO_ELEMENT_ID["textbox"];

        // Always use container — defUin IS the container
        await RitvikModuleElementsDef.update(
          {
            nesting_id:   defUin,
            column_count: block.textboxCols || 1,
            row_count:    block.textboxRows || 1,
            question_type: block.layout === "top" ? "1" : "0",
          },
          { where: { id: defUin }, transaction: t }
        );
        for (let j = 0; j < textboxes.length; j++) {
          const tb = textboxes[j];
          const tbDefUin = await insertDef({
            nestingId:   defUin,
            elementId,
            question:    tb.question || "",
            columnCount: 1,
            rowCount:    1,
            position:    j + 1,
          });
            const tbAttrUin = await insertAttr({
              attribNestingId: `${defUin}`,
              definitionUin:   tbDefUin,
              attributeName:   "",
              attributeValue: tb.kind || "text",
              unit:            tb.unitId || 0,
              position:        j + 1,
            });
            await insertTextboxValidationEntries(tb, tbAttrUin);
            if (["int", "float", "decimal", "date", "time"].includes(tb.kind) 
              && (tb.significantEntries || []).length > 0) {
              await insertSignificantEntries(tbAttrUin, tb.kind, tb.significantEntries);
            }
        }

      } else if (block.type === "radio" || block.type === "multiselect") {
        const total = (block.grid?.rows || 0) * (block.grid?.cols || 0);
        const buttons = (block.buttons || []).slice(0, total);
        for (let j = 0; j < buttons.length; j++) {
          const btn = buttons[j];
          const btnAttrUin = await insertAttr({
            attribNestingId: nestingPath,
            definitionUin:   defUin,
            attributeName:   btn.name || "",
            unit:            0,
            position:        j + 1,
          });
          if ((btn.children || []).length > 0) {
            await processChildBlocks(btn.children, sectionUin, `${nestingPath}.${btnAttrUin}`);
          }
        }

      } else if (block.type === "dropdown") {
        const options = block.options || [];
        // All options go into one attribute row, each option becomes a validation entry
        const dropdownAttrUin = await insertAttr({
          attribNestingId: nestingPath,
          definitionUin:   defUin,
          attributeName:   "List",
          unit:            0,
          position:        1,
        });
        await insertValidationEntries(
          dropdownAttrUin,
          options,
          block.validationTypeId || 0
        );
        for (let j = 0; j < options.length; j++) {
          const opt = options[j];
          if ((opt.children || []).length > 0) {
            await processChildBlocks(opt.children, sectionUin, `${nestingPath}.${dropdownAttrUin}`);
          }
        }

      } else if (block.type === "bullets") {
        const bullets = block.bullets || [];
        for (let j = 0; j < bullets.length; j++) {
          const bullet = bullets[j];
          const bulletDefUin = await insertDef({
            nestingId:   sectionUin,
            elementId:   BLOCK_TYPE_TO_ELEMENT_ID["bullets"],
            question:    bullet.text || "",
            columnCount: 1,
            rowCount:    1,
            position:    j + 1,
          });
          await insertAttr({
            attribNestingId: `${sectionUin}`,
            definitionUin:   bulletDefUin,
            attributeName:   "",
            unit:            0,
            position:        j + 1,
          });
          if ((bullet.children || []).length > 0) {
            await processChildBlocks(bullet.children, sectionUin, `${nestingPath}.${bulletDefUin}`);
          }
        }

      } else if (block.type === "table") {
        const cols      = block.table?.cols      || 0;
        const cells     = block.table?.cells     || [];
        const columns   = block.table?.columns   || [];
        const headerRow = block.table?.headerRow ?? true;
        const totalRows = cells.length;

        // Mark table def with group_id=1
        await RitvikModuleElementsDef.update(
          { group_id: 1 },
          { where: { id: defUin }, transaction: t }
        );

        // Header row (R1) — attrs belong to the table def itself
        if (headerRow && totalRows > 0) {
          for (let c = 0; c < cols; c++) {
            const colNum    = c + 1;
            const cellValue = cells[0]?.[c] || "";
            const colConfig = columns[c] || {};

            const isDropdownCol    = colConfig.kind === "dropdown" && (colConfig.options || []).length > 0;
            const hasConstraintCol = colConfig.kind !== "dropdown" &&
              ((colConfig.constraint && colConfig.constraint !== "none" && colConfig.constraintA) ||
               (colConfig.kind === "text" && colConfig.maxLength > 0));
            const hasValidation    = isDropdownCol || hasConstraintCol;

            const cellAttrUin = await insertAttr({
              attribNestingId:  `${sectionUin}`,
              definitionUin:    defUin,
              attributeName:    `R1C${colNum}`,
              attributeHeading: cellValue,
              attributeValue:   colConfig.kind || "text",
              unit:             0,
              position:         colNum,
              validation:       hasValidation ? 1 : 0,
            });

            if (isDropdownCol) {
              await insertValidationEntries(
                cellAttrUin,
                colConfig.options.map(o => ({ label: o.label || o.name || "" })),
                0
              );
            } else if (hasConstraintCol) {
              await insertTextboxValidationEntries({
                kind:        colConfig.kind        || "text",
                constraint:  colConfig.constraint  || "none",
                constraintA: colConfig.constraintA || "",
                constraintB: colConfig.constraintB || "",
                maxLength:   colConfig.maxLength   || null,
                validationTypeId: 0,
              }, cellAttrUin);
            }

            if (["int", "float", "decimal", "date", "time"].includes(colConfig.kind) &&
                (colConfig.significantEntries || []).length > 0) {
              await insertSignificantEntries(cellAttrUin, colConfig.kind, colConfig.significantEntries);
            }
          }
        }

        // Data rows — each row gets its own def with self-referential nesting_id
        const dataRowStart = headerRow ? 1 : 0;
        for (let r = dataRowStart; r < totalRows; r++) {
          const rowNum = r + 1;

          // Insert row def (self-referential nesting_id, uses textbox element type)
          // Each row's def nests under the TABLE's own uin (not self-referential)
          // so rows can be scoped to their specific table during reconstruction
          const rowDefUin = await insertDef({
            nestingId:   defUin,
            elementId:   BLOCK_TYPE_TO_ELEMENT_ID["textbox"],
            question:    "",
            columnCount: 0,
            rowCount:    0,
            position:    r + 1,
            groupId:     1,
          });

          // Insert attrs for each cell in this row
          for (let c = 0; c < cols; c++) {
            const colNum    = c + 1;
            const cellValue = cells[r]?.[c] || "";

            await insertAttr({
              attribNestingId:  `${rowDefUin}`,
              definitionUin:    rowDefUin,
              attributeName:    `R${rowNum}C${colNum}`,
              attributeHeading: cellValue,
              attributeValue:   "",
              unit:             0,
              position:         colNum,
              validation:       0,
            });
          }
        }

        // Update table def row_count and column_count
        const dataRowCount = totalRows - (headerRow ? 1 : 0);
        await RitvikModuleElementsDef.update(
          { row_count: dataRowCount, column_count: cols },
          { where: { id: defUin }, transaction: t }
        );
      } else if (block.type === "header" || block.type === "richtext") {
        await insertAttr({
          attribNestingId: `${sectionUin}`,
          definitionUin:   defUin,
          attributeName:   block.content || block.title || "",
          unit:            0,
          position:        1,
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
              nestingId:   sectionUin,
              elementId:   BLOCK_TYPE_TO_ELEMENT_ID["bullets"],
              question:    bullet.text || "",
              columnCount: 1, rowCount: 1, position: j + 1,
            });
            await insertAttr({
              attribNestingId: nestingPath,
              definitionUin:   bulletDefUin,
              attributeName:   "",
              unit:            0,
              position:        j + 1,
            });
            if ((bullet.children || []).length > 0) {
              await processChildBlocks(bullet.children, sectionUin, `${nestingPath}.${bulletDefUin}`);
            }
          }
          continue;
        }

        if (block.type === "dropdown") {
          const elementId = BLOCK_TYPE_TO_ELEMENT_ID["dropdown"] || 1;
          const defUin    = await insertBlockDef(block, sectionUin, elementId, i);
          const options   = block.options || [];
          const dropdownAttrUin = await insertAttr({
            attribNestingId: nestingPath,
            definitionUin:   defUin,
            attributeName:   "List",
            unit:            0,
            position:        1,
          });
          await insertValidationEntries(
            dropdownAttrUin,
            options,
            block.validationTypeId || 0
          );
          for (let j = 0; j < options.length; j++) {
            const opt = options[j];
            if ((opt.children || []).length > 0) {
              await processChildBlocks(opt.children, sectionUin, `${nestingPath}.${dropdownAttrUin}`);
            }
          }
          continue;
        }

        if (block.type === "textbox") {
          const elementId = BLOCK_TYPE_TO_ELEMENT_ID["textbox"];
          const containerDefUin = await insertDef({
            nestingId:   sectionUin,
            elementId,
            question:    block.title || "",
            columnCount: block.textboxCols || 1,
            rowCount:    block.textboxRows || 1,
            position:    i,
            layout: block.layout,
          });
          const textboxes = block.textboxes || [];
          for (let j = 0; j < textboxes.length; j++) {
            const tb = textboxes[j];
            const tbDefUin = await insertDef({
              nestingId:   containerDefUin,
              elementId,
              question:    tb.question || "",
              columnCount: 1,
              rowCount:    1,
              position:    j + 1,
            });
            const tbAttrUin = await insertAttr({
              attribNestingId: `${containerDefUin}`,
              definitionUin:   tbDefUin,
              attributeName:   "",
              attributeValue: tb.kind || "text",
              unit:            tb.unitId || 0,
              position:        j + 1,
            });
            await insertTextboxValidationEntries(tb, tbAttrUin);
            if (["int", "float", "decimal", "date", "time"].includes(tb.kind) 
              && (tb.significantEntries || []).length > 0) {
              await insertSignificantEntries(tbAttrUin, tb.kind, tb.significantEntries);
            }
          }
          continue;
        }

        const elementId = BLOCK_TYPE_TO_ELEMENT_ID[block.type] || 1;
        const defUin    = await insertBlockDef(block, sectionUin, elementId, i);
        await processBlockAttribs(block, defUin, sectionUin, nestingPath);
      }
    }

    async function processGroup(blocks) {
      const realBlocks = blocks.filter(b => b.type !== "breakline");
      if (realBlocks.length === 0) return;

      let sectionUin = null;

      for (let i = 0; i < realBlocks.length; i++) {
        const block = realBlocks[i];
        const elementId = BLOCK_TYPE_TO_ELEMENT_ID[block.type] || 1;

        // ── Bullets (non-first) ──────────────────────────────────────────
        if (block.type === "bullets" && sectionUin !== null) {
          const bullets = block.bullets || [];
          if (bullets.length === 0) continue;
          for (let j = 0; j < bullets.length; j++) {
            const bullet = bullets[j];
            const bulletDefUin = await insertDef({
              nestingId:   sectionUin,
              elementId:   BLOCK_TYPE_TO_ELEMENT_ID["bullets"],
              question:    bullet.text || "",
              columnCount: 1, rowCount: 1, position: j + 1,
            });
            await insertAttr({
              attribNestingId: `${sectionUin}`,
              definitionUin:   bulletDefUin,
              attributeName:   "",
              unit:            0,
              position:        j + 1,
            });
            if ((bullet.children || []).length > 0) {
              await processChildBlocks(
                bullet.children, sectionUin, `${sectionUin}.${bulletDefUin}`
              );
            }
          }
          continue;
        }

        // ── Dropdown (non-first) ─────────────────────────────────────────
        if (block.type === "dropdown" && sectionUin !== null) {
          const defUin  = await insertBlockDef(block, sectionUin, elementId, i);
          const options = block.options || [];
          const dropdownAttrUin = await insertAttr({
            attribNestingId: `${sectionUin}`,
            definitionUin:   defUin,
            attributeName:   "List",
            unit:            0,
            position:        1,
          });
          await insertValidationEntries(
            dropdownAttrUin,
            options,
            block.validationTypeId || 0
          );
          for (let j = 0; j < options.length; j++) {
            const opt = options[j];
            if ((opt.children || []).length > 0) {
              await processChildBlocks(opt.children, sectionUin, `${sectionUin}.${dropdownAttrUin}`);
            }
          }
          continue;
        }

        // ── Textbox (non-first) ───────────────────────────────────────────
        if (block.type === "textbox" && sectionUin !== null) {
          const textboxes = block.textboxes || [];
          const containerDefUin = await insertDef({
            nestingId:   sectionUin,
            elementId,
            question:    block.title || "",
            columnCount: block.textboxCols || 1,
            rowCount:    block.textboxRows || 1,
            position:    i,
            layout: block.layout,
          });
          for (let j = 0; j < textboxes.length; j++) {
            const tb = textboxes[j];
            const tbDefUin = await insertDef({
              nestingId:   containerDefUin,
              elementId,
              question:    tb.question || "",
              columnCount: 1,
              rowCount:    1,
              position:    j + 1,
            });
            const tbAttrUin = await insertAttr({
              attribNestingId: `${containerDefUin}`,
              definitionUin:   tbDefUin,
              attributeName:   "",
              attributeValue: tb.kind || "text",
              unit:            tb.unitId || 0,
              position:        j + 1,
            });
            await insertTextboxValidationEntries(tb, tbAttrUin);
            if (["int", "float", "decimal", "date", "time"].includes(tb.kind) 
              && (tb.significantEntries || []).length > 0) {
              await insertSignificantEntries(tbAttrUin, tb.kind, tb.significantEntries);
            }
          }
          continue;
        }

        // ── First block ───────────────────────────────────────────────────
        if (i === 0) {
          if (block.type === "textbox") {
            const textboxes = block.textboxes || [];
            const containerDefUin = await insertDef({
              nestingId:   0,
              elementId,
              question:    block.title || "",
              columnCount: block.textboxCols || 1,
              rowCount:    block.textboxRows || 1,
              position:    0,
              layout:      block.layout,
            });
            await RitvikModuleElementsDef.update(
              { nesting_id: containerDefUin },
              { where: { id: containerDefUin }, transaction: t }
            );
              sectionUin = containerDefUin;
              for (let j = 0; j < textboxes.length; j++) {
                const tb = textboxes[j];
                const tbDefUin = await insertDef({
                  nestingId:   containerDefUin,
                  elementId,
                  question:    tb.question || "",
                  columnCount: 1,
                  rowCount:    1,
                  position:    j + 1,
                });
                const tbAttrUin = await insertAttr({
                  attribNestingId: `${containerDefUin}`,
                  definitionUin:   tbDefUin,
                  attributeName:   "",
                  attributeValue: tb.kind || "text",
                  unit:            tb.unitId || 0,
                  position:        j + 1,
                });
                await insertTextboxValidationEntries(tb, tbAttrUin);
                if (["int", "float", "decimal", "date", "time"].includes(tb.kind) 
              && (tb.significantEntries || []).length > 0) {
              await insertSignificantEntries(tbAttrUin, tb.kind, tb.significantEntries);
                }
              }
          } else if (block.type === "dropdown") {
            const defUin  = await insertBlockDef(block, 0, elementId, 0);
            await RitvikModuleElementsDef.update(
              { nesting_id: defUin },
              { where: { id: defUin }, transaction: t }
            );
            sectionUin = defUin;
            const options = block.options || [];
            const dropdownAttrUin = await insertAttr({
              attribNestingId: `${sectionUin}`,
              definitionUin:   defUin,
              attributeName:   "List",
              unit:            0,
              position:        1,
            });
            await insertValidationEntries(
              dropdownAttrUin,
              options,
              block.validationTypeId || 0
            );
            for (let j = 0; j < options.length; j++) {
              const opt = options[j];
              if ((opt.children || []).length > 0) {
                await processChildBlocks(opt.children, sectionUin, `${sectionUin}.${dropdownAttrUin}`);
              }
            }

          } else {
            const defUin = await insertBlockDef(block, 0, elementId, 0);
            await RitvikModuleElementsDef.update(
              { nesting_id: defUin },
              { where: { id: defUin }, transaction: t }
            );
            sectionUin = defUin;
            await processBlockAttribs(block, defUin, sectionUin, `${sectionUin}`);
          }

        // ── Subsequent blocks ─────────────────────────────────────────────
        } else {
          const defUin = await insertBlockDef(block, sectionUin, elementId, i);
          await processBlockAttribs(block, defUin, sectionUin, `${sectionUin}`);
        }
      }
    }

    // 4. Process all groups
    const allBlocks = allBlockGroups.flatMap(g => g.blocks);
    await processGroup(allBlocks);

    await t.commit();
    res.json({ ok: true, moduleNameId });

  } catch (err) {
    await t.rollback();
    console.error("Export to DB error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;