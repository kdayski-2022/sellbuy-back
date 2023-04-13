const DataTypes = require('sequelize');

module.exports = {
  active: DataTypes.BOOLEAN,
  bank: DataTypes.FLOAT,
  participant_limit: DataTypes.INTEGER,
};
