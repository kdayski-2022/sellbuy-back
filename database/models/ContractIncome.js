const DataTypes = require('sequelize');

module.exports = {
  order_attempt_id: DataTypes.INTEGER,
  hash: DataTypes.STRING,
  from: DataTypes.STRING,
  amount: DataTypes.FLOAT,
  token_address: DataTypes.STRING,
  token_symbol: DataTypes.STRING,
  status: DataTypes.BOOLEAN,
  chain_id: DataTypes.INTEGER,
};
