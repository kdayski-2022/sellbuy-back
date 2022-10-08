const DataTypes = require('sequelize');

module.exports = {
    address: DataTypes.STRING,
    tx_hash: DataTypes.STRING,
	status: DataTypes.STRING,
};