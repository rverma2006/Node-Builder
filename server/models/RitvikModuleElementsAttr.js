const { DataTypes } = require("sequelize");
const sequelize = require("../db");

module.exports = sequelize.define("ritvik_ehr_module_elements_attributes", {
  id:                                { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  uin:                               { type: DataTypes.INTEGER, defaultValue: 0 },
  attrib_nesting_id:                 { type: DataTypes.STRING(255), defaultValue: "" },
  ehr_module_elements_definition_uin:{ type: DataTypes.INTEGER, defaultValue: 0 },
  flag:                              { type: DataTypes.INTEGER, defaultValue: 0 },
  map:                               { type: DataTypes.INTEGER, defaultValue: 0 },
  attribute_name:                    { type: DataTypes.STRING(255), defaultValue: "" },
  attribute_heading:                 { type: DataTypes.STRING(255), defaultValue: "" },
  attribute_value:                   { type: DataTypes.STRING(255), defaultValue: "" },
  validation:                        { type: DataTypes.INTEGER, defaultValue: 0 },
  unit:                              { type: DataTypes.INTEGER, defaultValue: 0 },
  value_characters:                  { type: DataTypes.INTEGER, defaultValue: 0 },
  relative_position:                 { type: DataTypes.INTEGER, defaultValue: 0 },
  status:                            { type: DataTypes.INTEGER, defaultValue: 1 },
  created_by:                        { type: DataTypes.INTEGER, defaultValue: 0 },
  modified_by:                       { type: DataTypes.INTEGER, defaultValue: 0 },
  created_date:                      { type: DataTypes.DATE, allowNull: true },
  modified_date:                     { type: DataTypes.DATE, allowNull: true },
}, { timestamps: false });