const DataTypes = require('sequelize');

module.exports = {
  address: DataTypes.STRING,
  email: DataTypes.STRING,
  telegram: DataTypes.STRING,
  transaction_notifications: DataTypes.BOOLEAN,
  news: DataTypes.BOOLEAN,
};
