const { DataTypes } = require("sequelize");
const sequelize = require("../db");

module.exports = sequelize.define("ritvik_modules", {
  id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:       { type: DataTypes.STRING(255), allowNull: false },
  data:       { type: DataTypes.TEXT("long"), allowNull: false },
  color:      { type: DataTypes.STRING(10), defaultValue: "#000000" },
  type:       { type: DataTypes.STRING(20), defaultValue: "module" },
  updated_at: { type: DataTypes.DATE },
  created_at: { type: DataTypes.DATE },
}, { timestamps: false });