const DataTypes = require('sequelize');

module.exports = {
  utm: DataTypes.STRING,
  ref: DataTypes.STRING,
  data: DataTypes.TEXT,
  direction: DataTypes.STRING,
  sessionToken: DataTypes.STRING,
};
