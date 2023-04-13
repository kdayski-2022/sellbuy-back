const Web3 = require('web3');
const ERC20Abi = require('../abi/ERC20.json');
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
const withdrawalTokenAddress = process.env.WITHDRAWAL_TOKEN_ADDRESS;
const serviceWalletAddress = process.env.SERVICE_WALLET_ADDRESS;

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

const calculatePayouts = async (order) => {
  try {
    const {
      direction,
      end_index_price,
      target_index_price,
      price,
      amount,
      recieve,
    } = order;
    let order_executed;
    if (direction === 'sell') {
      order_executed = end_index_price >= target_index_price;
    }
    if (direction === 'buy') {
      order_executed = end_index_price <= target_index_price;
    }

    const web3 = new Web3(infuraRpc);
    const contract = new web3.eth.Contract(ERC20Abi, withdrawalTokenAddress, {
      from: serviceWalletAddress,
    });
    const USDCDecimals = await contract.methods.decimals().call();
    const ETHDecimals = 18;

    const USDCToPay = (
      parseFloat(price) * parseFloat(amount) +
      parseFloat(recieve)
    ).toFixed(USDCDecimals);
    const ETHToPay = (
      parseFloat(amount) +
      parseFloat(recieve) / parseFloat(end_index_price)
    ).toFixed(ETHDecimals);
    let payout_currency;
    if (order_executed && direction === 'sell') payout_currency = 'USDC';
    if (!order_executed && direction === 'sell') payout_currency = 'ETH';
    if (order_executed && direction === 'buy') payout_currency = 'ETH';
    if (!order_executed && direction === 'buy') payout_currency = 'USDC';
    return { order_executed, payout_currency, USDCToPay, ETHToPay };
  } catch (e) {
    throw e;
  }
};

const payout = async (data) => {
  try {
    const { payout_currency, USDCToPay, ETHToPay, order } = data;
    let status, message, tx;
    if (payout_currency === 'USDC') {
      const res = await transfer.sendUSDC(order.from, USDCToPay);
      status = res.status;
      message = res.message;
      tx = res.tx;
    }
    if (payout_currency === 'ETH') {
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
    const { payout_currency, order_executed, USDCToPay, ETHToPay } =
      await calculatePayouts(order);
    const { status, message, tx } = await payout({
      payout_currency,
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
          order_executed,
          payout_currency,
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

const getPayin = async (web3, order) => {
  try {
    const data = await web3.eth.getTransaction(order.user_payment_tx_hash);
    if (!data) return false;
    let value = data.value;
    if (value) value = Number(web3.utils.fromWei(new web3.utils.BN(value)));
    if (data.input !== '0x') {
      const input = `0x${data.input.slice(10, 138)}`;
      const res = await web3.eth.abi.decodeParameters(
        ['address', 'uint256'],
        input
      );
      value = await transfer.usdcFromWei(res['1']);
    }

    let amountCorrect = false;
    const addressCorrect = order.from.toLowerCase() === data.from.toLowerCase();
    if (order.direction === 'buy') {
      amountCorrect =
        Number(order.amount) * Number(order.price) === Number(value);
    }
    if (order.direction === 'sell') {
      amountCorrect = Number(order.amount) === Number(value);
    }

    return amountCorrect && addressCorrect;
  } catch (e) {
    console.log(e);
    return false;
  }
};

module.exports = { postOrder, approve, calculatePayouts, getPayin };
