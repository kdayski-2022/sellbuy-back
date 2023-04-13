const DataTypes = require('sequelize');

module.exports = {
  airdrop_id: DataTypes.INTEGER,
  serial_number: DataTypes.INTEGER,
  address: DataTypes.STRING,
  share_link: DataTypes.STRING,
  deal_made: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  link_shared: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
};
