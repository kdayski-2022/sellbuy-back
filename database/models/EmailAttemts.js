const DataTypes = require('sequelize');

module.exports = {
  to: DataTypes.STRING,
  subject: DataTypes.STRING,
  text: DataTypes.TEXT,
  html: DataTypes.TEXT,
  isSent: DataTypes.BOOLEAN,
};
