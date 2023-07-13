const DataTypes = require('sequelize');

module.exports = {
  address: {
    type: DataTypes.STRING,
    set(value) {
      this.setDataValue('address', value.toLowerCase());
    },
  },
  ref_code: DataTypes.STRING,
  ref_user_id: DataTypes.INTEGER,
  ref_fee: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },
  nick_name: DataTypes.STRING,
  commission: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0.7 },
};
