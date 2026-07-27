const express    = require("express");
const cors       = require("cors");
const { QueryTypes } = require("sequelize");
const sequelize  = require("./db");
const { DataTypes } = require("sequelize");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const RitvikModule = require("./models/RitvikModule");

// ── Lookup tables ─────────────────────────────────────────────────────────

app.get("/lookup/validation-type-details", async (req, res) => {
  try {
    const rows = await sequelize.query(
      `SELECT id, validation_type_id, validation_type_definition_id, 
              validation_type_definition_types_id 
       FROM ehr_attribute_validation_type_details`,
      { type: QueryTypes.SELECT }
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/lookup/validation-types", async (req, res) => {
  try {
    const rows = await sequelize.query(
      "SELECT id, description FROM ehr_attribute_validation_types",
      { type: QueryTypes.SELECT }
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/lookup/validation-definitions", async (req, res) => {
  try {
    const rows = await sequelize.query(
      "SELECT id, description FROM ehr_attribute_validation_type_definitions",
      { type: QueryTypes.SELECT }
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/lookup/definition-types", async (req, res) => {
  try {
    const rows = await sequelize.query(
      "SELECT id, description FROM ehr_attribute_validation_type_definition_types",
      { type: QueryTypes.SELECT }
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/lookup/units", async (req, res) => {
  try {
    const rows = await sequelize.query(
      "SELECT id, unit, `equivalent _unit_id` AS equivalent_unit_id FROM ehr_units",
      { type: QueryTypes.SELECT }
    );
    res.json(rows);
  } catch (err) {
    console.error("Units error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/lookup/element-types", async (req, res) => {
  try {
    const rows = await sequelize.query(
      "SELECT id, type FROM ehr_module_elements",
      { type: QueryTypes.SELECT }
    );
    res.json(rows);
  } catch (err) {
    console.error("Element types error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/lookup/specialties", async (req, res) => {
  try {
    const rows = await sequelize.query(
      "SELECT id, name FROM ehr_specialties ORDER BY name",
      { type: QueryTypes.SELECT }
    );
    res.json(rows);
  } catch (err) {
    console.error("Specialties error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/lookup/subspecialties", async (req, res) => {
  try {
    const { specialty_id } = req.query;
    const rows = await sequelize.query(
      specialty_id
        ? "SELECT id, name, specialty_id FROM ehr_subspecialties WHERE specialty_id = :specialtyId ORDER BY name"
        : "SELECT id, name, specialty_id FROM ehr_subspecialties ORDER BY name",
      {
        replacements: specialty_id ? { specialtyId: specialty_id } : {},
        type: QueryTypes.SELECT,
      }
    );
    res.json(rows);
  } catch (err) {
    console.error("Subspecialties error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Modules CRUD ──────────────────────────────────────────────────────────

app.get("/modules", async (req, res) => {
  try {
    const type = req.query.type || "module";
    const modules = await RitvikModule.findAll({
      attributes: ["id", "name", "color", "type", "updated_at"],
      where: { type },
      order: [["updated_at", "DESC"]],
    });
    res.json(modules);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/modules/:id", async (req, res) => {
  try {
    const mod = await RitvikModule.findByPk(req.params.id);
    if (!mod) return res.status(404).json({ error: "Not found" });
    res.json({ ...mod.toJSON(), data: JSON.parse(mod.data) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/modules", async (req, res) => {
  try {
    const { name, data, color, type } = req.body;
    if (!name || !data) return res.status(400).json({ error: "name and data required" });
    const mod = await RitvikModule.create({
      name,
      data:  JSON.stringify(data),
      color: color || "#000000",
      type:  type  || "module",
    });
    res.json({ id: mod.id, name: mod.name });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch("/modules/:id", async (req, res) => {
  try {
    const { name, data, color, type } = req.body;
    const patch = {};
    if (name  !== undefined) patch.name  = name;
    if (data  !== undefined) patch.data  = JSON.stringify(data);
    if (color !== undefined) patch.color = color;
    if (type  !== undefined) patch.type  = type;
    if (!Object.keys(patch).length) return res.status(400).json({ error: "Nothing to update" });
    await RitvikModule.update(patch, { where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/modules/:id", async (req, res) => {
  try {
    await RitvikModule.destroy({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Export route ──────────────────────────────────────────────────────────

const exportRouter = require("./routes/export");
app.use("/modules", exportRouter);

const recallRouter = require("./routes/recall");
app.use("/recall", recallRouter);

// ── Start ─────────────────────────────────────────────────────────────────

sequelize.authenticate()
  .then(() => console.log("Database connected via Sequelize"))
  .catch(err => console.error("DB connection error:", err));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));