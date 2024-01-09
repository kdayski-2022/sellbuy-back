const DataTypes = require('sequelize');

module.exports = {
  address: {
    type: DataTypes.STRING,
    set(value) {
      this.setDataValue('address', value.toLowerCase());
    },
  },
  ref_code: DataTypes.STRING,
  ref_code_list: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false,
    defaultValue: [],
  },
  ref_user_id: DataTypes.INTEGER,
  ref_fee: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 11.5 },
  nick_name: DataTypes.STRING,
  commission: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0.7 },
  chat_access: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  club_member: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
};
