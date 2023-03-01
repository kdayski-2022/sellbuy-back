const DataTypes = require('sequelize');

module.exports = {
  address: DataTypes.STRING,
  order_id: DataTypes.STRING,
  tx_hash: DataTypes.STRING,
  paid: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
};
