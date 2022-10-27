const DataTypes = require('sequelize');

module.exports = {
    user_payment_tx_hash: DataTypes.STRING,
    amount: DataTypes.FLOAT,
    price: DataTypes.INTEGER,
    instrument_name: DataTypes.STRING,
    execute_date: DataTypes.DATE,
    order: DataTypes.TEXT,
    from: DataTypes.STRING,
    order_id: DataTypes.STRING,
    payment_complete: DataTypes.BOOLEAN,
    order_complete: DataTypes.BOOLEAN,
    recieve: DataTypes.FLOAT,
    status: DataTypes.STRING,
    target_index_price: DataTypes.FLOAT,
    end_index_price: DataTypes.FLOAT,
    start_index_price:  DataTypes.FLOAT,
    settlement_date: DataTypes.DATE,
    eth_sold: DataTypes.BOOLEAN,
    payout_eth: DataTypes.FLOAT,
    payout_usdc: DataTypes.FLOAT,
    payout_tx: DataTypes.STRING,
    direction: DataTypes.STRING,
    perpetual: DataTypes.TEXT
};