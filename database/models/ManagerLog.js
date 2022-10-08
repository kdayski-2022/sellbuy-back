const DataTypes = require('sequelize');

module.exports = {
    managerId: DataTypes.INTEGER,
    type: DataTypes.STRING,
    route: DataTypes.STRING,
    data: DataTypes.TEXT
};