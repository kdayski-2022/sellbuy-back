const DataTypes = require('sequelize');

module.exports = {
  userAddress: DataTypes.STRING,
  sessionToken: DataTypes.STRING,
  ipAddres: DataTypes.STRING,
  browser: DataTypes.STRING,
  typeMobile: DataTypes.STRING,
  walletType: DataTypes.STRING,
  action: DataTypes.STRING,
  userAgent: DataTypes.TEXT,
  requestParams: DataTypes.TEXT,
  status: DataTypes.STRING,
  error: DataTypes.TEXT,
};
