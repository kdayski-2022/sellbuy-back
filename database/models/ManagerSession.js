const DataTypes = require('sequelize');

module.exports = {
    managerId: DataTypes.INTEGER,
    accessToken: DataTypes.STRING,
    refreshToken: DataTypes.STRING,
    accessExpired: DataTypes.STRING,
    refreshExpired: DataTypes.STRING
};