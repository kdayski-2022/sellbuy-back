const DataTypes = require('sequelize');

module.exports = {
  address: DataTypes.STRING,
  ref_code: DataTypes.STRING,
  ref_user_id: DataTypes.INTEGER,
  ref_fee: DataTypes.INTEGER,
  nick_name: DataTypes.STRING,
  commission: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0.7 },
};
