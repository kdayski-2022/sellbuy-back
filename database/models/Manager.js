const DataTypes = require('sequelize');

module.exports = {
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    login: DataTypes.STRING,
    name: DataTypes.STRING,
    password: DataTypes.STRING,
    role: DataTypes.ARRAY(DataTypes.STRING),
};