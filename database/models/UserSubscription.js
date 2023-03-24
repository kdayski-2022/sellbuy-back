const DataTypes = require('sequelize');

module.exports = {
  address: DataTypes.STRING,
  email: DataTypes.STRING,
  notifications: DataTypes.BOOLEAN,
};
