'use strict';

var Sequelize = require('sequelize');

/**
 * Actions summary:
 *
 * createTable "BalanceHistories", deps: []
 * createTable "Users", deps: []
 * addColumn "from" to table "Orders"
 * addColumn "order_id" to table "Orders"
 * addColumn "payment_complete" to table "Orders"
 * addColumn "recieve" to table "Orders"
 * changeColumn "amount" on table "Orders"
 *
 **/

var info = {
    "revision": 8,
    "name": "noname",
    "created": "2022-08-12T12:37:13.827Z",
    "comment": ""
};

var migrationCommands = function(transaction) {
    return [{
            fn: "createTable",
            params: [
                "BalanceHistories",
                {
                    "id": {
                        "type": Sequelize.INTEGER,
                        "field": "id",
                        "autoIncrement": true,
                        "primaryKey": true,
                        "allowNull": false
                    },
                    "address": {
                        "type": Sequelize.STRING,
                        "field": "address"
                    },
                    "tx_hash": {
                        "type": Sequelize.STRING,
                        "field": "tx_hash"
                    },
                    "status": {
                        "type": Sequelize.STRING,
                        "field": "status"
                    },
                    "createdAt": {
                        "type": Sequelize.DATE,
                        "field": "createdAt",
                        "allowNull": false
                    },
                    "updatedAt": {
                        "type": Sequelize.DATE,
                        "field": "updatedAt",
                        "allowNull": false
                    }
                },
                {
                    "transaction": transaction
                }
            ]
        },
        {
            fn: "createTable",
            params: [
                "Users",
                {
                    "id": {
                        "type": Sequelize.INTEGER,
                        "field": "id",
                        "autoIncrement": true,
                        "primaryKey": true,
                        "allowNull": false
                    },
                    "address": {
                        "type": Sequelize.STRING,
                        "field": "address"
                    },
                    "balance": {
                        "type": Sequelize.FLOAT,
                        "field": "balance"
                    },
                    "createdAt": {
                        "type": Sequelize.DATE,
                        "field": "createdAt",
                        "allowNull": false
                    },
                    "updatedAt": {
                        "type": Sequelize.DATE,
                        "field": "updatedAt",
                        "allowNull": false
                    }
                },
                {
                    "transaction": transaction
                }
            ]
        },
        {
            fn: "addColumn",
            params: [
                "Orders",
                "from",
                {
                    "type": Sequelize.STRING,
                    "field": "from"
                },
                {
                    transaction: transaction
                }
            ]
        },
        {
            fn: "addColumn",
            params: [
                "Orders",
                "order_id",
                {
                    "type": Sequelize.STRING,
                    "field": "order_id"
                },
                {
                    transaction: transaction
                }
            ]
        },
        {
            fn: "addColumn",
            params: [
                "Orders",
                "payment_complete",
                {
                    "type": Sequelize.BOOLEAN,
                    "field": "payment_complete"
                },
                {
                    transaction: transaction
                }
            ]
        },
        {
            fn: "addColumn",
            params: [
                "Orders",
                "recieve",
                {
                    "type": Sequelize.FLOAT,
                    "field": "recieve"
                },
                {
                    transaction: transaction
                }
            ]
        },
        {
            fn: "changeColumn",
            params: [
                "Orders",
                "amount",
                {
                    "type": Sequelize.FLOAT,
                    "field": "amount"
                },
                {
                    transaction: transaction
                }
            ]
        }
    ];
};
var rollbackCommands = function(transaction) {
    return [{
            fn: "removeColumn",
            params: [
                "Orders",
                "from",
                {
                    transaction: transaction
                }
            ]
        },
        {
            fn: "removeColumn",
            params: [
                "Orders",
                "order_id",
                {
                    transaction: transaction
                }
            ]
        },
        {
            fn: "removeColumn",
            params: [
                "Orders",
                "payment_complete",
                {
                    transaction: transaction
                }
            ]
        },
        {
            fn: "removeColumn",
            params: [
                "Orders",
                "recieve",
                {
                    transaction: transaction
                }
            ]
        },
        {
            fn: "dropTable",
            params: ["BalanceHistories", {
                transaction: transaction
            }]
        },
        {
            fn: "dropTable",
            params: ["Users", {
                transaction: transaction
            }]
        },
        {
            fn: "changeColumn",
            params: [
                "Orders",
                "amount",
                {
                    "type": Sequelize.INTEGER,
                    "field": "amount"
                },
                {
                    transaction: transaction
                }
            ]
        }
    ];
};

module.exports = {
    pos: 0,
    useTransaction: true,
    execute: function(queryInterface, Sequelize, _commands)
    {
        var index = this.pos;
        function run(transaction) {
            const commands = _commands(transaction);
            return new Promise(function(resolve, reject) {
                function next() {
                    if (index < commands.length)
                    {
                        let command = commands[index];
                        console.log("[#"+index+"] execute: " + command.fn);
                        index++;
                        queryInterface[command.fn].apply(queryInterface, command.params).then(next, reject);
                    }
                    else
                        resolve();
                }
                next();
            });
        }
        if (this.useTransaction) {
            return queryInterface.sequelize.transaction(run);
        } else {
            return run(null);
        }
    },
    up: function(queryInterface, Sequelize)
    {
        return this.execute(queryInterface, Sequelize, migrationCommands);
    },
    down: function(queryInterface, Sequelize)
    {
        return this.execute(queryInterface, Sequelize, rollbackCommands);
    },
    info: info
};
