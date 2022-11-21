const DataTypes = require('sequelize');

module.exports = {
  email: DataTypes.STRING,
  message: DataTypes.TEXT,
  address: DataTypes.STRING,
  direction: DataTypes.STRING,
};
