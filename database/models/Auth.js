const DataTypes = require('sequelize');

module.exports = {
    auth_roken: DataTypes.STRING(1000),
    expire_in: DataTypes.INTEGER,
	refresh_token: DataTypes.STRING(1000)
};