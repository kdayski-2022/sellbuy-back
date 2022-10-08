'use strict';

const Sequelize = require('sequelize');
const env = process.env.DB_ENV || 'development';
const config = require(__dirname + '/../database/config.json')[env];

const connection = config.use_env_variable ?
    new Sequelize(process.env[config.use_env_variable], config) :
    new Sequelize(config.database, config.username, config.password, config);

const definitions = require('./definitions');

module.exports = function (modelName) {
    let models = {};
    if (!Array.isArray(modelName)) modelName = [modelName]

    for (const name in definitions) {
        if (~modelName.indexOf(name))
            models[name] = connection.define(name, definitions[name]);
    }
    return {
        models
    };
};