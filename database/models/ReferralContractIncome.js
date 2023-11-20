const DataTypes = require('sequelize');

module.exports = {
  address: DataTypes.STRING,
  amount: DataTypes.STRING,
  chain_id: DataTypes.INTEGER,
};
