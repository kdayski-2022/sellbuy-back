const DataTypes = require('sequelize');

module.exports = {
    tx_hash: DataTypes.STRING,
    amount: DataTypes.INTEGER,
    price: DataTypes.INTEGER,
    instrument_name: DataTypes.STRING,
    execute_date: DataTypes.DATE
};