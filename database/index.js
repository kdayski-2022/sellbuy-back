'use strict';
require('dotenv').config({ path: __dirname + '/../.env' })
const Sequelize = require('sequelize');
const env = process.env.DB_ENV || 'development';
const config = require(__dirname + '/../database/config.json')[env];
console.log(`BD ENV ${env}`)
const connection = config.use_env_variable ?
  new Sequelize(process.env[config.use_env_variable], config) :
  new Sequelize(config.database, config.username, config.password, config);

const definitions = require('./definitions');
let models = {};
for (const name in definitions) {
  models[name] = connection.define(name, definitions[name]);
}



module.exports = {
  connection, models, queryTypes: Sequelize.QueryTypes, Op: Sequelize.Op, sequelize: Sequelize
};