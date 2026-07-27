const { DataTypes } = require("sequelize");
const sequelize = require("../db");

module.exports = sequelize.define("ritvik_ehr_module_names", {
  id:                  { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  module_name:         { type: DataTypes.STRING(200), allowNull: false },
  module_color:        { type: DataTypes.STRING(10) },
  module_status:       { type: DataTypes.INTEGER, defaultValue: 0 },
  module_specialty:    { type: DataTypes.INTEGER, defaultValue: 0 },
  module_subspecialty: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { timestamps: false });