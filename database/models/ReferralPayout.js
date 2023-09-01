const DataTypes = require('sequelize');

module.exports = {
  address: {
    type: DataTypes.STRING,
    set(value) {
      this.setDataValue('address', value.toLowerCase());
    },
  },
  order_id: DataTypes.STRING,
  tx_hash: DataTypes.STRING,
  paid: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
};
