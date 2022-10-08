const DataTypes = require('sequelize');

module.exports = {
	userAddress: DataTypes.STRING,
	action: DataTypes.STRING,
    userAgent: DataTypes.STRING,
	requestParams: DataTypes.TEXT,
	status: DataTypes.STRING,
	error: DataTypes.TEXT
};