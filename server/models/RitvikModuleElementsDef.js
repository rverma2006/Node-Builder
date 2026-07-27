const { DataTypes } = require("sequelize");
const sequelize = require("../db");

module.exports = sequelize.define("ritvik_ehr_module_elements_definitions", {
  id:                     { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  uin:                    { type: DataTypes.INTEGER, defaultValue: 0 },
  nesting_id:             { type: DataTypes.INTEGER, defaultValue: 0 },
  group_id:               { type: DataTypes.INTEGER, defaultValue: 0 },
  ehr_module_elements_id: { type: DataTypes.INTEGER, defaultValue: 0 },
  options:                { type: DataTypes.INTEGER, defaultValue: 0 },
  ehr_module_names_id:    { type: DataTypes.INTEGER, defaultValue: 0 },
  question:               { type: DataTypes.STRING(500), defaultValue: "" },
  question_type:          { type: DataTypes.STRING(100), defaultValue: "" },
  column_count:           { type: DataTypes.INTEGER, defaultValue: 1 },
  row_count:              { type: DataTypes.INTEGER, defaultValue: 1 },
  relative_position:      { type: DataTypes.INTEGER, defaultValue: 0 },
  active_status:          { type: DataTypes.INTEGER, defaultValue: 1 },
  table_type:             { type: DataTypes.INTEGER, defaultValue: 0 },
  valid_button:           { type: DataTypes.INTEGER, defaultValue: 0 },
  fill_view:              { type: DataTypes.INTEGER, defaultValue: 0 },
  status:                 { type: DataTypes.INTEGER, defaultValue: 1 },
  created_by:             { type: DataTypes.INTEGER, defaultValue: 0 },
  modified_by:            { type: DataTypes.INTEGER, defaultValue: 0 },
  created_date:           { type: DataTypes.DATE, allowNull: true },
  modified_date:          { type: DataTypes.DATE, allowNull: true },
}, { timestamps: false });