const DataTypes = require('sequelize');

module.exports = {
  amount: DataTypes.FLOAT,
  price: DataTypes.INTEGER,
  period: DataTypes.DATE,
  address: {
    type: DataTypes.STRING,
    set(value) {
      this.setDataValue('address', value.toLowerCase());
    },
  },
  direction: DataTypes.STRING,
  execute_date: DataTypes.DATE,
  recieve: DataTypes.FLOAT,
  start_index_price: DataTypes.FLOAT,
  contract_text: DataTypes.TEXT,

  payment_complete: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  hash: DataTypes.STRING,

  order_published: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  order_hedged: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  referral_registration: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  order_id: DataTypes.STRING,
  instrument_name: DataTypes.STRING,

  all_stages_succeeded: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },

  instrument_name: DataTypes.STRING,
  estimated_delivery_price: DataTypes.FLOAT,
  bid_price: DataTypes.FLOAT,

  error: DataTypes.TEXT,
  chain_id: DataTypes.INTEGER,
};
