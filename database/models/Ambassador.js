const DataTypes = require('sequelize');

module.exports = {
  name: DataTypes.STRING,
  country: DataTypes.STRING,
  phone: DataTypes.STRING,
  experience: DataTypes.STRING,
  wallet: {
    type: DataTypes.STRING,
    set(value) {
      this.setDataValue('wallet', value.toLowerCase());
    },
  },
  link: DataTypes.STRING,
};
