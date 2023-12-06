const DataTypes = require('sequelize');

module.exports = {
  name: DataTypes.STRING,
  wallet: {
    type: DataTypes.STRING,
    set(value) {
      this.setDataValue('wallet', value.toLowerCase());
    },
  },
  alias: DataTypes.STRING,
  email: DataTypes.STRING,
};
