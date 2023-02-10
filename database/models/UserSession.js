const DataTypes = require('sequelize');

module.exports = {
  userAddress: DataTypes.STRING,
  sessionToken: DataTypes.STRING,
  expire_in: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 15552000000,
  },
};
