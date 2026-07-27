const { DataTypes } = require("sequelize");
const sequelize = require("../db");

module.exports = sequelize.define("ritvik_ehr_significant_entries", {
  id:                                   { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  module_elements_attribute_uin:        { type: DataTypes.INTEGER, defaultValue: 0 },
  attribute_validation_type_details_id: { type: DataTypes.INTEGER, defaultValue: 0 },
  description:                          { type: DataTypes.STRING(255), defaultValue: "" },
  status:                               { type: DataTypes.INTEGER, defaultValue: 1 },
  created_date:                         { type: DataTypes.DATE, allowNull: true },
  modified_date:                        { type: DataTypes.DATE, allowNull: true },
}, { timestamps: false });