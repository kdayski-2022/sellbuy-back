const Web3 = require('web3');
const axios = require('axios');
const db = require('../database');
const { writeLog, updateLog } = require('./logger');
const {
  buy_data,
  sell_data,
  get_index_price,
} = require('../config/requestData.json');
const { getAccessToken } = require('./auth');
const dotenv = require('dotenv');
const { parseError } = require('./lib');
const Transfer = require('./transfer');
const transfer = new Transfer();
transfer.init();
dotenv.config();
const apiUrl = process.env.API_URL;
const infuraRpc = process.env.INFURA_RPC;

const postOrder = async (data) => {
  const logId = await writeLog({
    action: 'system postOrder',
    status: 'in progress',
  });
  const {
    amount,
    price,
    period,
    instrument_name,
    estimated_delivery_price,
    bid_price,
    address,
    hash,
    direction,
  } = data;

  const postData = direction === 'sell' ? sell_data : buy_data;
  postData.params.instrument_name = instrument_name;
  postData.params.amount = Number(amount);
  try {
    direction === 'sell'
      ? telegram.send(`User ${address} deposited ${amount} ETH`)
      : telegram.send(
          `User ${address} deposited ${Number(amount) * Number(price)} USDC`
        );
    const web3 = new Web3(infuraRpc);

    const transactionReceipt = await web3.eth.getTransactionReceipt(hash);
    const status = transactionReceipt && transactionReceipt.status;
    const recieve = estimated_delivery_price * bid_price * Number(amount) * 0.7;

    if (status) {
      await db.models.Order.create({
        from: address.toLowerCase(),
        user_payment_tx_hash: hash,
        amount,
        price,
        order_complete: false,
        payment_complete: status ? true : false,
        instrument_name,
        execute_date: period,
        recieve,
        status: 'pending',
        direction,
      });
      const accessToken = await getAccessToken();

      const { data } = await axios.post(apiUrl, postData, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const indexPriceData = await axios.post(apiUrl, get_index_price);

      const order_id =
        data && data.result && data.result.order && data.result.order.order_id
          ? data.result.order.order_id
          : null;
      const order =
        data && data.result && data.result.order
          ? JSON.stringify(data.result.order)
          : {};
      const start_index_price =
        indexPriceData &&
        indexPriceData.data &&
        indexPriceData.data.result &&
        indexPriceData.data.result.index_price
          ? indexPriceData.data.result.index_price
          : null;

      await db.models.Order.update(
        {
          status: 'created',
          order_id,
          order,
          target_index_price: price,
          start_index_price,
        },
        { where: { user_payment_tx_hash: hash } }
      );
      telegram.send(
        `Order was made by user ${address}\n${data?.result?.order?.instrument_name}`
      );
      updateLog(logId, { status: 'success' });
      return { success: true, order_id };
    } else {
      updateLog(logId, {
        status: 'failed',
        error: 'Transaction was not mined',
      });
      return { success: false, error: 'Transaction was not mined' };
    }
  } catch (e) {
    console.log(e);
    updateLog(logId, { status: 'failed', error: parseError(e) });
    telegram.send(
      `Order ${instrument_name} creation failed by user ${address}\n${JSON.stringify(
        e?.response?.data?.error
      )}`
    );
    return { success: false, error: e?.response?.data?.error?.message };
  }
};

const calculatePayouts = (order) => {
  try {
    const {
      direction,
      end_index_price,
      target_index_price,
      price,
      amount,
      recieve,
    } = order;
    const isValidToSell =
      direction === 'sell'
        ? end_index_price >= target_index_price
        : end_index_price > target_index_price;
    const USDCToPay = Math.floor(
      parseFloat(price) * amount + parseFloat(recieve)
    );
    const ETHToPay =
      parseFloat(amount) + parseFloat(recieve) / parseFloat(end_index_price);
    return { isValidToSell, USDCToPay, ETHToPay };
  } catch (e) {
    throw e;
  }
};

const payout = async (data) => {
  try {
    const { isValidToSell, USDCToPay, ETHToPay, order } = data;
    let status, message, tx;
    if (isValidToSell) {
      const res = await transfer.sendUSDC(order.from, USDCToPay);
      status = res.status;
      message = res.message;
      tx = res.tx;
    } else {
      const res = await transfer.sendETH(order.from, ETHToPay);
      status = res.status;
      message = res.message;
      tx = res.tx;
    }
    return { status, message, tx };
  } catch (e) {
    throw e;
  }
};

const approve = async (order_id) => {
  try {
    const order = await db.models.Order.findOne({ where: { order_id } });
    const { isValidToSell, USDCToPay, ETHToPay } = calculatePayouts(order);
    const { status, message, tx } = await payout({
      isValidToSell,
      USDCToPay,
      ETHToPay,
      order,
    });

    if (status === true) {
      await db.models.Order.update(
        {
          order_complete: true,
          status: 'approved',
          settlement_date: new Date(),
          eth_sold: isValidToSell,
          payout_eth: ETHToPay,
          payout_usdc: USDCToPay,
          payout_tx: tx,
        },
        { where: { order_id } }
      );
      return { status: 'success', message };
    } else {
      await db.models.Order.update(
        {
          order_complete: false,
          status,
        },
        { where: { order_id } }
      );
      return { status: 'failed', message };
    }
  } catch (e) {
    throw e;
  }
};

module.exports = { postOrder, approve, calculatePayouts };
