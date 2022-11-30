const DataTypes = require('sequelize');

module.exports = {
  sessionToken: DataTypes.STRING,
  messages: DataTypes.TEXT,
  address: DataTypes.STRING,
};
