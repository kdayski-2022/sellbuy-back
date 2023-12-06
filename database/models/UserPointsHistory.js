const DataTypes = require('sequelize');

module.exports = {
  address: {
    type: DataTypes.STRING,
    set(value) {
      this.setDataValue('address', value.toLowerCase());
    },
  },
  type: DataTypes.STRING,
  multiply: DataTypes.FLOAT,
  value: DataTypes.FLOAT,
};
