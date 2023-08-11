const DataTypes = require('sequelize');

module.exports = {
  user_payment_tx_hash: DataTypes.STRING,
  amount: DataTypes.FLOAT,
  price: DataTypes.INTEGER,
  instrument_name: DataTypes.STRING,
  execute_date: DataTypes.DATE,
  order: DataTypes.TEXT,
  from: {
    type: DataTypes.STRING,
    set(value) {
      this.setDataValue('from', value.toLowerCase());
    },
  },
  order_id: DataTypes.STRING,
  attempt_id: DataTypes.INTEGER,
  payment_complete: DataTypes.BOOLEAN,
  order_complete: DataTypes.BOOLEAN,
  recieve: DataTypes.FLOAT,
  status: DataTypes.STRING,
  target_index_price: DataTypes.FLOAT,
  end_index_price: DataTypes.FLOAT,
  start_index_price: DataTypes.FLOAT,
  settlement_date: DataTypes.DATE,
  order_executed: DataTypes.BOOLEAN,
  payout_currency: DataTypes.STRING,
  payout_eth: DataTypes.FLOAT,
  payout_usdc: DataTypes.FLOAT,
  payout_tx: DataTypes.STRING,
  direction: DataTypes.STRING,
  contract_text: DataTypes.TEXT,
  smart_contract: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  order_hedged: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  autopay: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  commission: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0.7 },
  chain_id: DataTypes.INTEGER,
};
